const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const logger = require('../utils/logger');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const emailService = require('../utils/emailService');
const QRCode = require('qrcode');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');
const AuthorizationHelpers = require('../middleware/authorizationHelpers');
const Formatters = require('../utils/formatters');

// Helper function to send payment reminder
async function sendPaymentReminder(order) {
  try {
    // Get customer
    const customer = await Customer.findOne({ customerId: order.customerId });
    if (!customer) {
      logger.error(`Customer not found for order ${order.orderId}`);
      return;
    }
    
    // Update reminder tracking
    order.v2ReminderCount = (order.v2ReminderCount || 0) + 1;
    order.v2LastReminderSentAt = new Date();
    
    // Add to reminders array
    if (!order.v2PaymentReminders) {
      order.v2PaymentReminders = [];
    }
    order.v2PaymentReminders.push({
      sentAt: new Date(),
      reminderNumber: order.v2ReminderCount,
      method: 'email'
    });
    
    // Send reminder email
    await emailService.sendV2PaymentReminder({
      customer,
      order,
      reminderNumber: order.v2ReminderCount,
      paymentAmount: order.v2PaymentAmount,
      paymentLinks: order.v2PaymentLinks,
      qrCodes: order.v2PaymentQRCodes
    });
    
    logger.info(`Payment reminder #${order.v2ReminderCount} sent for order ${order.orderId}`);
    
    await order.save();
  } catch (error) {
    logger.error(`Failed to send payment reminder for order ${order.orderId}:`, error);
  }
}

// Helper function to generate payment URLs and QR codes
async function generatePaymentURLs(order) {
  const amount = order.v2PaymentAmount.toFixed(2);
  const orderNote = `WaveMAX Order ${order.orderId}`;
  
  // Generate payment URLs for each service
  // Note: Custom payment links only work with Venmo business profiles
  // Known issue: Venmo app adds business profile + username as two recipients when scanning QR
  const links = {
    venmo: `https://venmo.com/wavemaxatx?txn=pay&amount=${amount}&note=${encodeURIComponent(orderNote)}`,
    paypal: `https://www.paypal.me/WaveMAXLaundry/${amount}?locale.x=en_US&country.x=US`,
    cashapp: `https://cash.app/$WaveMAXLaundry/${amount}?note=${encodeURIComponent(orderNote)}`
  };
  
  // Use the same URL for QR codes as the button
  const qrUrls = {
    venmo: links.venmo,
    paypal: links.paypal,
    cashapp: links.cashapp
  };
  
  const qrCodes = {};
  for (const [service, url] of Object.entries(qrUrls)) {
    try {
      // Log the URL being encoded in the QR code
      console.log(`Generating ${service} QR code for URL:`, url);
      
      // Generate QR code as base64 string
      qrCodes[service] = await QRCode.toDataURL(url, {
        width: 300,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      logger.error(`Failed to generate QR code for ${service}:`, error);
      qrCodes[service] = null;
    }
  }
  
  return { links, qrCodes };
}

// Get order queue
exports.getOrderQueue = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { status = 'pending', priority, dateFrom, dateTo } = req.query;
  
  // Parse pagination parameters
  const pagination = ControllerHelpers.parsePagination(req.query, { limit: 20 });

  const query = { orderProcessingStatus: status };

  if (priority) {
    query.priority = priority;
  }

  if (dateFrom || dateTo) {
    query.scheduledPickup = {};
    if (dateFrom) query.scheduledPickup.$gte = new Date(dateFrom);
    if (dateTo) query.scheduledPickup.$lte = new Date(dateTo);
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate('assignedOperator', 'firstName lastName operatorId')
      .sort({ priority: -1, scheduledPickup: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Order.countDocuments(query)
  ]);

  // Format the orders data
  const formattedOrders = orders.map(order => ({
    ...order.toObject(),
    customer: order.customer ? {
      ...order.customer.toObject(),
      name: Formatters.fullName(order.customer.firstName, order.customer.lastName),
      phone: Formatters.phone(order.customer.phone)
    } : null,
    scheduledPickup: Formatters.datetime(order.scheduledPickup),
    estimatedWeight: Formatters.weight(order.estimatedWeight),
    actualWeight: Formatters.weight(order.actualWeight)
  }));

  const paginationMeta = ControllerHelpers.calculatePagination(total, pagination.page, pagination.limit);

  ControllerHelpers.sendSuccess(res, {
    orders: formattedOrders,
    pagination: paginationMeta
  }, 'Order queue retrieved successfully');
});

// Claim an order
exports.claimOrder = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { orderId } = req.params;
  const operatorId = req.user.id;

  const order = await Order.findById(orderId);
  if (!order) {
    return ControllerHelpers.sendError(res, 'Order not found', 404);
  }

  if (order.assignedOperator) {
    return ControllerHelpers.sendError(res, 'Order already assigned', 400);
  }

  // Check operator availability
  const operator = await Operator.findById(operatorId);
  const activeOrdersCount = await Order.countDocuments({
    assignedOperator: operatorId,
    orderProcessingStatus: { $in: ['assigned', 'washing', 'drying', 'folding'] }
  });

  if (activeOrdersCount >= 3) {
    return ControllerHelpers.sendError(res, 'Maximum concurrent orders reached', 400);
  }

  // Assign order
  order.assignedOperator = operatorId;
  order.orderProcessingStatus = 'assigned';
  order.processingStarted = new Date();
  await order.save();

  // Update operator stats
  operator.updatedAt = new Date();
  await operator.save();

  await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
    operatorId,
    orderId,
    orderNumber: order.orderNumber,
    action: 'order_claimed',
    newStatus: 'assigned'
  }, req);

  // Populate and format the order for response
  const populatedOrder = await order.populate('customer', 'firstName lastName email phone');
  
  const responseOrder = {
    ...populatedOrder.toObject(),
    customer: populatedOrder.customer ? {
      ...populatedOrder.customer.toObject(),
      name: Formatters.fullName(populatedOrder.customer.firstName, populatedOrder.customer.lastName),
      phone: Formatters.phone(populatedOrder.customer.phone)
    } : null,
    processingStarted: Formatters.datetime(order.processingStarted)
  };

  ControllerHelpers.sendSuccess(res, {
    order: responseOrder
  }, 'Order claimed successfully');
});

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, workstation } = req.body;
    const operatorId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.assignedOperator?.toString() !== operatorId) {
      return res.status(403).json({ error: 'Not authorized to update this order' });
    }

    // Validate status transition
    const validTransitions = {
      'assigned': ['washing'],
      'washing': ['drying'],
      'drying': ['folding'],
      'folding': ['quality_check'],
      'quality_check': ['ready', 'washing'] // Can send back for reprocessing
    };

    if (!validTransitions[order.orderProcessingStatus]?.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${order.orderProcessingStatus} to ${status}`
      });
    }

    // Update order
    order.orderProcessingStatus = status;
    if (notes) order.operatorNotes = notes;

    // Update workstation if changed
    if (workstation && status === 'washing') {
      const operator = await Operator.findById(operatorId);
      operator.workStation = workstation;
      await operator.save();
    }

    // Complete processing if ready
    if (status === 'ready') {
      order.processingCompleted = new Date();
      order.processingTimeMinutes = Math.round(
        (order.processingCompleted - order.processingStarted) / (1000 * 60)
      );
    }

    await order.save();

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      orderNumber: order.orderNumber,
      oldStatus: order.orderProcessingStatus,
      newStatus: status
    }, req);

    res.json({
      message: 'Order status updated',
      order: await order.populate('customer', 'firstName lastName email phone')
    });
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Perform quality check
exports.performQualityCheck = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { passed, notes, issues } = req.body;
    const operatorId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.orderProcessingStatus !== 'quality_check') {
      return res.status(400).json({ error: 'Order not ready for quality check' });
    }

    // Update order
    order.qualityCheckPassed = passed;
    order.qualityCheckBy = operatorId;
    order.qualityCheckNotes = notes;

    if (passed) {
      order.orderProcessingStatus = 'ready';
      order.processingCompleted = new Date();
      order.processingTimeMinutes = Math.round(
        (order.processingCompleted - order.processingStarted) / (1000 * 60)
      );
    } else {
      // Send back for reprocessing
      order.orderProcessingStatus = 'washing';
      if (issues) {
        order.operatorNotes = `Quality issues: ${issues}. ${order.operatorNotes || ''}`;
      }
    }

    await order.save();

    // Update operator quality score
    const operator = await Operator.findById(order.assignedOperator);
    if (operator && passed) {
      const qualityChecks = await Order.countDocuments({
        assignedOperator: operator._id,
        qualityCheckPassed: { $ne: null }
      });
      const passedChecks = await Order.countDocuments({
        assignedOperator: operator._id,
        qualityCheckPassed: true
      });
      operator.qualityScore = Math.round((passedChecks / qualityChecks) * 100);
      await operator.save();
    }

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      orderNumber: order.orderNumber,
      action: 'quality_check',
      passed,
      issues
    }, req);

    res.json({
      message: `Quality check ${passed ? 'passed' : 'failed'}`,
      order: await order.populate('customer', 'firstName lastName email phone')
    });
  } catch (error) {
    logger.error('Error performing quality check:', error);
    res.status(500).json({ error: 'Failed to perform quality check' });
  }
};

// Get my orders
exports.getMyOrders = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const query = { assignedOperator: operatorId };

    if (status) {
      query.orderProcessingStatus = status;
    }

    if (dateFrom || dateTo) {
      query.processingStarted = {};
      if (dateFrom) query.processingStarted.$gte = new Date(dateFrom);
      if (dateTo) query.processingStarted.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'firstName lastName email phone')
        .sort({ processingStarted: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query)
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching operator orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Get workstation status
exports.getWorkstationStatus = async (req, res) => {
  try {
    const workstations = ['W1', 'W2', 'W3', 'W4', 'W5', 'D1', 'D2', 'D3', 'F1', 'F2'];

    const status = await Promise.all(workstations.map(async (workstation) => {
      const operator = await Operator.findOne({
        workStation: workstation,
        isActive: true
      }).select('firstName lastName operatorId');

      const activeOrders = await Order.countDocuments({
        assignedOperator: operator?._id,
        orderProcessingStatus: { $in: ['washing', 'drying', 'folding'] }
      });

      return {
        workstation,
        type: workstation.startsWith('W') ? 'washing' :
          workstation.startsWith('D') ? 'drying' : 'folding',
        operator: operator ? {
          name: `${operator.firstName} ${operator.lastName}`,
          operatorId: operator.operatorId
        } : null,
        activeOrders,
        available: !operator || activeOrders < 3
      };
    }));

    res.json({ workstations: status });
  } catch (error) {
    logger.error('Error fetching workstation status:', error);
    res.status(500).json({ error: 'Failed to fetch workstation status' });
  }
};

// Update shift status
exports.updateShiftStatus = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { action, workstation } = req.body;

    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    if (action === 'start') {
      if (!workstation) {
        return res.status(400).json({ error: 'Workstation required to start shift' });
      }

      // Check if workstation is available
      const existing = await Operator.findOne({
        workStation: workstation,
        _id: { $ne: operatorId }
      });

      if (existing) {
        return res.status(400).json({ error: 'Workstation already occupied' });
      }

      operator.workStation = workstation;
      operator.updatedAt = new Date();
    } else if (action === 'end') {
      // Check for incomplete orders
      const incompleteOrders = await Order.countDocuments({
        assignedOperator: operatorId,
        orderProcessingStatus: { $nin: ['completed', 'ready'] }
      });

      if (incompleteOrders > 0) {
        return res.status(400).json({
          error: `Cannot end shift with ${incompleteOrders} incomplete orders`
        });
      }

      operator.workStation = null;
      operator.updatedAt = new Date();
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await operator.save();

    await logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
      operatorId,
      action: `shift_${action}`,
      workstation,
      timestamp: new Date()
    }, req);

    res.json({
      message: `Shift ${action}ed successfully`,
      operator: {
        workStation: operator.workStation,
        updatedAt: operator.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error updating shift status:', error);
    res.status(500).json({ error: 'Failed to update shift status' });
  }
};

// Get performance stats
exports.getPerformanceStats = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { period = 'week' } = req.query;

    const operator = await Operator.findById(operatorId);
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    }

    // Get performance metrics
    const stats = await Order.aggregate([
      {
        $match: {
          assignedOperator: operator._id,
          processingStarted: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$orderProcessingStatus', 'completed'] }, 1, 0] }
          },
          totalWeight: { $sum: '$weight' },
          avgProcessingTime: { $avg: '$processingTimeMinutes' },
          minProcessingTime: { $min: '$processingTimeMinutes' },
          maxProcessingTime: { $max: '$processingTimeMinutes' },
          qualityChecksPassed: {
            $sum: { $cond: [{ $eq: ['$qualityCheckPassed', true] }, 1, 0] }
          },
          qualityChecksFailed: {
            $sum: { $cond: [{ $eq: ['$qualityCheckPassed', false] }, 1, 0] }
          }
        }
      }
    ]);

    // Get daily breakdown
    const dailyStats = await Order.aggregate([
      {
        $match: {
          assignedOperator: operator._id,
          processingStarted: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$processingStarted' } },
          orders: { $sum: 1 },
          weight: { $sum: '$weight' },
          avgTime: { $avg: '$processingTimeMinutes' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      operator: {
        name: `${operator.firstName} ${operator.lastName}`,
        operatorId: operator.operatorId,
        qualityScore: operator.qualityScore
      },
      period: {
        start: startDate,
        end: endDate,
        days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      },
      summary: stats[0] || {
        totalOrders: 0,
        completedOrders: 0,
        totalWeight: 0,
        avgProcessingTime: 0,
        minProcessingTime: 0,
        maxProcessingTime: 0,
        qualityChecksPassed: 0,
        qualityChecksFailed: 0
      },
      dailyBreakdown: dailyStats,
      efficiency: {
        ordersPerDay: stats[0] ?
          (stats[0].totalOrders / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))) : 0,
        weightPerDay: stats[0] ?
          (stats[0].totalWeight / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))) : 0,
        qualityRate: stats[0] && (stats[0].qualityChecksPassed + stats[0].qualityChecksFailed) > 0 ?
          Math.round((stats[0].qualityChecksPassed /
            (stats[0].qualityChecksPassed + stats[0].qualityChecksFailed)) * 100) : 100
      }
    });
  } catch (error) {
    logger.error('Error fetching performance stats:', error);
    res.status(500).json({ error: 'Failed to fetch performance stats' });
  }
};

// Get customer details
exports.getCustomerDetails = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId)
      .select('firstName lastName email phone address preferences notes');

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get customer order history
    const recentOrders = await Order.find({ customer: customerId })
      .select('orderNumber scheduledPickup weight totalAmount orderProcessingStatus')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      customer,
      recentOrders
    });
  } catch (error) {
    logger.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
};

// Add customer note
exports.addCustomerNote = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { note } = req.body;
    const operatorId = req.user.id;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Add note with operator info
    const operatorNote = {
      note,
      addedBy: operatorId,
      addedAt: new Date()
    };

    if (!customer.notes) {
      customer.notes = [];
    }
    customer.notes.push(operatorNote);
    await customer.save();

    await logAuditEvent(AuditEvents.ACCOUNT_UPDATED, {
      operatorId,
      action: 'customer_note_added',
      customerId,
      note: note.substring(0, 100) // Log first 100 chars
    }, req);

    res.json({
      message: 'Note added successfully',
      customer: {
        id: customer._id,
        notes: customer.notes
      }
    });
  } catch (error) {
    logger.error('Error adding customer note:', error);
    res.status(500).json({ error: 'Failed to add customer note' });
  }
};

// Scan customer card
exports.scanCustomer = async (req, res) => {
  try {
    let { customerId, bagId } = req.body;
    const operatorId = req.user.id;

    console.log('scanCustomer called with:', { customerId, bagId });

    // Handle QR code format: cust-UUID-bagNumber or CUST-UUID-bagNumber
    let cleanCustomerId = customerId;
    let extractedBagNumber = null;
    
    // Check if the customerId has a bag number suffix (e.g., -1, -2, etc.)
    const bagNumberMatch = customerId.match(/^(cust-[a-f0-9-]+)-(\d+)$/i);
    if (bagNumberMatch) {
      cleanCustomerId = bagNumberMatch[1];
      extractedBagNumber = parseInt(bagNumberMatch[2]);
      console.log(`Extracted customer ID: ${cleanCustomerId}, bag number: ${extractedBagNumber}`);
    }
    
    // Normalize the customer ID format (handle case differences)
    // Convert to uppercase CUST and lowercase UUID
    cleanCustomerId = cleanCustomerId.replace(/^cust-/i, 'CUST-').toLowerCase();
    cleanCustomerId = cleanCustomerId.replace(/^cust-/, 'CUST-'); // Ensure CUST is uppercase
    
    console.log(`Normalized customer ID: ${cleanCustomerId}`);

    // Find customer (case-insensitive search as fallback)
    let customer = await Customer.findOne({ customerId: cleanCustomerId });
    
    // If not found, try case-insensitive search
    if (!customer) {
      customer = await Customer.findOne({ 
        customerId: { $regex: new RegExp('^' + cleanCustomerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      });
    }
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        message: 'Invalid customer ID',
        searchedId: cleanCustomerId,
        originalId: customerId
      });
    }

    // Find current active order for this customer
    const currentOrder = await Order.findOne({
      customerId: customer.customerId,
      status: { $in: ['pending', 'processing', 'processed'] }
    })
    .sort({ createdAt: -1 });

    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        error: 'No active order',
        message: 'No active order found for this customer',
        customer: {
          name: `${customer.firstName} ${customer.lastName}`,
          customerId: customer.customerId
        }
      });
    }

    // Determine action based on order status and bags processed
    let action;
    if (currentOrder.bagsWeighed < currentOrder.numberOfBags) {
      // Not all bags weighed yet - first scan
      action = 'weight_input';
    } else if (currentOrder.bagsProcessed < currentOrder.numberOfBags) {
      // All bags weighed but not all processed - second scan after WDF
      action = 'process_complete';
    } else if (currentOrder.bagsPickedUp < currentOrder.numberOfBags) {
      // All bags processed, ready for pickup - third scan
      action = 'pickup_scan';
    } else {
      action = 'status_check';
    }

    // Get affiliate name if needed
    let affiliateName = 'N/A';
    if (currentOrder.affiliateId) {
      const Affiliate = require('../models/Affiliate');
      const affiliate = await Affiliate.findOne({ affiliateId: currentOrder.affiliateId });
      if (affiliate) {
        affiliateName = affiliate.businessName;
      }
    }

    // Handle bag registration if we have a bagId or extracted bag number
    let bagRegistered = false;
    let bagAlreadyExists = false;
    
    if (bagId || extractedBagNumber) {
      // Generate bagId if we only have a bag number
      if (!bagId && extractedBagNumber) {
        bagId = `${currentOrder.orderId}-BAG${extractedBagNumber}`;
      }
      
      // Initialize bags array if it doesn't exist
      if (!currentOrder.bags) {
        currentOrder.bags = [];
      }
      
      // Check if this bag already exists in the order
      const existingBag = currentOrder.bags.find(b => b.bagId === bagId);
      
      if (!existingBag) {
        // Add the bag to the order
        const newBag = {
          bagId: bagId,
          bagNumber: extractedBagNumber || currentOrder.bags.length + 1,
          status: 'processing',
          weight: 0,
          scannedAt: {
            processing: new Date()
          },
          scannedBy: {
            processing: operatorId
          }
        };
        
        currentOrder.bags.push(newBag);
        await currentOrder.save();
        bagRegistered = true;
        
        console.log(`Bag ${bagId} registered for order ${currentOrder.orderId}. Total bags scanned: ${currentOrder.bags.length}/${currentOrder.numberOfBags}`);
      } else {
        bagAlreadyExists = true;
        console.log(`Bag ${bagId} already exists in order ${currentOrder.orderId}`);
      }
    }
    
    // Update action based on current bag count
    if (currentOrder.bags && currentOrder.bags.length === currentOrder.numberOfBags && currentOrder.bagsWeighed < currentOrder.numberOfBags) {
      // All bags scanned, ready for weight input
      action = 'weight_input';
    } else if (currentOrder.bags && currentOrder.bags.length < currentOrder.numberOfBags) {
      // Still need more bags to be scanned
      action = 'scan_required';
    }

    // Format response
    const response = {
      success: true,
      currentOrder: true,
      action,
      bagRegistered: bagRegistered,
      bagAlreadyExists: bagAlreadyExists,
      order: {
        orderId: currentOrder.orderId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        affiliateName: affiliateName,
        numberOfBags: currentOrder.numberOfBags,
        bagsScanned: currentOrder.bags ? currentOrder.bags.length : 0,
        bagsWeighed: currentOrder.bagsWeighed,
        bagsProcessed: currentOrder.bagsProcessed,
        bagsPickedUp: currentOrder.bagsPickedUp,
        estimatedWeight: currentOrder.estimatedWeight,
        actualWeight: currentOrder.actualWeight,
        status: currentOrder.status,
        bags: currentOrder.bags || [], // Include bags array
        addOns: currentOrder.addOns, // Include addOns
        addOnTotal: currentOrder.addOnTotal // Include addOn total
      }
    };
    
    // If bagId was provided, include it in response
    if (bagId) {
      response.scannedBagId = bagId;
    }

    await logAuditEvent(AuditEvents.SENSITIVE_DATA_ACCESS, {
      operatorId,
      customerId: customer.customerId,
      orderId: currentOrder.orderId,
      action: 'customer_card_scanned',
      scanAction: action
    }, req);

    res.json(response);
  } catch (error) {
    console.error('Error in scanCustomer:', error);
    if (logger && logger.error) {
      logger.error('Error scanning customer card:', error);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to scan customer card',
      message: 'An error occurred while processing the scan'
    });
  }
};

// Scan bag for processing (new format: customerId#bagId)
exports.scanBag = async (req, res) => {
  try {
    const { qrCode } = req.body;
    
    // Parse QR code format: customerId#bagId
    if (!qrCode || !qrCode.includes('#')) {
      // Legacy format - just customer ID
      req.body.customerId = qrCode || req.body.bagId;
      return exports.scanCustomer(req, res);
    }
    
    const [customerId, bagId] = qrCode.split('#');
    
    // Find customer
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        message: 'Invalid customer ID'
      });
    }
    
    // Find current active order for this customer
    const currentOrder = await Order.findOne({
      customerId: customer.customerId,
      status: { $in: ['pending', 'processing', 'processed'] }
    })
    .sort({ createdAt: -1 })
    .populate('customer', 'firstName lastName phone email address');
    
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        error: 'No active order',
        message: 'No active order found for this customer'
      });
    }
    
    // Return order info with bag data
    return res.json({
      success: true,
      order: currentOrder,
      customer: currentOrder.customer,
      bagId: bagId,
      action: 'show_order'
    });
    
  } catch (error) {
    logger.error('Error scanning bag:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scan bag',
      message: 'An error occurred while processing the scan' 
    });
  }
};

// Receive order with weights
exports.receiveOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { bagWeights, totalWeight } = req.body;
    const operatorId = req.user.id;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update order with actual weight and bag tracking
    order.actualWeight = totalWeight;
    order.status = 'processing';
    order.assignedOperator = operatorId;
    order.processingStarted = new Date();
    order.processingStartedAt = new Date();
    
    // Add to existing bags weighed count
    const existingBagsWeighed = order.bagsWeighed || 0;
    order.bagsWeighed = existingBagsWeighed + bagWeights.length;
    
    // Append to existing bag weights array or create new one
    if (!order.bagWeights) {
      order.bagWeights = [];
    }
    
    // Add new bag weights
    bagWeights.forEach(bw => {
      order.bagWeights.push({
        bagNumber: bw.bagNumber,
        weight: bw.weight,
        receivedAt: new Date()
      });
    });
    
    await order.save();

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'order_received',
      totalWeight,
      numberOfBags: bagWeights.length,
      newStatus: 'processing'
    }, req);

    res.json({
      success: true,
      message: 'Order received and marked as in progress',
      order
    });
  } catch (error) {
    logger.error('Error receiving order:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to receive order' 
    });
  }
};

// New endpoint for weighing bags with bag tracking
exports.weighBags = async (req, res) => {
  try {
    const { bags, orderId } = req.body;
    const operatorId = req.user.id;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update weights for existing bags or add new ones
    for (const bagData of bags) {
      // Check if bag already exists in order
      const existingBagIndex = order.bags.findIndex(b => b.bagId === bagData.bagId);
      
      if (existingBagIndex >= 0) {
        // Update existing bag with weight
        order.bags[existingBagIndex].weight = bagData.weight;
        order.bags[existingBagIndex].status = 'processing';
        if (!order.bags[existingBagIndex].scannedAt.processing) {
          order.bags[existingBagIndex].scannedAt.processing = new Date();
        }
        if (!order.bags[existingBagIndex].scannedBy.processing) {
          order.bags[existingBagIndex].scannedBy.processing = operatorId;
        }
      } else {
        // Add new bag if it doesn't exist
        order.bags.push({
          bagId: bagData.bagId,
          bagNumber: order.bags.length + 1,
          status: 'processing',
          weight: bagData.weight,
          scannedAt: {
            processing: new Date()
          },
          scannedBy: {
            processing: operatorId
          }
        });
      }
    }
    
    // Calculate total weight from all bags
    const totalWeight = order.bags.reduce((sum, bag) => sum + (bag.weight || 0), 0);
    
    // Update order with actual weight
    order.actualWeight = totalWeight;
    order.status = 'processing';
    order.assignedOperator = operatorId;
    
    if (!order.processingStartedAt) {
      order.processingStartedAt = new Date();
    }
    
    // Update bag counts
    order.bagsWeighed = order.bags.filter(b => b.weight > 0).length;
    
    // Save order first to calculate v2PaymentAmount
    await order.save();
    
    // V2 Payment Flow: Send payment request if all bags are weighed
    if (order.bagsWeighed === order.numberOfBags) {
      // Calculate weight difference for reference
      order.weightDifference = order.actualWeight - order.estimatedWeight;
      
      // Get customer for payment request
      const customer = await Customer.findOne({ customerId: order.customerId });
      if (customer) {
        // Use actualTotal if v2PaymentAmount is not set
        const paymentAmount = order.v2PaymentAmount || order.actualTotal || 
                            (order.actualWeight * (order.baseRate || 1.25) + (order.addOnTotal || 0));
        
        // Generate payment URLs and QR codes with correct amount
        const paymentURLs = await generatePaymentURLs({...order.toObject(), v2PaymentAmount: paymentAmount});
        order.v2PaymentLinks = paymentURLs.links;
        order.v2PaymentQRCodes = paymentURLs.qrCodes;
        order.v2PaymentStatus = 'awaiting';
        order.v2PaymentRequestedAt = new Date();
        order.v2PaymentAmount = paymentAmount; // Ensure it's set
        
        // Save again with payment info
        await order.save();
        
        // Send payment request email
        await emailService.sendV2PaymentRequest({
          customer,
          order,
          paymentAmount: paymentAmount,
          paymentLinks: paymentURLs.links,
          qrCodes: paymentURLs.qrCodes
        });
        
        logger.info(`V2 Payment request sent for order ${order.orderId}, amount: $${paymentAmount}`);
      }
    }

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'bags_weighed',
      totalWeight: order.actualWeight,
      numberOfBags: order.bags.length,
      newBags: bags.length
    }, req);

    // Return updated order with bag progress
    res.json({
      success: true,
      order: order,
      orderProgress: {
        totalBags: order.bags.length,
        bagsWeighed: order.bags.length,
        bagsProcessed: order.bags.filter(b => b.status === 'processed').length,
        bagsCompleted: order.bags.filter(b => b.status === 'completed').length
      },
      message: 'Bags weighed successfully'
    });
  } catch (error) {
    logger.error('Error weighing bags:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to weigh bags' 
    });
  }
};

// Mark bag as processed after WDF
exports.markBagProcessed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const operatorId = req.user.id;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Increment processed bags count
    order.bagsProcessed = Math.min((order.bagsProcessed || 0) + 1, order.numberOfBags);
    
    // Check if all bags are now processed
    if (order.bagsProcessed === order.numberOfBags) {
      // All bags processed, update order status
      order.processedAt = new Date();
      order.status = 'processed';
      
      // Notify affiliate that order is ready for pickup
      const emailService = require('../utils/emailService');
      if (order.affiliateId) {
        // Manually fetch affiliate and customer data
        const Affiliate = require('../models/Affiliate');
        const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
        
        let customerName = 'N/A';
        if (order.customerId) {
          const customer = await Customer.findOne({ customerId: order.customerId });
          if (customer) {
            customerName = `${customer.firstName} ${customer.lastName}`;
          }
        }
        
        if (affiliate && affiliate.email) {
          await emailService.sendOrderReadyNotification(
            affiliate.email,
            {
              affiliateName: affiliate.contactPerson || affiliate.businessName,
              orderId: order.orderId,
              customerName: customerName,
              numberOfBags: order.numberOfBags,
              totalWeight: order.actualWeight
            }
          );
        }
      }
    }
    
    await order.save();

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'bag_processed',
      bagNumber: order.bagsProcessed,
      totalBags: order.numberOfBags,
      allBagsProcessed: order.bagsProcessed === order.numberOfBags,
      affiliateNotified: order.bagsProcessed === order.numberOfBags
    }, req);

    res.json({
      success: true,
      message: `Bag ${order.bagsProcessed} of ${order.numberOfBags} marked as processed`,
      bagsProcessed: order.bagsProcessed,
      totalBags: order.numberOfBags,
      orderReady: order.bagsProcessed === order.numberOfBags
    });
  } catch (error) {
    logger.error('Error marking bag as processed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark bag as processed' 
    });
  }
};

// New endpoint for scanning processed bags
exports.scanProcessed = async (req, res) => {
  try {
    const { qrCode } = req.body;
    const operatorId = req.user.id;
    
    console.log('scanProcessed called with:', { qrCode, operatorId });
    
    // Parse QR code format: customerId#bagId
    if (!qrCode || !qrCode.includes('#')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR code format',
        message: 'Expected format: customerId#bagId'
      });
    }
    
    const [customerId, bagId] = qrCode.split('#');
    
    // Find order containing this bag
    const order = await Order.findOne({
      customerId: customerId,
      'bags.bagId': bagId,
      status: { $in: ['processing', 'processed'] }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Bag not found',
        message: 'This bag is not associated with any active order'
      });
    }
    
    // Fetch customer data separately since Order doesn't have a customer reference
    const customer = await Customer.findOne({ customerId: order.customerId });
    if (customer) {
      order.customer = customer; // Attach customer to order for email sending
    }
    
    // Find the specific bag
    const bag = order.bags.find(b => b.bagId === bagId);
    
    // Check bag status
    if (bag.status === 'processed') {
      // Check if all bags are processed
      const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'completed');
      
      if (allBagsProcessed) {
        // Show pickup modal
        return res.json({
          success: true,
          action: 'show_pickup_modal',
          order: order,
          allBagsProcessed: true,
          message: 'All bags processed - ready for pickup'
        });
      } else {
        // Show warning - bag already processed
        const remainingBags = order.bags.filter(b => b.status === 'processing').length;
        return res.json({
          success: false,
          warning: 'duplicate_scan',
          message: `This bag has already been processed. ${remainingBags} bags still need processing.`,
          bag: {
            bagId: bag.bagId,
            bagNumber: bag.bagNumber,
            status: bag.status,
            processedAt: bag.scannedAt.processed
          },
          remainingCount: remainingBags
        });
      }
    }
    
    // Update bag to processed
    bag.status = 'processed';
    bag.scannedAt.processed = new Date();
    bag.scannedBy.processed = operatorId;
    
    // Update order counts
    order.bagsProcessed = order.bags.filter(b => b.status === 'processed' || b.status === 'completed').length;
    
    // Check if all bags are now processed
    const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'completed');
    
    if (allBagsProcessed) {
      // All bags processed, update order status
      order.processedAt = new Date();
      order.status = 'processed';
      
      // V2 Payment Flow: Check payment status before sending notifications
      // Payment is considered received if status is NOT 'pending' (i.e., payment has been initiated)
      if (order.v2PaymentStatus !== 'pending') {
        // Payment received - send ready for pickup notification to affiliate ONLY
        const emailService = require('../utils/emailService');

        // Notify affiliate that order is ready for pickup (NOT commission email)
        if (order.affiliateId) {
          const Affiliate = require('../models/Affiliate');
          const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });

          if (affiliate && affiliate.email) {
            // Send ready for pickup notification (not commission email)
            await emailService.sendOrderReadyNotification(affiliate.email, {
              orderId: order.orderId,
              customerName: `${order.customer.firstName} ${order.customer.lastName}`,
              customerPhone: order.customer.phone,
              numberOfBags: order.numberOfBags,
              totalWeight: order.actualWeight,
              finalTotal: order.actualTotal || order.estimatedTotal,
              address: `${order.customer.address.street}, ${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.zip}`
            });
            
            logger.info(`Ready for pickup notification sent to affiliate ${affiliate.email} for order ${order.orderId}`);
          }
        }
        // Do NOT notify customer yet - wait until affiliate picks up
      } else {
        // Payment not received - send payment reminder
        await sendPaymentReminder(order);
        
        logger.info(`Order ${order.orderId} processed but awaiting payment. Reminder sent.`);
      }
    }
    
    await order.save();
    
    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId: order.orderId,
      action: 'bag_processed',
      bagId: bagId,
      bagNumber: bag.bagNumber,
      bagsProcessed: order.bagsProcessed,
      totalBags: order.bags.length,
      allBagsProcessed: allBagsProcessed
    }, req);
    
    // Return appropriate response
    if (allBagsProcessed) {
      return res.json({
        success: true,
        action: 'show_pickup_modal',
        order: order,
        allBagsProcessed: true,
        message: 'All bags processed - ready for pickup'
      });
    } else {
      return res.json({
        success: true,
        order: order,
        bag: {
          bagId: bag.bagId,
          bagNumber: bag.bagNumber,
          status: bag.status,
          weight: bag.weight
        },
        orderProgress: {
          totalBags: order.bags.length,
          bagsWeighed: order.bags.length,
          bagsProcessed: order.bagsProcessed,
          bagsCompleted: order.bags.filter(b => b.status === 'completed').length
        },
        message: `Bag ${bag.bagNumber} marked as processed`
      });
    }
    
  } catch (error) {
    console.error('Error in scanProcessed:', error);
    logger.error('Error scanning processed bag:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to scan processed bag',
      message: error.message 
    });
  }
};

// Mark order as ready for pickup (deprecated - use scanProcessed instead)
exports.markOrderReady = async (req, res) => {
  try {
    const { orderId } = req.params;
    const operatorId = req.user.id;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update order status
    order.processedAt = new Date();
    order.status = 'processed';
    order.bagsProcessed = order.numberOfBags; // All bags are processed
    await order.save();

    // Only notify affiliate when ALL bags are processed
    const emailService = require('../utils/emailService');
    if (order.affiliateId && order.bagsProcessed === order.numberOfBags) {
      // Manually fetch affiliate and customer data
      const Affiliate = require('../models/Affiliate');
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      
      let customerName = 'N/A';
      if (order.customerId) {
        const customer = await Customer.findOne({ customerId: order.customerId });
        if (customer) {
          customerName = `${customer.firstName} ${customer.lastName}`;
        }
      }
      
      if (affiliate && affiliate.email) {
        await emailService.sendOrderReadyNotification(
          affiliate.email,
          {
            affiliateName: affiliate.contactPerson || affiliate.businessName,
            orderId: order.orderId,
            customerName: customerName,
            numberOfBags: order.numberOfBags,
            totalWeight: order.actualWeight
          }
        );
      }
    }

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'order_marked_ready',
      affiliateNotified: order.bagsProcessed === order.numberOfBags,
      bagsProcessed: order.bagsProcessed,
      totalBags: order.numberOfBags,
      newStatus: 'ready'
    }, req);

    res.json({
      success: true,
      message: 'Order marked as ready for pickup',
      order
    });
  } catch (error) {
    logger.error('Error marking order ready:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark order as ready' 
    });
  }
};

// New endpoint for completing pickup with bag verification
exports.completePickup = async (req, res) => {
  try {
    const { bagIds, orderId } = req.body;
    const operatorId = req.user.id;

    console.log('completePickup called with:', { bagIds, orderId, operatorId });

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // CRITICAL SECURITY: Verify payment before allowing pickup
    // V2 orders: Block only when v2PaymentStatus is 'pending' (payment not initiated)
    // Regular orders: Require paymentStatus='paid' or isPaid=true
    const isV2Blocked = order.isV2Order && order.v2PaymentStatus === 'pending';
    const isRegularPaid = !order.isV2Order && (order.paymentStatus === 'paid' || order.isPaid === true);

    if (isV2Blocked || (!order.isV2Order && !isRegularPaid)) {
      console.log('PAYMENT VERIFICATION FAILED - BLOCKING PICKUP');
      console.log('Order:', orderId);
      console.log('Is V2 Order:', order.isV2Order);
      console.log('V2 Payment Status:', order.v2PaymentStatus);
      console.log('V2 Blocked (pending):', isV2Blocked);
      console.log('Payment Status:', order.paymentStatus);
      console.log('Is Paid:', order.isPaid);

      return res.status(403).json({
        success: false,
        error: 'Payment required',
        message: 'This order cannot be released until payment is received and verified.'
      });
    }

    console.log('Payment verified - proceeding with pickup');

    // Verify all bags are accounted for
    if (bagIds.length !== order.bags.length) {
      return res.status(400).json({
        success: false,
        error: 'Bag count mismatch',
        message: `Expected ${order.bags.length} bags but received ${bagIds.length}`
      });
    }

    // Verify all bag IDs match
    const orderBagIds = new Set(order.bags.map(b => b.bagId));
    const scannedBagIds = new Set(bagIds);
    
    for (const bagId of scannedBagIds) {
      if (!orderBagIds.has(bagId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid bag',
          message: `Bag ${bagId} does not belong to this order`
        });
      }
    }

    // Update all bags to completed
    const now = new Date();
    console.log('Updating bags to completed. Current bag statuses:', order.bags.map(b => ({ bagId: b.bagId, status: b.status })));
    
    for (const bag of order.bags) {
      bag.status = 'completed';
      bag.scannedAt.completed = now;
      bag.scannedBy.completed = operatorId;
    }

    // Update order to completed
    order.status = 'complete';
    order.completedAt = now;
    order.bagsPickedUp = order.bags.length;
    
    console.log('Before save - Order status:', order.status);
    console.log('Before save - Bag statuses:', order.bags.map(b => ({ bagId: b.bagId, status: b.status })));

    try {
      await order.save();
      
      console.log('After save - Order status:', order.status);
      console.log('After save - Bag statuses:', order.bags.map(b => ({ bagId: b.bagId, status: b.status })));
    } catch (saveError) {
      console.error('Error saving order:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save order',
        message: saveError.message
      });
    }

    // Send notifications for completed order
    try {
      const emailService = require('../utils/emailService');
      const Customer = require('../models/Customer');
      const Affiliate = require('../models/Affiliate');
      
      const customer = await Customer.findOne({ customerId: order.customerId });
      
      // Get affiliate information first
      let affiliate = null;
      if (order.affiliateId) {
        affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      }
      
      // 1. Send delivery notification to customer with affiliate info
      if (customer && customer.email) {
        await emailService.sendOrderPickedUpNotification(
          customer.email,
          {
            customerName: `${customer.firstName} ${customer.lastName}`,
            orderId: order.orderId,
            numberOfBags: order.bags.length,
            totalWeight: order.actualWeight,
            affiliateName: affiliate ? (affiliate.contactPerson || affiliate.businessName) : 'Your laundry service provider',
            businessName: affiliate ? affiliate.businessName : null
          }
        );
        console.log(`Delivery notification sent to customer ${customer.email}`);
      }
      
      // 2. Send commission earned notification to affiliate
      if (order.affiliateId && affiliate) {
        
        if (affiliate && affiliate.email) {
          await emailService.sendAffiliateCommissionEmail(
            affiliate,
            order,
            customer
          );
          console.log(`Commission notification sent to affiliate ${affiliate.email}`);
        }
      }
    } catch (emailError) {
      console.error('Error sending email notifications:', emailError);
      // Don't fail the whole operation if email fails
    }

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'order_picked_up',
      numberOfBags: order.bags.length,
      newStatus: 'complete'
    }, req);

    res.json({
      success: true,
      message: 'Order completed successfully',
      orderComplete: true,
      order: order
    });
  } catch (error) {
    console.error('Error in completePickup:', error);
    console.error('Error stack:', error.stack);
    logger.error('Error completing pickup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete pickup',
      message: error.message
    });
  }
};

// Confirm pickup by affiliate (legacy)
exports.confirmPickup = async (req, res) => {
  try {
    const { orderId, numberOfBags } = req.body;
    const operatorId = req.user.id;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // CRITICAL SECURITY: Verify payment before allowing pickup
    // V2 orders: Block only when v2PaymentStatus is 'pending' (payment not initiated)
    // Regular orders: Require paymentStatus='paid' or isPaid=true
    const isV2Blocked = order.isV2Order && order.v2PaymentStatus === 'pending';
    const isRegularPaid = !order.isV2Order && (order.paymentStatus === 'paid' || order.isPaid === true);

    if (isV2Blocked || (!order.isV2Order && !isRegularPaid)) {
      console.log('PAYMENT VERIFICATION FAILED - BLOCKING PICKUP (Legacy endpoint)');
      console.log('Order:', orderId);
      console.log('Is V2 Order:', order.isV2Order);
      console.log('V2 Payment Status:', order.v2PaymentStatus);
      console.log('V2 Blocked (pending):', isV2Blocked);
      console.log('Payment Status:', order.paymentStatus);
      console.log('Is Paid:', order.isPaid);

      return res.status(403).json({
        success: false,
        error: 'Payment required',
        message: 'This order cannot be released until payment is received and verified.'
      });
    }

    console.log('Payment verified - proceeding with pickup (Legacy endpoint)');

    // Update bags picked up count
    const bagsToPickup = numberOfBags || 1; // Default to 1 if not specified
    order.bagsPickedUp = Math.min(order.bagsPickedUp + bagsToPickup, order.numberOfBags);

    // Check if all bags have been picked up
    if (order.bagsPickedUp >= order.numberOfBags) {
      // All bags picked up, complete the order
      order.status = 'complete';
      order.completedAt = new Date();

      // Notify customer with affiliate info
      const emailService = require('../utils/emailService');
      if (order.customerId) {
        const customer = await Customer.findOne({ customerId: order.customerId });
        
        // Get affiliate information
        let affiliate = null;
        if (order.affiliateId) {
          const Affiliate = require('../models/Affiliate');
          affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
        }
        
        if (customer && customer.email) {
          await emailService.sendOrderPickedUpNotification(
            customer.email,
            {
              customerName: `${customer.firstName} ${customer.lastName}`,
              orderId: order.orderId,
              numberOfBags: order.numberOfBags,
              totalWeight: order.actualWeight,
              affiliateName: affiliate ? (affiliate.contactPerson || affiliate.businessName) : 'Your laundry service provider',
              businessName: affiliate ? affiliate.businessName : null
            }
          );
        }
      }
    }

    await order.save();

    await logAuditEvent(AuditEvents.ORDER_STATUS_CHANGED, {
      operatorId,
      orderId,
      action: 'bags_pickup_confirmed',
      bagsPickedUp: bagsToPickup,
      totalBagsPickedUp: order.bagsPickedUp,
      orderComplete: order.status === 'complete',
      newStatus: order.status
    }, req);

    res.json({
      success: true,
      message: 'Pickup confirmed',
      bagsPickedUp: order.bagsPickedUp,
      totalBags: order.numberOfBags,
      orderComplete: order.status === 'complete'
    });
  } catch (error) {
    logger.error('Error confirming pickup:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to confirm pickup' 
    });
  }
};

// Get today's stats for scanner interface
exports.getTodayStats = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get orders that have been scanned/weighed today
    // Include orders where:
    // 1. Assigned to this operator OR
    // 2. Have bags weighed today (updatedAt >= today and bagsWeighed > 0)
    const ordersProcessed = await Order.countDocuments({
      $or: [
        {
          assignedOperator: operatorId,
          processingStarted: { $gte: today }
        },
        {
          bagsWeighed: { $gt: 0 },
          updatedAt: { $gte: today, $lt: tomorrow }
        }
      ]
    });

    // Get total bags scanned today
    // Include all orders with bags weighed today, regardless of operator assignment
    const todayOrders = await Order.find({
      $or: [
        {
          assignedOperator: operatorId,
          processingStarted: { $gte: today }
        },
        {
          bagsWeighed: { $gt: 0 },
          updatedAt: { $gte: today, $lt: tomorrow }
        }
      ]
    });
    
    const bagsScanned = todayOrders.reduce((total, order) => total + (order.bagsWeighed || 0), 0);

    // Get orders ready for pickup today (processed status means ready for pickup)
    const ordersReady = await Order.countDocuments({
      status: 'processed',
      updatedAt: { $gte: today }
    });

    res.json({
      ordersProcessed,
      bagsScanned,
      ordersReady
    });
  } catch (error) {
    logger.error('Error fetching today stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get count of new customers without bag labels
exports.getNewCustomersCount = async (req, res) => {
  try {
    const count = await Customer.countDocuments({
      bagLabelsGenerated: false
      // Removed isActive check - customers may need labels printed before activation
    });
    
    res.json({ 
      success: true,
      count 
    });
  } catch (error) {
    console.error('Get new customers count error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching new customers count' 
    });
  }
};

// Print bag labels for new customers
exports.printNewCustomerLabels = async (req, res) => {
  try {
    const operatorId = req.user.id;
    
    // Get all customers without bag labels
    const customers = await Customer.find({
      bagLabelsGenerated: false
      // Removed isActive check - customers may need labels printed before activation
    }).select('customerId firstName lastName phone email numberOfBags affiliateId');
    
    if (customers.length === 0) {
      return res.json({
        success: true,
        message: 'No new customers found',
        customersProcessed: 0,
        labelsGenerated: 0
      });
    }
    
    // Generate label data for each customer
    const labelData = [];
    let totalLabels = 0;
    
    for (const customer of customers) {
      const bagCount = customer.numberOfBags || 1;
      
      // Generate label for each bag
      for (let bagNumber = 1; bagNumber <= bagCount; bagNumber++) {
        labelData.push({
          customerId: customer.customerId,
          customerName: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone || '',
          email: customer.email || '',
          bagNumber: bagNumber,
          totalBags: bagCount,
          qrCode: `${customer.customerId}-${bagNumber}`,
          affiliateId: customer.affiliateId
        });
        totalLabels++;
      }
    }
    
    // Don't update customers yet - wait for print confirmation
    // Return the label data and customer IDs for later confirmation
    const customerIds = customers.map(c => c._id);
    
    res.json({
      success: true,
      message: `Generated ${totalLabels} labels for ${customers.length} customers`,
      customersProcessed: customers.length,
      labelsGenerated: totalLabels,
      labelData: labelData,
      customerIds: customerIds // Send IDs for confirmation endpoint
    });
    
  } catch (error) {
    logger.error('Print new customer labels error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error printing customer labels' 
    });
  }
};// Confirm that labels were printed successfully
exports.confirmLabelsPrinted = async (req, res) => {
  const Customer = require('../models/Customer');
  const logger = require('../utils/logger');
  
  try {
    const { customerIds } = req.body;
    const operatorId = req.user.id;
    
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No customer IDs provided'
      });
    }
    
    // Update customers to mark labels as generated
    const result = await Customer.updateMany(
      { _id: { $in: customerIds } },
      {
        $set: {
          bagLabelsGenerated: true,
          bagLabelsGeneratedAt: new Date(),
          bagLabelsGeneratedBy: operatorId
        }
      }
    );
    
    // Log the successful print
    logger.info(`Operator ${operatorId} confirmed printing labels for ${result.modifiedCount} customers`);
    
    res.json({
      success: true,
      message: `Labels marked as printed for ${result.modifiedCount} customers`,
      customersUpdated: result.modifiedCount
    });
    
  } catch (error) {
    logger.error('Confirm labels printed error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming label printing'
    });
  }
};
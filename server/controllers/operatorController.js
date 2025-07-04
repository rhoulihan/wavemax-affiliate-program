const Operator = require('../models/Operator');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const logger = require('../utils/logger');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

// Get order queue
exports.getOrderQueue = async (req, res) => {
  try {
    const {
      status = 'pending',
      priority,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query;

    const query = { orderProcessingStatus: status };

    if (priority) {
      query.priority = priority;
    }

    if (dateFrom || dateTo) {
      query.scheduledPickup = {};
      if (dateFrom) query.scheduledPickup.$gte = new Date(dateFrom);
      if (dateTo) query.scheduledPickup.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'firstName lastName email phone')
        .populate('assignedOperator', 'firstName lastName operatorId')
        .sort({ priority: -1, scheduledPickup: 1 })
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
    logger.error('Error fetching order queue:', error);
    res.status(500).json({ error: 'Failed to fetch order queue' });
  }
};

// Claim an order
exports.claimOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const operatorId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.assignedOperator) {
      return res.status(400).json({ error: 'Order already assigned' });
    }

    // Check operator availability
    const operator = await Operator.findById(operatorId);
    const activeOrdersCount = await Order.countDocuments({
      assignedOperator: operatorId,
      orderProcessingStatus: { $in: ['assigned', 'washing', 'drying', 'folding'] }
    });

    if (activeOrdersCount >= 3) {
      return res.status(400).json({ error: 'Maximum concurrent orders reached' });
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

    res.json({
      message: 'Order claimed successfully',
      order: await order.populate('customer', 'firstName lastName email phone')
    });
  } catch (error) {
    logger.error('Error claiming order:', error);
    res.status(500).json({ error: 'Failed to claim order' });
  }
};

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
    const { customerId } = req.body;
    const operatorId = req.user.id;

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

    // Format response
    const response = {
      success: true,
      currentOrder: true,
      action,
      order: {
        orderId: currentOrder.orderId,
        customerName: `${customer.firstName} ${customer.lastName}`,
        affiliateName: affiliateName,
        numberOfBags: currentOrder.numberOfBags,
        bagsWeighed: currentOrder.bagsWeighed,
        bagsProcessed: currentOrder.bagsProcessed,
        bagsPickedUp: currentOrder.bagsPickedUp,
        estimatedWeight: currentOrder.estimatedWeight,
        actualWeight: currentOrder.actualWeight,
        status: currentOrder.status
      }
    };

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

// Scan bag for processing (bags have customer ID as QR code)
exports.scanBag = async (req, res) => {
  try {
    const { bagId } = req.body;
    
    // Check if this is a process_complete scan (when action is already determined)
    // Since bags have customer ID as QR code, redirect to scanCustomer
    return exports.scanCustomer(req, res);
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

// Mark order as ready for pickup (deprecated - use markBagProcessed instead)
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

// Confirm pickup by affiliate
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

    // Update bags picked up count
    const bagsToPickup = numberOfBags || 1; // Default to 1 if not specified
    order.bagsPickedUp = Math.min(order.bagsPickedUp + bagsToPickup, order.numberOfBags);

    // Check if all bags have been picked up
    if (order.bagsPickedUp >= order.numberOfBags) {
      // All bags picked up, complete the order
      order.status = 'complete';
      order.completedAt = new Date();

      // Notify customer
      const emailService = require('../utils/emailService');
      if (order.customerId) {
        const customer = await Customer.findOne({ customerId: order.customerId });
        if (customer && customer.email) {
          await emailService.sendOrderPickedUpNotification(
            customer.email,
            {
              customerName: `${customer.firstName} ${customer.lastName}`,
              orderId: order.orderId,
              numberOfBags: order.numberOfBags
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
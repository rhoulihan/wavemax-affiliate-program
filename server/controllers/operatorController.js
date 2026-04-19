const logger = require('../utils/logger');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');

const orderQueueService = require('../services/operatorOrderQueueService');
const shiftStatsService = require('../services/operatorShiftStatsService');
const supportService = require('../services/operatorSupportService');
const pickupService = require('../services/operatorPickupService');
const bagWorkflowService = require('../services/operatorBagWorkflowService');

// Get order queue
exports.getOrderQueue = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { status = 'pending', priority, dateFrom, dateTo } = req.query;
  const pagination = ControllerHelpers.parsePagination(req.query, { limit: 20 });

  const result = await orderQueueService.getOrderQueue({
    status, priority, dateFrom, dateTo, pagination
  });

  ControllerHelpers.sendSuccess(res, result, 'Order queue retrieved successfully');
});

// Claim an order
exports.claimOrder = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const order = await orderQueueService.claimOrder({
      orderId: req.params.orderId,
      operatorId: req.user.id,
      req
    });
    ControllerHelpers.sendSuccess(res, { order }, 'Order claimed successfully');
  } catch (err) {
    if (err.isQueueError) return ControllerHelpers.sendError(res, err.message, err.status);
    throw err;
  }
});

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await orderQueueService.updateOrderStatus({
      orderId: req.params.orderId,
      operatorId: req.user.id,
      status: req.body.status,
      notes: req.body.notes,
      workstation: req.body.workstation,
      req
    });
    res.json({ message: 'Order status updated', order });
  } catch (err) {
    if (err.isQueueError) return res.status(err.status).json({ error: err.message });
    logger.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// Perform quality check
exports.performQualityCheck = async (req, res) => {
  try {
    const { passed, order } = await supportService.performQualityCheck({
      orderId: req.params.orderId,
      operatorId: req.user.id,
      passed: req.body.passed,
      notes: req.body.notes,
      issues: req.body.issues,
      req
    });
    res.json({ message: `Quality check ${passed ? 'passed' : 'failed'}`, order });
  } catch (err) {
    if (err.isSupportError) return res.status(err.status).json({ error: err.message });
    logger.error('Error performing quality check:', err);
    res.status(500).json({ error: 'Failed to perform quality check' });
  }
};

// Get my orders
exports.getMyOrders = async (req, res) => {
  try {
    const result = await supportService.getMyOrders({
      operatorId: req.user.id,
      ...req.query
    });
    res.json(result);
  } catch (error) {
    logger.error('Error fetching operator orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// Get workstation status
exports.getWorkstationStatus = async (req, res) => {
  try {
    const workstations = await supportService.getWorkstationStatus();
    res.json({ workstations });
  } catch (error) {
    logger.error('Error fetching workstation status:', error);
    res.status(500).json({ error: 'Failed to fetch workstation status' });
  }
};

// Update shift status
exports.updateShiftStatus = async (req, res) => {
  try {
    const operator = await shiftStatsService.updateShiftStatus({
      operatorId: req.user.id,
      action: req.body.action,
      workstation: req.body.workstation,
      req
    });
    res.json({ message: `Shift ${req.body.action}ed successfully`, operator });
  } catch (err) {
    if (err.isShiftError) return res.status(err.status).json({ error: err.message });
    logger.error('Error updating shift status:', err);
    res.status(500).json({ error: 'Failed to update shift status' });
  }
};

// Get performance stats
exports.getPerformanceStats = async (req, res) => {
  try {
    const data = await shiftStatsService.getPerformanceStats({
      operatorId: req.user.id,
      period: req.query.period || 'week'
    });
    res.json(data);
  } catch (err) {
    if (err.isShiftError) return res.status(err.status).json({ error: err.message });
    logger.error('Error fetching performance stats:', err);
    res.status(500).json({ error: 'Failed to fetch performance stats' });
  }
};

// Get customer details
exports.getCustomerDetails = async (req, res) => {
  try {
    const result = await supportService.getCustomerDetails({
      customerId: req.params.customerId
    });
    res.json(result);
  } catch (err) {
    if (err.isSupportError) return res.status(err.status).json({ error: err.message });
    logger.error('Error fetching customer details:', err);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
};

// Add customer note
exports.addCustomerNote = async (req, res) => {
  try {
    const customer = await supportService.addCustomerNote({
      customerId: req.params.customerId,
      note: req.body.note,
      operatorId: req.user.id,
      req
    });
    res.json({ message: 'Note added successfully', customer });
  } catch (err) {
    if (err.isSupportError) return res.status(err.status).json({ error: err.message });
    logger.error('Error adding customer note:', err);
    res.status(500).json({ error: 'Failed to add customer note' });
  }
};

// Scan customer card
exports.scanCustomer = async (req, res) => {
  try {
    const result = await bagWorkflowService.scanCustomer({
      customerId: req.body.customerId,
      bagId: req.body.bagId,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, currentOrder: true, ...result });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error in scanCustomer:', err);
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
    const result = await bagWorkflowService.scanBag({ qrCode: req.body.qrCode });
    if (result.legacy) {
      req.body.customerId = result.customerId || req.body.bagId;
      return exports.scanCustomer(req, res);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error scanning bag:', err);
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
    const order = await bagWorkflowService.receiveOrder({
      orderId: req.params.orderId,
      bagWeights: req.body.bagWeights,
      totalWeight: req.body.totalWeight,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, message: 'Order received and marked as in progress', order });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error receiving order:', err);
    res.status(500).json({ success: false, error: 'Failed to receive order' });
  }
};

// New endpoint for weighing bags with bag tracking
exports.weighBags = async (req, res) => {
  try {
    const { order, orderProgress } = await bagWorkflowService.weighBags({
      orderId: req.body.orderId,
      bags: req.body.bags,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, order, orderProgress, message: 'Bags weighed successfully' });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error weighing bags:', err);
    res.status(500).json({ success: false, error: 'Failed to weigh bags' });
  }
};

// Mark bag as processed after WDF
exports.markBagProcessed = async (req, res) => {
  try {
    const result = await bagWorkflowService.markBagProcessed({
      orderId: req.params.orderId,
      operatorId: req.user.id,
      req
    });
    res.json({
      success: true,
      message: `Bag ${result.bagsProcessed} of ${result.totalBags} marked as processed`,
      ...result
    });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error marking bag as processed:', err);
    res.status(500).json({ success: false, error: 'Failed to mark bag as processed' });
  }
};

// New endpoint for scanning processed bags
exports.scanProcessed = async (req, res) => {
  try {
    const result = await bagWorkflowService.scanProcessed({
      qrCode: req.body.qrCode,
      operatorId: req.user.id,
      req
    });
    if (result.warning) {
      return res.json({ success: false, ...result });
    }
    if (result.action === 'show_pickup_modal') {
      return res.json({ success: true, ...result, message: 'All bags processed - ready for pickup' });
    }
    res.json({ success: true, ...result, message: `Bag ${result.bag.bagNumber} marked as processed` });
  } catch (err) {
    if (err.isBagWorkflowError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error in scanProcessed:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to scan processed bag',
      message: err.message
    });
  }
};


// Mark order as ready for pickup (deprecated - use scanProcessed instead)
exports.markOrderReady = async (req, res) => {
  try {
    const order = await pickupService.markOrderReady({
      orderId: req.params.orderId,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, message: 'Order marked as ready for pickup', order });
  } catch (err) {
    if (err.isPickupError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error marking order ready:', err);
    res.status(500).json({ success: false, error: 'Failed to mark order as ready' });
  }
};

// New endpoint for completing pickup with bag verification
exports.completePickup = async (req, res) => {
  try {
    const order = await pickupService.completePickup({
      orderId: req.body.orderId,
      bagIds: req.body.bagIds,
      operatorId: req.user.id,
      req
    });
    res.json({
      success: true,
      message: 'Order completed successfully',
      orderComplete: true,
      order
    });
  } catch (err) {
    if (err.isPickupError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error completing pickup:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to complete pickup',
      message: err.message
    });
  }
};

// Confirm pickup by affiliate (legacy)
exports.confirmPickup = async (req, res) => {
  try {
    const result = await pickupService.confirmPickup({
      orderId: req.body.orderId,
      numberOfBags: req.body.numberOfBags,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, message: 'Pickup confirmed', ...result });
  } catch (err) {
    if (err.isPickupError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error confirming pickup:', err);
    res.status(500).json({ success: false, error: 'Failed to confirm pickup' });
  }
};

// Get today's stats for scanner interface
exports.getTodayStats = async (req, res) => {
  try {
    const stats = await shiftStatsService.getTodayStats({ operatorId: req.user.id });
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching today stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get count of new customers without bag labels
exports.getNewCustomersCount = async (req, res) => {
  try {
    const count = await shiftStatsService.getNewCustomersCount();
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Get new customers count error:', error);
    res.status(500).json({ success: false, message: 'Error fetching new customers count' });
  }
};

// Print bag labels for new customers
exports.printNewCustomerLabels = async (req, res) => {
  try {
    const result = await shiftStatsService.printNewCustomerLabels();
    if (result.customersProcessed === 0) {
      return res.json({
        success: true,
        message: 'No new customers found',
        customersProcessed: 0,
        labelsGenerated: 0
      });
    }
    res.json({
      success: true,
      message: `Generated ${result.labelsGenerated} labels for ${result.customersProcessed} customers`,
      ...result
    });
  } catch (error) {
    logger.error('Print new customer labels error:', error);
    res.status(500).json({ success: false, message: 'Error printing customer labels' });
  }
};

// Confirm that labels were printed successfully
exports.confirmLabelsPrinted = async (req, res) => {
  try {
    const { customersUpdated } = await shiftStatsService.confirmLabelsPrinted({
      customerIds: req.body.customerIds,
      operatorId: req.user.id
    });
    logger.info(`Operator ${req.user.id} confirmed printing labels for ${customersUpdated} customers`);
    res.json({
      success: true,
      message: `Labels marked as printed for ${customersUpdated} customers`,
      customersUpdated
    });
  } catch (err) {
    if (err.isShiftError) return res.status(err.status).json({ success: false, message: err.message });
    logger.error('Confirm labels printed error:', err);
    res.status(500).json({
      success: false,
      message: 'Error confirming label printing'
    });
  }
};
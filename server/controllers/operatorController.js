const logger = require('../utils/logger');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');

const orderQueueService = require('../services/operatorOrderQueueService');
const shiftStatsService = require('../services/operatorShiftStatsService');
const supportService = require('../services/operatorSupportService');
const bagWorkflowService = require('../services/operatorBagWorkflowService');
const orderIntakeService = require('../modules/orders/orderIntakeService');
const orderAdvanceService = require('../modules/orders/orderAdvanceService');
const extractBagToken = require('../modules/bags/extractBagToken');

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
      bagToken: req.body.bagToken || req.body.bagId || req.body.customerId, // tolerate old field names one sprint
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, ...result });
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
    const { order, reIntake } = await bagWorkflowService.weighBags({
      bagToken: req.body.bagToken,
      weight: req.body.weight,
      addOns: req.body.addOns,
      freshAddOnsFormPlaced: !!req.body.freshAddOnsFormPlaced,
      operatorId: req.user.id,
      req
    });
    res.json({ success: true, order, reIntake, message: 'Order created at intake' });
  } catch (err) {
    if (err.isBagWorkflowError || err.isIntakeError) {
      return res.status(err.status).json({ success: false, error: err.message, ...err.details });
    }
    logger.error('Error weighing bags:', err);
    res.status(500).json({ success: false, error: 'Failed to weigh bags' });
  }
};

// State-driven kiosk advance (PR 9): in_progress -> processed (gate runs),
// ready_for_pickup -> picked_up (scan-OUT). Replaces scanProcessed /
// completePickup. Accepts a raw bag token or the printed claim URL — in the
// `bagToken` key only (the one-sprint old-field-name tolerance has ended).
exports.advance = ControllerHelpers.asyncWrapper(async (req, res) => {
  const bagToken = extractBagToken(req.body.bagToken);
  if (!bagToken) return ControllerHelpers.sendError(res, 'A valid bag token is required', 400);
  try {
    const result = await orderAdvanceService.advance({ bagToken, operatorId: req.user.id, req });
    ControllerHelpers.sendSuccess(res, { action: result.action, order: result.order },
      `Order advanced to ${result.action}`);
  } catch (err) {
    if (err.isAdvanceError) {
      return ControllerHelpers.sendError(res, err.message, err.status, { code: err.code });
    }
    throw err;
  }
});

// Legacy kiosk endpoint — now a thin delegate onto the state-driven advance
// engine (PR 9). Kept so already-deployed kiosk clients keep working.
exports.scanProcessed = exports.advance;

// Kiosk intake — operator JWT + CSRF. One bag = one order (spec §6.4 / §5).
exports.intake = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { bagToken, weight, addOns, freshAddOnsFormPlaced } = req.body;
  if (!bagToken) {
    return ControllerHelpers.sendError(res, 'bagToken is required', 400);
  }
  try {
    const { order, reIntake } = await orderIntakeService.createOrderFromBag({
      bagToken,
      weight,
      addOns,
      freshAddOnsFormPlaced: !!freshAddOnsFormPlaced,
      operatorId: req.user.id,
      req
    });
    ControllerHelpers.sendSuccess(res, {
      order: {
        orderId: order.orderId,
        status: order.status,
        customerId: order.customerId,
        affiliateId: order.affiliateId,
        actualWeight: order.actualWeight,
        addOns: order.addOns,
        addOnTotal: order.addOnTotal,
        feeBreakdown: order.feeBreakdown,
        actualTotal: order.actualTotal,
        affiliateCommission: order.affiliateCommission
      },
      reIntake
    }, 'Order created at intake', 201);
  } catch (err) {
    if (err.isIntakeError || err.isBagWorkflowError) {
      return ControllerHelpers.sendError(res, err.message, err.status, { code: err.code, ...err.details });
    }
    throw err;
  }
});

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
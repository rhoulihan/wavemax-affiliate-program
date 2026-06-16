const logger = require('../utils/logger');

// Utility modules for consistent error handling and responses
const ControllerHelpers = require('../utils/controllerHelpers');

const shiftStatsService = require('../services/operatorShiftStatsService');
const supportService = require('../services/operatorSupportService');
const bagService = require('../modules/bags/bagService');
const orderTransitionService = require('../modules/orders/orderTransitionService');
const extractBagToken = require('../modules/bags/extractBagToken');

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

// Resolve the bag for a kiosk scan, mapping anti-enumeration null to a generic
// error. The kiosk operator is authenticated by JWT (req.user.id).
async function resolveActiveBag(rawToken) {
  const bagToken = extractBagToken(rawToken);
  if (!bagToken) return { error: { message: 'A valid bag token is required', status: 400 } };
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved || !resolved.bag) {
    return { error: { message: 'Bag not recognized', status: 404, code: 'invalid_bag' } };
  }
  return { bag: resolved.bag };
}

function sendTransitionError(res, err) {
  if (err.isTransitionError) {
    return ControllerHelpers.sendError(res, err.message, err.status, { code: err.code, ...err.details });
  }
  throw err;
}

const orderResponse = (order) => order && ({
  orderId: order.orderId,
  status: order.status,
  customerId: order.customerId,
  affiliateId: order.affiliateId,
  bagId: order.bagId
});

// Kiosk scan — state-driven. The current order state determines the next step
// (spec §3): no open order -> create pending; pending -> in_progress;
// in_progress -> out_for_delivery; out_for_delivery -> complete. The store
// kiosk operator is JWT-authenticated; `role` is 'operator'.
exports.advance = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { bag, error } = await resolveActiveBag(req.body.bagToken);
  if (error) return ControllerHelpers.sendError(res, error.message, error.status, error.code ? { code: error.code } : undefined);
  try {
    const result = await orderTransitionService.advanceOrder({
      bag,
      by: String(req.user.id),
      role: 'operator',
      paymentConfirmed: !!req.body.paymentConfirmed,
      req
    });
    return ControllerHelpers.sendSuccess(res, {
      action: result.action,
      to: result.to,
      orderId: result.orderId,
      order: orderResponse(result.order)
    }, `Scan applied: ${result.action}`);
  } catch (err) {
    return sendTransitionError(res, err);
  }
});

// At the store kiosk, scanning a pending bag = intake (advance to in_progress).
// The intake endpoint is a state-driven advance — kept so the existing kiosk
// route keeps working.
exports.intake = exports.advance;

// Legacy kiosk alias — state-driven advance.
exports.scanProcessed = exports.advance;

// Field/partner path: scanning a bag with no open order opens a pending order
// at pickup (PR 5 adds the scan-session auth; here the operator JWT authorizes).
exports.createPending = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { bag, error } = await resolveActiveBag(req.body.bagToken);
  if (error) return ControllerHelpers.sendError(res, error.message, error.status, error.code ? { code: error.code } : undefined);
  try {
    const { order } = await orderTransitionService.createPendingOrder({
      bag, by: String(req.user.id), role: 'operator', req
    });
    return ControllerHelpers.sendSuccess(res, { order: orderResponse(order) }, 'Order created at pickup', 201);
  } catch (err) {
    return sendTransitionError(res, err);
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
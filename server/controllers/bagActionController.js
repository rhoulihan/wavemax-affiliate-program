// Public bag-URL actions (spec §5/§6.4/§6.6) — the phone/ad-hoc path.
// No JWT: every mutation is authorized by a role code. Operator codes are
// resolved globally by HMAC (identify-and-verify); delivery codes are
// verified by affiliateDeliveryService against the order's own parties.

const Operator = require('../models/Operator');
const SystemConfig = require('../models/SystemConfig');
const ControllerHelpers = require('../utils/controllerHelpers');
const orderIntakeService = require('../modules/orders/orderIntakeService');
const orderAdvanceService = require('../modules/orders/orderAdvanceService');
const affiliateDeliveryService = require('../services/affiliateDeliveryService');
const codeAttemptLockout = require('../services/codeAttemptLockout');
const roleCodes = require('../utils/roleCodes');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class BagActionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.isBagActionError = true;
  }
}

function sendTypedError(res, err) {
  // Our own typed errors + the typed errors thrown by the intake/advance/
  // delivery services (all carry .code + .status). Generic messages only —
  // no token echo, no role oracle.
  const status = err.status || err.statusCode;
  if (status && status < 500) {
    return ControllerHelpers.sendError(res, err.message, status, { code: err.code || 'error' });
  }
  throw err; // unexpected -> error middleware
}

async function resolveOperatorByCode({ operatorCode, bagToken, req }) {
  const key = codeAttemptLockout.attemptKey({ scope: 'op', bagToken, req });
  const maxAttempts = await SystemConfig.getValue('operator_scan_code_max_attempts', 5);
  if (await codeAttemptLockout.isLockedOut(key, maxAttempts)) {
    throw new BagActionError('locked_out', 'Too many attempts — please try again later', 429);
  }
  const operator = operatorCode
    ? await Operator.findOne({ scanCodeHmac: roleCodes.hmacCode(operatorCode), isActive: true })
    : null;
  if (!operator) {
    await codeAttemptLockout.registerFailure(key);
    logAuditEvent(AuditEvents.OPERATOR_CODE_FAILED, { ip: codeAttemptLockout.clientIp(req), path: req.path }, req);
    throw new BagActionError('invalid_code', 'Invalid code', 401);
  }
  await codeAttemptLockout.clearFailures(key);
  return operator;
}

/**
 * POST /api/v1/bags/:bagToken/intake  { operatorCode, weight, addOns, freshAddOnsFormPlaced }
 */
exports.intakeWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const result = await orderIntakeService.createOrderFromBag({
      bagToken: req.params.bagToken,
      weight: req.body.weight,
      addOns: req.body.addOns,
      freshAddOnsFormPlaced: req.body.freshAddOnsFormPlaced,
      operatorId: operator._id,
      req
    });
    logAuditEvent(AuditEvents.OPERATOR_SCAN, {
      action: 'bag_url_intake', operatorId: operator.operatorId,
      orderId: result.order ? result.order.orderId : result.orderId
    }, req);
    return ControllerHelpers.sendSuccess(res, result, 'Order created', 201);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/**
 * POST /api/v1/bags/:bagToken/advance  { operatorCode }
 */
exports.advanceWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const result = await orderAdvanceService.advance({
      bagToken: req.params.bagToken, operatorId: operator._id, req
    });
    return ControllerHelpers.sendSuccess(res,
      { action: result.action, order: result.order }, `Order advanced to ${result.action}`);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/**
 * POST /api/v1/bags/:bagToken/confirm-delivery  { code, geo? }   (Task 9)
 */
exports.confirmDelivery = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const result = await affiliateDeliveryService.confirmDelivery({
      bagToken: req.params.bagToken,
      code: req.body.code,
      geo: req.body.geo,
      req
    });
    return ControllerHelpers.sendSuccess(res, {
      orderId: result.order.orderId,
      status: result.order.status,
      proofOfDelivery: {
        method: result.order.proofOfDelivery.method,
        confirmedByRole: result.order.proofOfDelivery.confirmedByRole,
        confirmedAt: result.order.proofOfDelivery.confirmedAt
      }
    }, 'Delivery confirmed');
  } catch (err) {
    return sendTypedError(res, err);
  }
});

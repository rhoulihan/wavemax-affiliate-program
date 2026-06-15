// Public bag-URL actions (spec §3/§5/§6) — the phone/ad-hoc field path.
// No JWT: every mutation is authorized by a role code (operator scan code).
// PR 5 replaces this with the proper authenticate-once scan-session token; for
// now the operator code authorizes each call and the order moves through the
// state-driven transition service.

const Operator = require('../models/Operator');
const SystemConfig = require('../models/SystemConfig');
const ControllerHelpers = require('../utils/controllerHelpers');
const bagService = require('../modules/bags/bagService');
const orderTransitionService = require('../modules/orders/orderTransitionService');
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
  // Our own typed errors + the transition service's typed errors (all carry
  // .code + .status). Generic messages only — no token echo, no role oracle.
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

async function resolveActiveBag(bagToken) {
  const resolved = await bagService.resolveByToken(bagToken);
  if (!resolved || !resolved.bag) {
    throw new BagActionError('invalid_bag', 'Bag not recognized', 404);
  }
  return resolved.bag;
}

/**
 * POST /api/v1/bags/:bagToken/intake  { operatorCode }
 * Field pickup: open a pending order for a registered bag.
 */
exports.intakeWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const bag = await resolveActiveBag(req.params.bagToken);
    const { order } = await orderTransitionService.createPendingOrder({
      bag, by: String(operator._id), role: 'operator', req
    });
    return ControllerHelpers.sendSuccess(res, {
      order: { orderId: order.orderId, status: order.status }
    }, 'Order created', 201);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/**
 * POST /api/v1/bags/:bagToken/advance  { operatorCode, paymentConfirmed? }
 * State-driven advance (intake / store-pickup / delivery), one step per scan.
 */
exports.advanceWithCode = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const operator = await resolveOperatorByCode({
      operatorCode: req.body.operatorCode, bagToken: req.params.bagToken, req
    });
    const bag = await resolveActiveBag(req.params.bagToken);
    const result = await orderTransitionService.advanceOrder({
      bag, by: String(operator._id), role: 'operator',
      paymentConfirmed: !!req.body.paymentConfirmed, req
    });
    return ControllerHelpers.sendSuccess(res, {
      action: result.action,
      to: result.to,
      orderId: result.orderId || (result.order && result.order.orderId),
      order: result.order ? { orderId: result.order.orderId, status: result.order.status } : undefined
    }, `Scan applied: ${result.action}`);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

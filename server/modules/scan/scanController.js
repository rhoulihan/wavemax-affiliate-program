// Scan endpoints (PR 4) — thin HTTP layer over scanService. The session-mint
// endpoint is public (credential-light, gated by lockout + rate limiter); the
// resolve/apply/undo endpoints sit behind scanAuth (operator JWT or a
// scan-session token).

const ControllerHelpers = require('../../utils/controllerHelpers');
const scanService = require('./scanService');

function sendTypedError(res, err) {
  const status = err.status || err.statusCode;
  if (status && status < 500) {
    return ControllerHelpers.sendError(res, err.message, status, { code: err.code || 'error' });
  }
  throw err; // unexpected -> error middleware
}

/** POST /api/v1/scan/session  { bagToken, code } */
exports.createSession = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const { bagToken, code } = req.body;
    const { sessionToken, actorType, expiresAt } = await scanService.mintSession({ bagToken, code, req });
    return ControllerHelpers.sendSuccess(res, { sessionToken, actorType, expiresAt }, 'Scan session started');
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/** POST /api/v1/scan/resolve  { bagToken }  (scanAuth) */
exports.resolve = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const result = await scanService.resolveScan({ bagToken: req.body.bagToken });
    return ControllerHelpers.sendSuccess(res, result, 'Scan resolved');
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/** POST /api/v1/scan/apply  { bagToken, expectedAction, reopen?, paymentConfirmed?, addOns?, specialInstructions? }  (scanAuth) */
exports.apply = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const { bagToken, expectedAction, reopen, paymentConfirmed, addOns, specialInstructions } = req.body;
    const result = await scanService.applyScan({
      bagToken, expectedAction, reopen, paymentConfirmed, addOns, specialInstructions,
      actor: req.scanActor, req
    });
    return ControllerHelpers.sendSuccess(res, result, `Scan applied: ${result.action}`);
  } catch (err) {
    return sendTypedError(res, err);
  }
});

/** POST /api/v1/scan/undo  { bagToken }  (scanAuth) */
exports.undo = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const result = await scanService.undoScan({ bagToken: req.body.bagToken, actor: req.scanActor, req });
    return ControllerHelpers.sendSuccess(res, result, 'Scan undone');
  } catch (err) {
    return sendTypedError(res, err);
  }
});

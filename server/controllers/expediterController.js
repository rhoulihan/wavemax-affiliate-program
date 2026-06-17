// Order Expediter controller (PR D) — read-only summary for the in-store display.

const ControllerHelpers = require('../utils/controllerHelpers');
const expediterService = require('../services/expediterService');

exports.getSummary = ControllerHelpers.asyncWrapper(async (req, res) => {
  const summary = await expediterService.getExpediterSummary();
  // Nest under `data` (sendSuccess spreads its 2nd arg into the body), so the
  // display reads a stable body.data envelope.
  ControllerHelpers.sendSuccess(res, { data: summary }, 'Expediter summary');
});

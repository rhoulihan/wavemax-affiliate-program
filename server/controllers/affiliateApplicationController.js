const { validationResult } = require('express-validator');
const ControllerHelpers = require('../utils/controllerHelpers');
const affiliateApplicationService = require('../services/affiliateApplicationService');
const logger = require('../utils/logger');

function formatValidationErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    msg: err.msg
  }));
}

/* Public UT-student affiliate-recruitment application form. */
exports.submitAffiliateApplication = ControllerHelpers.asyncWrapper(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatValidationErrors(result)
    });
  }

  const {
    firstName, lastName, email, phone, affiliation, serviceArea, transport, availability, message, source
  } = req.body;

  try {
    await affiliateApplicationService.sendAffiliateApplication({
      firstName, lastName, email, phone, affiliation, serviceArea, transport, availability, message, source
    });
  } catch (err) {
    logger.error('Affiliate-application email dispatch failed', { error: err.message });
    return ControllerHelpers.sendError(
      res,
      'Could not submit your application — please try again later.',
      500
    );
  }

  return ControllerHelpers.sendSuccess(
    res,
    {},
    "Thanks — your application is in. We'll be in touch shortly."
  );
});

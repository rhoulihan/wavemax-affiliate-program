const { validationResult } = require('express-validator');
const ControllerHelpers = require('../utils/controllerHelpers');
const partnerInquiryService = require('../services/partnerInquiryService');
const logger = require('../utils/logger');

function formatValidationErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    msg: err.msg
  }));
}

/* Public partner-program inquiry form. */
exports.submitPartnerInquiry = ControllerHelpers.asyncWrapper(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatValidationErrors(result)
    });
  }

  const {
    firstName, lastName, email, phone, businessName, serviceArea, volume, message, source
  } = req.body;

  try {
    await partnerInquiryService.sendPartnerInquiry({
      firstName, lastName, email, phone, businessName, serviceArea, volume, message, source
    });
  } catch (err) {
    logger.error('Partner-inquiry email dispatch failed', { error: err.message });
    return ControllerHelpers.sendError(
      res,
      'Could not send your inquiry — please try again later.',
      500
    );
  }

  return ControllerHelpers.sendSuccess(
    res,
    {},
    "Thanks — your inquiry has been sent. We'll be in touch shortly."
  );
});

const { validationResult } = require('express-validator');
const ControllerHelpers = require('../utils/controllerHelpers');
const corporateInquiryService = require('../services/corporateInquiryService');
const logger = require('../utils/logger');

function formatValidationErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    msg: err.msg
  }));
}

/* General corporate contact form (/contact/). */
exports.submitCorporateContact = ControllerHelpers.asyncWrapper(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatValidationErrors(result)
    });
  }

  const { topic, firstName, lastName, email, phone, message, source } = req.body;

  try {
    await corporateInquiryService.sendCorporateInquiry({
      topic, firstName, lastName, email, phone, message, source
    });
  } catch (err) {
    logger.error('Corporate-contact email dispatch failed', { error: err.message });
    return ControllerHelpers.sendError(
      res,
      'Could not send your message — please try again later.',
      500
    );
  }

  return ControllerHelpers.sendSuccess(
    res,
    {},
    "Your message has been sent — we'll be in touch shortly."
  );
});

/* Franchise candidate lead capture (/laundromat-investment-guide/). */
exports.submitFranchiseLead = ControllerHelpers.asyncWrapper(async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatValidationErrors(result)
    });
  }

  const { firstName, lastName, email, phone, market, timeline, capital, source } = req.body;

  let outcome;
  try {
    outcome = await corporateInquiryService.sendFranchiseLead({
      firstName, lastName, email, phone, market, timeline, capital, source
    });
  } catch (err) {
    logger.error('Franchise-lead email dispatch failed', { error: err.message });
    return ControllerHelpers.sendError(
      res,
      'Could not process your request — please try again later.',
      500
    );
  }

  return ControllerHelpers.sendSuccess(
    res,
    { token: outcome.token, submittedAt: outcome.submittedAt },
    "Your Investment Guide request has been received."
  );
});

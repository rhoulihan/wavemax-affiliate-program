const { validationResult } = require('express-validator');
const ControllerHelpers = require('../utils/controllerHelpers');
const contactNotificationService = require('../services/contactNotificationService');
const logger = require('../utils/logger');

const LOCATIONS = {
  'austin-tx': {
    recipientEnv: 'CONTACT_RECIPIENT_AUSTIN'
  }
};

function resolveRecipient(slug) {
  const loc = LOCATIONS[slug];
  if (!loc) return null;

  const configured = process.env[loc.recipientEnv];
  if (configured && configured.trim() !== '') {
    return { recipient: configured, fallback: false };
  }

  const fallback = process.env.EMAIL_FROM;
  if (fallback && fallback.trim() !== '') {
    logger.warn('Contact-form recipient not configured, falling back to EMAIL_FROM', {
      slug,
      envName: loc.recipientEnv
    });
    return { recipient: fallback, fallback: true };
  }

  return null;
}

function formatValidationErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    msg: err.msg
  }));
}

exports.submitContact = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { slug } = req.params;

  if (!LOCATIONS[slug]) {
    return ControllerHelpers.sendError(res, `Unknown location: ${slug}`, 404);
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formatValidationErrors(result)
    });
  }

  const resolved = resolveRecipient(slug);
  if (!resolved) {
    logger.error('Contact-form recipient and EMAIL_FROM both unconfigured', { slug });
    return ControllerHelpers.sendError(
      res,
      'Could not send your message — please try again later or call us directly.',
      500
    );
  }

  const { firstName, lastName, email, phone, message } = req.body;

  try {
    await contactNotificationService.sendContactNotification({
      recipient: resolved.recipient,
      slug,
      firstName,
      lastName,
      email,
      phone,
      message
    });
  } catch (err) {
    logger.error('Contact-form email dispatch failed', {
      slug,
      error: err.message
    });
    return ControllerHelpers.sendError(
      res,
      'Could not send your message — please try again later or call us directly.',
      500
    );
  }

  return ControllerHelpers.sendSuccess(
    res,
    {},
    "Your message has been sent — we'll be in touch shortly."
  );
});

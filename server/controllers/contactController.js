const { validationResult } = require('express-validator');
const ControllerHelpers = require('../utils/controllerHelpers');
const contactNotificationService = require('../services/contactNotificationService');
const { loadLocationData, getKnownSlugs } = require('../config/locationData');
const logger = require('../utils/logger');

/**
 * Pull the recipient email address from the location's LOCATION_DATA
 * (the same single source of truth the browser-side chrome reads).
 * No env var, no controller-side hardcoding — when the data file is
 * updated, the recipient updates automatically on next pm2 restart.
 *
 * Returns { recipient } on success, or null if the slug is unknown,
 * the data file is missing, or the email field is empty.
 */
function resolveRecipient(slug) {
  const data = loadLocationData(slug);
  if (!data) return null;

  const email = data.contact && data.contact.email && data.contact.email.trim();
  if (!email) {
    logger.error('LOCATION_DATA contact.email empty for slug', { slug });
    return null;
  }
  return { recipient: email };
}

function formatValidationErrors(result) {
  return result.array().map((err) => ({
    field: err.path || err.param,
    msg: err.msg
  }));
}

// Anti-spam fields (honeypot + dwell-time). When validation fails
// on either of these, we treat it as a silent spam reject — the
// client gets a generic "could not send" message so the spammer
// can't learn which check fired. The trip is logged internally.
const ANTISPAM_FIELDS = new Set(['_hp', '_dt']);

exports.submitContact = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { slug } = req.params;

  if (!getKnownSlugs().includes(slug)) {
    return ControllerHelpers.sendError(res, `Unknown location: ${slug}`, 404);
  }

  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = formatValidationErrors(result);
    const antispamTrip = errors.some((e) => ANTISPAM_FIELDS.has(e.field));
    if (antispamTrip) {
      logger.warn('Contact-form anti-spam trip', {
        slug,
        ip: req.ip,
        fields: errors.filter((e) => ANTISPAM_FIELDS.has(e.field)).map((e) => e.field)
      });
      // Generic 400 — don't tell the spammer which check fired.
      return ControllerHelpers.sendError(
        res,
        'Could not send your message — please try again later or call us directly.',
        400
      );
    }
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  const resolved = resolveRecipient(slug);
  if (!resolved) {
    logger.error('Contact-form recipient missing — LOCATION_DATA.contact.email empty or file unreadable', { slug });
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

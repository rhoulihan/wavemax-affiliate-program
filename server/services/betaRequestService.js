// Beta request admin service
//
// Manages the waitlist of prospective affiliates who filled out the beta
// form but haven't completed affiliate registration. Admins can inspect the
// queue, send the initial welcome email, and later nudge with reminders
// (rate-limited to once per 72h). checkAffiliateExists lets the UI skip
// reminders once the person has actually registered.

const BetaRequest = require('../models/BetaRequest');
const Affiliate = require('../models/Affiliate');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

const REMINDER_COOLDOWN_HOURS = 72;

class BetaRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isBetaRequestError = true;
  }
}

async function listBetaRequests() {
  const betaRequests = await BetaRequest.find({}).sort('-createdAt').lean();
  return betaRequests.map(request => ({
    _id: request._id,
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    phone: request.phone,
    businessName: request.businessName,
    address: request.address,
    city: request.city,
    state: request.state,
    zipCode: request.zipCode,
    message: request.message,
    welcomeEmailSent: request.welcomeEmailSent,
    welcomeEmailSentAt: request.welcomeEmailSentAt,
    welcomeEmailSentBy: request.welcomeEmailSentBy,
    lastReminderEmailSentAt: request.lastReminderEmailSentAt,
    reminderEmailCount: request.reminderEmailCount || 0,
    createdAt: request.createdAt
  }));
}

async function sendWelcomeEmail({ id, user, req }) {
  const betaRequest = await BetaRequest.findById(id);
  if (!betaRequest) throw new BetaRequestError('not_found', 'Beta request not found', 404);
  if (betaRequest.welcomeEmailSent) {
    throw new BetaRequestError('already_sent', 'Welcome email has already been sent to this user');
  }

  await emailService.sendBetaWelcomeEmail(betaRequest);

  betaRequest.welcomeEmailSent = true;
  betaRequest.welcomeEmailSentAt = new Date();
  betaRequest.welcomeEmailSentBy = user.email || user.adminId;
  await betaRequest.save();

  await logAuditEvent(AuditEvents.ADMIN_SENT_BETA_WELCOME, user, {
    betaRequestId: betaRequest._id,
    recipientEmail: betaRequest.email,
    recipientName: `${betaRequest.firstName} ${betaRequest.lastName}`
  }, req);
}

async function checkAffiliateExists({ email }) {
  if (!email) throw new BetaRequestError('email_required', 'Email is required');
  const affiliate = await Affiliate.findOne({ email: email.toLowerCase() });
  return { exists: !!affiliate, registeredAt: affiliate?.createdAt || null };
}

async function sendReminderEmail({ id, user, req }) {
  const betaRequest = await BetaRequest.findById(id);
  if (!betaRequest) throw new BetaRequestError('not_found', 'Beta request not found', 404);
  if (!betaRequest.welcomeEmailSent) {
    throw new BetaRequestError(
      'welcome_not_sent',
      'Welcome email must be sent before sending reminders'
    );
  }

  const lastEmailSentAt = betaRequest.lastReminderEmailSentAt || betaRequest.welcomeEmailSentAt;
  const hoursSinceLastEmail = (Date.now() - new Date(lastEmailSentAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastEmail < REMINDER_COOLDOWN_HOURS) {
    const hoursRemaining = Math.ceil(REMINDER_COOLDOWN_HOURS - hoursSinceLastEmail);
    throw new BetaRequestError(
      'cooldown',
      `Please wait ${hoursRemaining} more hour${hoursRemaining !== 1 ? 's' : ''} before sending another reminder (72-hour minimum between emails)`
    );
  }

  const affiliate = await Affiliate.findOne({ email: betaRequest.email.toLowerCase() });
  if (affiliate) {
    throw new BetaRequestError('already_registered', 'User has already registered as an affiliate');
  }

  await emailService.sendBetaReminderEmail(betaRequest);

  betaRequest.lastReminderEmailSentAt = new Date();
  betaRequest.reminderEmailCount = (betaRequest.reminderEmailCount || 0) + 1;
  betaRequest.reminderEmailHistory.push({
    sentAt: new Date(),
    sentBy: user.email || user.adminId
  });
  await betaRequest.save();

  await logAuditEvent(AuditEvents.ADMIN_SENT_BETA_REMINDER, user, {
    betaRequestId: betaRequest._id,
    recipientEmail: betaRequest.email,
    recipientName: `${betaRequest.firstName} ${betaRequest.lastName}`,
    reminderCount: betaRequest.reminderEmailCount
  }, req);
}

module.exports = {
  listBetaRequests,
  sendWelcomeEmail,
  checkAffiliateExists,
  sendReminderEmail,
  BetaRequestError,
  REMINDER_COOLDOWN_HOURS
};

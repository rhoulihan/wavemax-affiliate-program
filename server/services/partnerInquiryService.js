const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

const RECIPIENT = process.env.PARTNER_INQUIRY_RECIPIENT || 'pickups@rundberglaundry.com';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

const FOOTER = 'Rundberg Laundry · 825 E Rundberg Ln, Austin TX 78753';

/* =====================================================================
   PARTNER INQUIRY (public partner-program interest form)
   Two emails per submission:
     1. Notification (to RECIPIENT): full inquiry detail
     2. Inquirer thank-you (to email): brief confirmation
   ===================================================================== */

async function sendPartnerInquiry({ firstName, lastName, email, phone, businessName, serviceArea, volume, message, source }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const subject = `Partner inquiry · ${businessName || fullName}`;

  // --- Notification to RECIPIENT ---
  const messageBlock = message
    ? `<h3>Message</h3>\n    <p style="white-space: pre-wrap;">${nl2br(message)}</p>`
    : '';

  const notificationHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852;">
    <h2>New partner inquiry from rundberglaundry.com</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Business:</strong></td><td>${escapeHtml(businessName || '—')}</td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone || '—')}</td></tr>
      <tr><td><strong>Service area:</strong></td><td>${escapeHtml(serviceArea || '—')}</td></tr>
      <tr><td><strong>Estimated volume:</strong></td><td>${escapeHtml(volume || '—')}</td></tr>
      <tr><td><strong>Source page:</strong></td><td>${escapeHtml(source || '—')}</td></tr>
    </table>
    ${messageBlock}
    <hr>
    <p style="font-size: 12px; color: #6c757d;">Reply to this email to reach ${escapeHtml(firstName)} at ${escapeHtml(email)}.</p>
    <p style="font-size: 12px; color: #6c757d;">${escapeHtml(FOOTER)}</p>
  </body>
</html>`;
  await emailService.sendEmail(RECIPIENT, subject, notificationHtml);

  // --- Inquirer thank-you ---
  const thankYouSubject = 'Thanks for your interest in the Rundberg Laundry partner program';
  const thankYouHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852; max-width: 640px; margin: 0 auto;">
    <h2 style="color: #143852;">Thanks, ${escapeHtml(firstName)}.</h2>
    <p>We've received your inquiry about the Rundberg Laundry partner program. A member of our team will be in touch with you shortly.</p>
    <p>If there's anything else you'd like us to know in the meantime, just reply to this email.</p>
    <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e3e8f0;">
    <p style="font-size: 12px; color: #6c757d;">${escapeHtml(FOOTER)}</p>
  </body>
</html>`;
  await emailService.sendEmail(email, thankYouSubject, thankYouHtml);

  logger.info('Partner inquiry received', { email, businessName: businessName || null });
}

module.exports = {
  sendPartnerInquiry
};

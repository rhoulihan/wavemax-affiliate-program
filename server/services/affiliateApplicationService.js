const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

const RECIPIENT = process.env.AFFILIATE_APPLICATION_RECIPIENT || 'admin@crhsent.com';

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
   AFFILIATE APPLICATION (public UT-student affiliate-recruitment form)
   Two emails per submission:
     1. Notification (to RECIPIENT): full application detail
     2. Applicant thank-you (to email): brief confirmation
   ===================================================================== */

async function sendAffiliateApplication({ firstName, lastName, email, phone, affiliation, serviceArea, transport, availability, message, source }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const subject = `Affiliate application · ${firstName} ${lastName}`;

  // --- Notification to RECIPIENT ---
  const messageBlock = message
    ? `<h3>Message</h3>\n    <p style="white-space: pre-wrap;">${nl2br(message)}</p>`
    : '';

  const notificationHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852;">
    <h2>New affiliate application from rundberglaundry.com</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone || '—')}</td></tr>
      <tr><td><strong>UT affiliation:</strong></td><td>${escapeHtml(affiliation || '—')}</td></tr>
      <tr><td><strong>Service area:</strong></td><td>${escapeHtml(serviceArea || '—')}</td></tr>
      <tr><td><strong>Transport:</strong></td><td>${escapeHtml(transport || '—')}</td></tr>
      <tr><td><strong>Availability:</strong></td><td>${escapeHtml(availability || '—')}</td></tr>
      <tr><td><strong>Source page:</strong></td><td>${escapeHtml(source || '—')}</td></tr>
    </table>
    ${messageBlock}
    <hr>
    <p style="font-size: 12px; color: #6c757d;">Reply to this email to reach ${escapeHtml(firstName)} at ${escapeHtml(email)}.</p>
    <p style="font-size: 12px; color: #6c757d;">${escapeHtml(FOOTER)}</p>
  </body>
</html>`;
  await emailService.sendEmail(RECIPIENT, subject, notificationHtml);

  // --- Applicant thank-you ---
  const thankYouSubject = 'Thanks for your interest in the Rundberg Laundry affiliate program';
  const thankYouHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852; max-width: 640px; margin: 0 auto;">
    <h2 style="color: #143852;">Thanks, ${escapeHtml(firstName)}.</h2>
    <p>We've received your application for the Rundberg Laundry affiliate program. A member of our team will reach out to you shortly.</p>
    <p>If you have any questions in the meantime, just reply to this email.</p>
    <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e3e8f0;">
    <p style="font-size: 12px; color: #6c757d;">${escapeHtml(FOOTER)}</p>
  </body>
</html>`;
  await emailService.sendEmail(email, thankYouSubject, thankYouHtml);

  logger.info('Affiliate application received', { email, affiliation: affiliation || null });
}

module.exports = {
  sendAffiliateApplication
};

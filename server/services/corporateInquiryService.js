const crypto = require('crypto');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

const ADMIN_EMAIL = process.env.CORPORATE_INQUIRY_RECIPIENT || 'administrator@wavemax.promo';

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

/**
 * Generate a short, URL-safe reference token. Used to stamp PDFs and
 * trace lead → submission → PDF download.
 */
function makeToken() {
  return crypto.randomBytes(6).toString('base64url');
}

/* =====================================================================
   GENERAL CORPORATE CONTACT (/contact/)
   ===================================================================== */

async function sendCorporateInquiry({ topic, firstName, lastName, email, phone, message, source }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const phoneRow = phone
    ? `<tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone)}</td></tr>`
    : '';
  const subject = `WaveMAX Inquiry · ${topic} · ${fullName}`;

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852;">
    <h2>New corporate inquiry from wavemax.promo</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Topic:</strong></td><td>${escapeHtml(topic)}</td></tr>
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      ${phoneRow}
      <tr><td><strong>Source page:</strong></td><td>${escapeHtml(source || '/contact/')}</td></tr>
    </table>
    <h3>Message</h3>
    <p style="white-space: pre-wrap;">${nl2br(message)}</p>
    <hr>
    <p style="font-size: 12px; color: #6c757d;">Reply directly to this email to respond to ${escapeHtml(firstName)}.</p>
  </body>
</html>`;

  await emailService.sendEmail(ADMIN_EMAIL, subject, html);
}

/* =====================================================================
   FRANCHISE LEAD CAPTURE (/laundromat-investment-guide/)
   Two emails per submission:
     1. Admin notification (to ADMIN_EMAIL): full lead detail + reference token
     2. Visitor thank-you (to lead.email): brief confirmation + guide link
   ===================================================================== */

async function sendFranchiseLead({ firstName, lastName, email, phone, market, timeline, capital, source }) {
  const token = makeToken();
  const fullName = `${firstName} ${lastName}`.trim();
  const submittedAt = new Date().toISOString();

  // --- Admin notification ---
  const adminSubject = `Franchise Lead · ${fullName} · Token ${token}`;
  const adminHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852;">
    <h2>New WaveMAX franchise lead</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Reference token:</strong></td><td><code>${escapeHtml(token)}</code></td></tr>
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone || '—')}</td></tr>
      <tr><td><strong>Market interest:</strong></td><td>${escapeHtml(market || '—')}</td></tr>
      <tr><td><strong>Timeline:</strong></td><td>${escapeHtml(timeline || '—')}</td></tr>
      <tr><td><strong>Liquid capital:</strong></td><td>${escapeHtml(capital || '—')}</td></tr>
      <tr><td><strong>Source page:</strong></td><td>${escapeHtml(source || '/laundromat-investment-guide/')}</td></tr>
      <tr><td><strong>Submitted:</strong></td><td>${escapeHtml(submittedAt)}</td></tr>
    </table>
    <hr>
    <p style="font-size: 12px; color: #6c757d;">Reply directly to follow up. Token is also stamped on the visitor's investment guide for cross-reference.</p>
  </body>
</html>`;
  await emailService.sendEmail(ADMIN_EMAIL, adminSubject, adminHtml);

  // --- Visitor thank-you ---
  const visitorSubject = "Your WaveMAX Investment Guide is on the way";
  const visitorHtml = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852; max-width: 640px; margin: 0 auto;">
    <h2 style="color: #143852;">Thanks, ${escapeHtml(firstName)}.</h2>
    <p>Your request for the WaveMAX Investment Guide has been received. Reference token: <code>${escapeHtml(token)}</code></p>

    <p>While we get your personalized PDF together, here's what's coming next:</p>
    <ul>
      <li>You'll receive a follow-up email within one business day with the Investment Guide attached.</li>
      <li>A member of our franchise development team will reach out to schedule the initial 30-minute exploratory call.</li>
      <li>If your timeline is tight, just reply to this email and we'll prioritize.</li>
    </ul>

    <p>In the meantime, you can browse the full Item 19 figures, the Jacksonville flagship cash-flow snapshot, and the structural reasons operators choose this category here:</p>
    <p>
      <a href="https://wavemax.promo/why-invest-in-wavemax/" style="display:inline-block; padding:12px 24px; background:#f5a623; color:#143852; text-decoration:none; border-radius:4px; font-weight:700;">Why Invest in WaveMAX</a>
    </p>

    <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e3e8f0;">
    <p style="font-size: 12px; color: #6c757d;">
      WaveMAX Laundry · 929 McDuff Ave S, Suite 107 · Jacksonville, FL 32205<br>
      AU Hydro LLC dba WaveMAX Laundry · #1 Laundromat Franchise · 2026 Entrepreneur Franchise 500
    </p>
  </body>
</html>`;
  await emailService.sendEmail(email, visitorSubject, visitorHtml);

  logger.info('Franchise lead captured', { token, email, market, timeline, capital });

  return { token, submittedAt };
}

module.exports = {
  sendCorporateInquiry,
  sendFranchiseLead,
  makeToken
};

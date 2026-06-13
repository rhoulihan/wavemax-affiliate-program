// Franchise self-serve preview — unlock email.
//
// Sent after an authorized rep submits the "See it for yourself" form. Carries
// the two factors: the reusable URL key (in the link) that gates the
// crhsent.com/<location> route, and the per-request password that opens the
// 1-hour content view. Mirrors the access-gate email (inline HTML, no template
// file, no inline scripts needed — it's email).
'use strict';

const { sendEmail } = require('./email/transport');
const { REMINDER, AUTHORIZATION } = require('../config/franchisePreviewCopy');
const logger = require('../utils/logger');

const PREVIEW_FROM = process.env.FRANCHISE_PREVIEW_FROM || '"CRHS Enterprises" <admin@rundberglaundry.com>';
const LOGO = 'https://rundberglaundry.com/assets/images/brand/logo-wavemax.png';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Build the unlock email HTML.
 * @param {{businessName?:string, unlockUrl:string, password:string}} data
 */
function buildUnlockEmailHtml({ businessName, unlockUrl, password }) {
  const who = businessName ? esc(businessName) : 'your location';
  const url = esc(unlockUrl);
  const pw = esc(password);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#1e3a8a;text-align:center;padding:22px;border-radius:10px 10px 0 0">
    <img src="${LOGO}" alt="WaveMAX" style="height:40px">
  </div>
  <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="font-size:18px;margin:0 0 10px">Your private site preview for ${who}</h2>
    <p style="font-size:14px;line-height:1.55;color:#334155">${esc(REMINDER)}</p>
    <p style="margin:22px 0"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Open my preview</a></p>
    <p style="font-size:14px;line-height:1.55;color:#334155">When prompted, enter this password:</p>
    <p style="font-size:20px;font-weight:700;letter-spacing:2px;background:#f1f5f9;border-radius:8px;padding:12px 16px;text-align:center;margin:8px 0 18px">${pw}</p>
    <p style="font-size:13px;line-height:1.5;color:#64748b">The preview unlocks for <strong>1 hour</strong>. This link stays active, so you can return anytime and unlock it again with the same password.</p>
    <p style="font-size:12px;color:#64748b;word-break:break-all;margin-top:14px">If the button doesn't work, paste this link into your browser:<br>${url}</p>
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;line-height:1.5;color:#94a3b8">${esc(AUTHORIZATION)}</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:10px">If you didn't request this preview, you can safely ignore this email.</p>
  </div>
</div>`;
}

/**
 * Send the unlock email.
 * @param {{email:string, businessName?:string, unlockUrl:string, password:string}} data
 */
async function sendPreviewUnlockEmail({ email, businessName, unlockUrl, password }) {
  const subject = `Your WaveMAX site preview — ${businessName || 'your location'}`;
  const html = buildUnlockEmailHtml({ businessName, unlockUrl, password });
  await sendEmail(email, subject, html, PREVIEW_FROM);
  logger.info('Franchise preview unlock email sent', { email, businessName });
}

module.exports = { buildUnlockEmailHtml, sendPreviewUnlockEmail };

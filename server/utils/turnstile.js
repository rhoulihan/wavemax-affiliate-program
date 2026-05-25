// Cloudflare Turnstile server-side verification.
//
// Turnstile is the practical anti-bot choice here: no visual puzzle (which
// modern AI solves anyway), it uses behavioral signals + a proof-of-work
// challenge, and we're already on Cloudflare. It is NOT "AI-proof" — nothing
// is — so it's paired with a hard server-side throttle on the calling route.
//
// Provisioning: create a Turnstile widget in the Cloudflare dashboard → put the
// SITE key in the client widget and the SECRET key in env as TURNSTILE_SECRET_KEY.
'use strict';

const axios = require('axios');
const logger = require('./logger');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile response token with Cloudflare.
 * @param {string} token   the cf-turnstile-response value from the form
 * @param {string} [remoteip] the client IP (optional, improves scoring)
 * @returns {Promise<{success:boolean, skipped?:boolean, error?:string, errorCodes?:string[], hostname?:string}>}
 *
 * Fails CLOSED in production when no secret is configured (so the feature can't
 * silently run unprotected). Skips (returns success) in non-production when no
 * secret is set, so dev/test don't require a live Turnstile widget.
 */
async function verifyTurnstile(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Turnstile: TURNSTILE_SECRET_KEY not configured — failing closed');
      return { success: false, error: 'not_configured' };
    }
    logger.warn('Turnstile: no secret configured — skipping verification (non-production)');
    return { success: true, skipped: true };
  }
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing_token' };
  }
  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteip) params.append('remoteip', remoteip);
    const resp = await axios.post(VERIFY_URL, params.toString(), {
      timeout: 6000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const data = resp.data || {};
    return {
      success: data.success === true,
      errorCodes: data['error-codes'] || [],
      hostname: data.hostname
    };
  } catch (err) {
    logger.error('Turnstile: verification request failed', { error: err.message });
    return { success: false, error: 'verify_request_failed' };
  }
}

module.exports = { verifyTurnstile };

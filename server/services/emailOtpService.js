// emailOtpService — in-house SMTP email OTP for bag-claim registration (PR 7).
//
// Flow:
//   requestOtp  → generate 6-digit numeric code, hash + upsert the record,
//                 send the code via SMTP. Always returns generic success
//                 (anti-enumeration — never reveals whether the email exists).
//   verifyOtp   → constant-time check against the stored hash, gated by the
//                 shared codeAttemptLockout (scope 'email_otp'); on success
//                 mark verified + mint a one-time verificationToken.
//   consumeVerification → the register endpoint re-checks the verificationToken
//                 server-side (the client token alone is not trusted).

const crypto = require('crypto');

const EmailVerification = require('../models/EmailVerification');
const { hashCode, verifyCode } = require('../utils/roleCodes');
const codeAttemptLockout = require('./codeAttemptLockout');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function bagHash(bagToken) {
  return crypto.createHash('sha256').update(String(bagToken || '')).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Cryptographically-random zero-padded 6-digit code. */
function generateNumericCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Issue (or re-issue) an OTP for (bagToken, email) and email it.
 * Generic success regardless of state (anti-enumeration).
 */
async function requestOtp({ bagToken, email, languagePreference }) {
  const e = normalizeEmail(email);
  const code = generateNumericCode();

  await EmailVerification.findOneAndUpdate(
    { bagTokenHash: bagHash(bagToken), email: e },
    {
      $set: {
        codeHash: hashCode(code),
        verified: false,
        verificationToken: null,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS)
      }
    },
    { upsert: true, new: true }
  );

  try {
    await emailService.sendCustomerEmailOtp({ email: e, code, languagePreference });
  } catch (err) {
    // Best-effort send: the record is written, the client can resend.
    logger.error('Failed to send email OTP', { error: err.message });
  }

  return { success: true };
}

/**
 * Verify a submitted code. Returns { success, verificationToken? } or
 * { success:false, lockedOut? }. Never throws on a bad code (anti-enumeration).
 */
async function verifyOtp({ bagToken, email, code, req }) {
  const e = normalizeEmail(email);
  const key = codeAttemptLockout.attemptKey({ scope: 'email_otp', bagToken, req });

  if (await codeAttemptLockout.isLockedOut(key, MAX_ATTEMPTS)) {
    return { success: false, lockedOut: true };
  }

  const doc = await EmailVerification.findOne({
    bagTokenHash: bagHash(bagToken), email: e,
    expiresAt: { $gt: new Date() }
  });

  const ok = !!(doc && verifyCode(code, doc.codeHash));
  if (!ok) {
    await codeAttemptLockout.registerFailure(key);
    if (doc) {
      doc.attempts += 1;
      await doc.save();
    }
    if (await codeAttemptLockout.isLockedOut(key, MAX_ATTEMPTS)) {
      return { success: false, lockedOut: true };
    }
    return { success: false };
  }

  await codeAttemptLockout.clearFailures(key);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  doc.verified = true;
  doc.verificationToken = verificationToken;
  await doc.save();
  return { success: true, verificationToken };
}

/**
 * Re-verify a minted verificationToken at registration. Returns boolean.
 */
async function consumeVerification({ bagToken, email, verificationToken }) {
  if (!verificationToken) return false;
  const doc = await EmailVerification.findOne({
    bagTokenHash: bagHash(bagToken),
    email: normalizeEmail(email),
    verificationToken,
    verified: true,
    expiresAt: { $gt: new Date() }
  });
  return !!doc;
}

/** Delete the OTP record once registration succeeds. */
async function clearVerification({ bagToken, email }) {
  await EmailVerification.deleteOne({
    bagTokenHash: bagHash(bagToken), email: normalizeEmail(email)
  });
}

module.exports = {
  requestOtp,
  verifyOtp,
  consumeVerification,
  clearVerification,
  OTP_TTL_MS,
  MAX_ATTEMPTS
};

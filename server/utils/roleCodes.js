// Role-code utilities — short human-entered secrets for the overloaded bag URL.
//
// Three codes use this module (spec §4.5/4.6/4.8, §6.6):
//   - Customer delivery PIN   -> hashCode/verifyCode (PBKDF2, stored "hash:salt")
//   - Affiliate delivery code -> hashCode/verifyCode (PBKDF2, stored "hash:salt")
//   - Operator scan code      -> hmacCode (HMAC-SHA256 keyed by ENCRYPTION_KEY,
//                                unique-indexed for O(1) identify-and-verify)
//
// None of these is an account password. Codes are normalized (trim + upper)
// before hashing so phone keyboards can't cause false mismatches.

const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('./encryption');

// Unambiguous alphabet: A-Z minus I/L/O, digits minus 0/1 (31 chars).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Generate an unambiguous alphanumeric code.
 * @param {number} length - code length (from SystemConfig, e.g. 6 or 8)
 * @returns {string}
 */
function generateCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]; // unbiased
  }
  return out;
}

/**
 * Generate a purely NUMERIC code (e.g. the 6-digit partner/affiliate staff code).
 * Digits can lead with 0 — it's a string code, not a number. Easy to read off a
 * card and type on any keypad.
 * @param {number} length - number of digits
 * @returns {string}
 */
function generateNumericCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String(crypto.randomInt(10)); // unbiased 0-9
  }
  return out;
}

/**
 * PBKDF2-hash a code for at-rest storage. Returns "hash:salt" (single field).
 */
function hashCode(code) {
  const { salt, hash } = hashPassword(normalizeCode(code));
  return `${hash}:${salt}`;
}

/**
 * Constant-time verify of a code against a stored "hash:salt" value.
 */
function verifyCode(code, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [hash, salt] = stored.split(':');
  if (!hash || !salt) return false;
  try {
    return verifyPassword(normalizeCode(code), salt, hash);
  } catch (_e) {
    return false;
  }
}

/**
 * HMAC-SHA256 of a code keyed by ENCRYPTION_KEY (hex) — the operator
 * scan-code lookup key (Operator.scanCodeHmac, unique-indexed).
 */
function hmacCode(code) {
  return crypto
    .createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'))
    .update(normalizeCode(code))
    .digest('hex');
}

module.exports = { generateCode, generateNumericCode, hashCode, verifyCode, hmacCode, normalizeCode, CODE_ALPHABET };

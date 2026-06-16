// firebasePhoneService — server-side verification of Firebase Phone Auth tokens (PR 7).
//
// The browser drives the SMS OTP (Firebase client SDK + reCAPTCHA) and returns
// a Firebase ID token; the server only verifies that token via the Admin SDK
// and extracts the verified E.164 phone number. We do NOT adopt Firebase as our
// auth system — we consume the phone number, then create our own Customer.
//
// Lazy-init: the Admin SDK is only initialized when verification is actually
// needed, so the app boots cleanly with no Firebase env (flag off → never
// touched). The service-account JSON lives on-box, off git, at
// FIREBASE_SERVICE_ACCOUNT_PATH.

const logger = require('../utils/logger');

/** Phone verification is gated behind a feature flag (off → email-only). */
function isEnabled() {
  return process.env.PHONE_VERIFICATION_ENABLED === 'true';
}

let admin = null;
function getAdmin() {
  if (!admin) {
    // Required lazily so the module (and the whole app) loads without
    // firebase-admin present until phone verification is switched on.
    admin = require('firebase-admin');
  }
  if (!admin.apps.length) {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!path) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not configured');
    }
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const serviceAccount = require(path);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    logger.info('Firebase Admin SDK initialized for phone verification');
  }
  return admin;
}

/**
 * Verify a Firebase phone ID token and return the verified E.164 phone number.
 * @throws when the token is missing, invalid, or carries no phone_number.
 */
async function verifyPhoneToken(idToken) {
  if (!idToken) {
    throw new Error('Missing phone ID token');
  }
  const decoded = await getAdmin().auth().verifyIdToken(idToken);
  const phone = decoded && decoded.phone_number;
  if (!phone) {
    throw new Error('ID token has no verified phone number');
  }
  return phone;
}

module.exports = { isEnabled, verifyPhoneToken };

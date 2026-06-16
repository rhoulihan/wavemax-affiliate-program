const express = require('express');
const router = express.Router();

/**
 * Expose the Firebase Web app config + the phone-verification feature flag to
 * the bag-claim registration page (PR 7). The Web config is public by design
 * (it ships in the page when using Firebase Hosting); the abuse protection is
 * reCAPTCHA Enterprise + authorized-domain restrictions, not config secrecy.
 * The Admin service-account credential (the real secret) is never surfaced.
 */
router.get('/firebase-config', (req, res) => {
  res.json({
    enabled: process.env.PHONE_VERIFICATION_ENABLED === 'true',
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  });
});

module.exports = router;

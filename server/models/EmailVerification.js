// EmailVerification — short-lived email OTP record for bag-claim registration (PR 7).
//
// The customer requests a 6-digit code for (bagToken, email); we store the
// SHA-256 of the bag token (never the raw token) and a PBKDF2 "hash:salt" of
// the code. On a correct entry we mint a one-time verificationToken that the
// register endpoint re-verifies server-side. TTL-purged after 10 minutes.

const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  // SHA-256 hex of the bag token — scopes the OTP to the scanned bag.
  bagTokenHash: { type: String, required: true },
  // Lowercased email the code was sent to.
  email: { type: String, required: true },
  // PBKDF2 "hash:salt" of the 6-digit code (roleCodes.hashCode).
  codeHash: { type: String, required: true },
  verified: { type: Boolean, default: false },
  // SHA-256 hex token minted on successful verification; consumed at register.
  verificationToken: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  // TTL anchor — Mongo purges the document 10 minutes after creation/refresh.
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

emailVerificationSchema.index({ bagTokenHash: 1, email: 1 });
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);

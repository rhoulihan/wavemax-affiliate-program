const mongoose = require('mongoose');

// Single-document store for the site access-gate password.
// Only the PBKDF2 salt + hash are stored — the plaintext password is never
// persisted and no API route reads this collection. Read server-side only by
// the accessGate middleware.
const accessGateSchema = new mongoose.Schema({
  key: { type: String, default: 'gate', unique: true },
  salt: { type: String, required: true },
  hash: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AccessGate', accessGateSchema);

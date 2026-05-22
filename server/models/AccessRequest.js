const mongoose = require('mongoose');

// A pending access-gate request: the single-use token (the URL parameter sent
// in the email) associated with the email address that was submitted on the
// landing form. Clicking the emailed link and confirming whitelists the
// clicking IP. Tokens are single-use and expire (checked in code — no TTL
// index, since the Oracle ADB Mongo API requires CREATE JOB for TTL).
const accessRequestSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  next: { type: String, default: '/' },
  requestIp: { type: String },   // IP that submitted the form (cluster-global send throttle)
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
  usedIp: { type: String }
});

module.exports = mongoose.model('AccessRequest', accessRequestSchema);

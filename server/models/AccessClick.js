const mongoose = require('mongoose');

// Click/traffic log for whitelisted IPs whose trackClicks flag is true
// (i.e. every whitelisted IP except the seeded admin IP). One document per
// request that passes the gate. Append-only log; not auto-expired.
const accessClickSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  ts: { type: Date, default: Date.now },
  method: String,
  host: String,
  path: String,
  userAgent: String,
  referer: String
});

accessClickSchema.index({ ip: 1, ts: -1 });

module.exports = mongoose.model('AccessClick', accessClickSchema);

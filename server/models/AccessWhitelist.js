const mongoose = require('mongoose');

// IPs allowed past the access gate. An IP is added either by seeding (the
// admin "this IP", trackClicks=false) or by entering the correct password
// (trackClicks=true → its subsequent traffic is recorded in AccessClick).
const accessWhitelistSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  addedAt: { type: Date, default: Date.now },
  addedVia: { type: String, enum: ['seed', 'password'], default: 'password' },
  trackClicks: { type: Boolean, default: true },
  lastSeenAt: { type: Date }
});

module.exports = mongoose.model('AccessWhitelist', accessWhitelistSchema);

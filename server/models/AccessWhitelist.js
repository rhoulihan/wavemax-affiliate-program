const mongoose = require('mongoose');

// IPs allowed past the access gate. An IP is added either by seeding (the admin
// "this IP", trackClicks=false) or by clicking the verified link emailed after
// the password+email landing form ('email-link', trackClicks=true → its
// subsequent traffic is recorded in AccessClick). `email` records who unlocked
// the IP (the verified address tied to the link's token).
const accessWhitelistSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  email: { type: String },
  addedAt: { type: Date, default: Date.now },
  addedVia: { type: String, enum: ['seed', 'password', 'email-link'], default: 'email-link' },
  trackClicks: { type: Boolean, default: true },
  lastSeenAt: { type: Date }
});

module.exports = mongoose.model('AccessWhitelist', accessWhitelistSchema);

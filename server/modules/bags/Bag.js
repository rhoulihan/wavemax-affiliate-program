// Durable Bag — spec §4.1.
//
// The QR encodes an opaque random token (no PII, no sequential ids). The
// canonical lookup + uniqueness key is tokenHash = HMAC-SHA256(token) keyed
// by ENCRYPTION_KEY; the raw token is stored ONLY to regenerate label QR
// images and is never a query key (at-rest hardening, spec §13 #1).
//
// The durable Bag never changes status during the order lifecycle: once
// 'active' it stays 'active' across every order forever. The Order tracks
// the wash; the Bag persists.

const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bagSchema = new mongoose.Schema({
  bagId: { type: String, default: () => 'BAG-' + uuidv4(), unique: true, index: true }, // internal stable id (== Order.bagId)
  token: { type: String, required: true },                                  // raw opaque QR payload — label regen only, NOT a query key
  tokenHash: { type: String, required: true, unique: true, index: true },   // HMAC-SHA256(token) — canonical lookup + uniqueness key
  affiliateId: { type: String, required: true, ref: 'Affiliate', index: true }, // set at mint
  customerId: { type: String, default: null, ref: 'Customer', index: true },    // null until claimed
  status: { type: String, enum: ['minted', 'issued', 'active', 'retired'], default: 'minted', index: true },
  // Issuance / batch metadata
  batchId: { type: String, index: true },           // groups one mint run -> one label sheet
  mintedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  mintedAt: { type: Date, default: Date.now },
  issuedAt: Date,                                    // status -> issued
  claimedAt: Date,                                   // status -> active
  // FUTURE hooks — schema present, no logic built this phase:
  retiredAt: Date,
  retiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  retiredReason: String,
  reassignmentHistory: [{
    fromCustomerId: String, toCustomerId: String, at: Date,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' }, reason: String
  }],
  // Lifetime counters (analytics; not load-bearing)
  orderCount: { type: Number, default: 0 },          // incremented at each store intake
  lastIntakeAt: Date
}, { timestamps: true });

bagSchema.index({ affiliateId: 1, status: 1 });      // admin issue, affiliate inventory
bagSchema.index({ customerId: 1, status: 1 });       // "find this customer's active bag(s)"

bagSchema.statics.hashToken = (raw) =>
  crypto.createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY, 'hex')).update(raw).digest('hex');

// Atomic, lost-update-safe claim. Queries by tokenHash (the canonical key).
// Claimable ONLY from 'issued' (issuing is the admin act that authorizes
// claiming) — consistent with resolveByToken/resolveClaimToken (minted ->
// 'invalid'). Returns the updated doc, or null if it lost the race or the
// bag is not yet issued.
bagSchema.statics.claim = function (token, customerId) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(token), status: 'issued', customerId: null },
    { $set: { customerId, status: 'active', claimedAt: new Date() } },
    { new: true }
  );
};

module.exports = mongoose.model('Bag', bagSchema);

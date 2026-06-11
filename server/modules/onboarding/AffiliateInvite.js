// AffiliateInvite — admin-minted, single-use, expiring invite for affiliate
// onboarding (spec §4.2). The raw token is NEVER persisted: only its SHA-256
// hash is stored; the raw value exists solely in the emailed link.

const mongoose = require('mongoose');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const affiliateInviteSchema = new mongoose.Schema({
  inviteId:  { type: String, unique: true, index: true, default: () => 'INV-' + uuidv4() },
  tokenHash: { type: String, required: true, index: true },   // sha256(rawToken), hex
  email:     { type: String, required: true, lowercase: true, trim: true, index: true },
  prefill: { firstName: String, lastName: String, businessName: String, phone: String }, // read-only hints
  status:    { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: true },      // now + invite_token_ttl_hours
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator', required: true },
  acceptedAt: Date,
  acceptedAffiliateId: String,                                 // the AFF-… created on accept
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
  sentAt:    Date,
  resendCount: { type: Number, default: 0 }
}, { timestamps: true });

affiliateInviteSchema.statics.hashToken = (raw) =>
  crypto.createHash('sha256').update(raw).digest('hex');

// Atomic single-use consume: only flips a pending, unexpired invite to accepted.
affiliateInviteSchema.statics.consume = function (rawToken, { affiliateId }) {
  return this.findOneAndUpdate(
    { tokenHash: this.hashToken(rawToken), status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'accepted', acceptedAt: new Date(), acceptedAffiliateId: affiliateId } },
    { new: true }
  );
};

module.exports = mongoose.model('AffiliateInvite', affiliateInviteSchema);

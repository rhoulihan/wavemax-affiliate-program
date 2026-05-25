const mongoose = require('mongoose');

// A franchise owner's self-serve content-preview grant. Created when an
// authorized representative submits the "See it for yourself" form on
// crhsent.com/wavemax (Google Business Profile link + email + attestation).
//
// Unlike AccessRequest (single-use), the `token` here is a REUSABLE URL key:
// it gates the crhsent.com/<locationSlug> route (the route 404s without a
// valid key) and stays active so the owner can re-unlock after the 1-hour
// content window expires. The per-request `password` (PBKDF2-hashed, mailed
// once) is the second factor that opens the 1-hour view.
//
// No TTL index (Oracle ADB Mongo API rejects them); grants are low-volume and
// revocable via `revokedAt`.
const franchisePreviewRequestSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },   // reusable URL key (gates the route)
  locationSlug: { type: String, required: true, index: true }, // crhsent.com/<locationSlug>
  placeId: { type: String, required: true },               // resolved Google place id
  businessName: { type: String },                          // from Places — confirmation + localization
  formattedAddress: { type: String },                      // from Places
  email: { type: String, required: true },                 // where the key + password were sent
  passwordSalt: { type: String, required: true },          // per-request password (PBKDF2)
  passwordHash: { type: String, required: true },
  gbpData: { type: mongoose.Schema.Types.Mixed },          // cached GBP-derived data for light localization
  attestation: {                                           // legal audit of the authorized-rep checkbox
    acceptedAt: { type: Date },
    ip: { type: String },
    version: { type: String }                              // disclaimer copy version accepted
  },
  requestIp: { type: String },                             // IP that submitted the form (send throttle)
  createdAt: { type: Date, default: Date.now },
  lastUnlockedAt: { type: Date },                          // audit: last successful password unlock
  revokedAt: { type: Date, default: null }                // set to revoke a grant
});

module.exports = mongoose.model('FranchisePreviewRequest', franchisePreviewRequestSchema);

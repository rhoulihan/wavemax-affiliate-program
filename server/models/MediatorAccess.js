// MediatorAccess — cluster-safe store binding one gate password to the first IP
// that authenticates with it, plus an access log. Used by mediatorGate to make a
// shared password single-viewer: once a password is opened from an IP, the same
// password from any other IP is denied. Persisted in MongoDB (not a signed
// cookie) because the binding is durable state that must be consistent across
// PM2 cluster workers and survive restarts. The password itself is never stored;
// only a SHA-256 hash of it keys the record.
'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

/** Stable, non-reversible key for a gate password. */
function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

const accessEntrySchema = new mongoose.Schema({
  ip: String,
  at: { type: Date, default: Date.now },
  result: { type: String, enum: ['bound', 'allowed', 'denied_wrong_ip', 'denied_bad_password'] }
}, { _id: false });

const mediatorAccessSchema = new mongoose.Schema({
  passwordHash: { type: String, required: true, unique: true, index: true },
  label: String,                 // optional human label (e.g. "mediator", "opposing counsel")
  boundIp: { type: String, default: null },
  boundAt: Date,
  lastAccessAt: Date,
  hits: { type: Number, default: 0 },
  accessLog: { type: [accessEntrySchema], default: [] }
}, { timestamps: true, collection: 'mediatoraccess' });

/**
 * Attempt to authorize `ip` for `password`. Returns one of:
 *   { ok: true,  reason: 'bound'|'allowed', hash }   — grant access
 *   { ok: false, reason: 'denied_wrong_ip', hash }   — right password, wrong IP
 * The caller is responsible for validating the password against the configured
 * list first; this method only manages the IP binding for an already-valid one.
 * Concurrency-safe: the initial bind uses an atomic conditional update so two
 * simultaneous first-requests cannot bind different IPs.
 */
mediatorAccessSchema.statics.authorize = async function authorize(password, ip, label) {
  const passwordHash = hashPassword(password);
  const entry = (result) => ({ ip, at: new Date(), result });

  // Ensure a record exists (upsert, unbound).
  await this.updateOne(
    { passwordHash },
    { $setOnInsert: { passwordHash, label: label || null, boundIp: null, hits: 0, accessLog: [] } },
    { upsert: true }
  );

  // Atomic first-bind: only binds when still unbound.
  const bound = await this.findOneAndUpdate(
    { passwordHash, boundIp: null },
    { $set: { boundIp: ip, boundAt: new Date(), lastAccessAt: new Date() }, $inc: { hits: 1 }, $push: { accessLog: entry('bound') } },
    { new: true }
  );
  if (bound) return { ok: true, reason: 'bound', hash: passwordHash };

  // Already bound — allow only the bound IP.
  const rec = await this.findOne({ passwordHash });
  if (rec && rec.boundIp === ip) {
    await this.updateOne({ passwordHash }, { $set: { lastAccessAt: new Date() }, $inc: { hits: 1 }, $push: { accessLog: entry('allowed') } });
    return { ok: true, reason: 'allowed', hash: passwordHash };
  }
  await this.updateOne({ passwordHash }, { $push: { accessLog: entry('denied_wrong_ip') } });
  return { ok: false, reason: 'denied_wrong_ip', hash: passwordHash };
};

/** Clear the IP binding for a password (admin reset when a viewer's IP changes). */
mediatorAccessSchema.statics.resetBinding = async function resetBinding(password) {
  const passwordHash = hashPassword(password);
  const r = await this.updateOne({ passwordHash }, { $set: { boundIp: null, boundAt: null } });
  return r.modifiedCount > 0 || r.matchedCount > 0;
};

mediatorAccessSchema.statics.hashPassword = hashPassword;

module.exports = mongoose.model('MediatorAccess', mediatorAccessSchema);

// One-time seed for the site access gate.
//   ACCESS_GATE_PASSWORD=... ADMIN_IP=... node scripts/seed-access-gate.js
// - Stores ONLY the PBKDF2 hash+salt of the password (plaintext never persisted).
// - Creates the unique indexes (autoIndex is disabled app-wide).
// - Seeds the admin IP into the whitelist with trackClicks=false ("this IP").
require('dotenv').config();
const mongoose = require('mongoose');
const { hashPassword } = require('../server/utils/encryption');
const AccessGate = require('../server/models/AccessGate');
const AccessWhitelist = require('../server/models/AccessWhitelist');
const AccessClick = require('../server/models/AccessClick');
const AccessRequest = require('../server/models/AccessRequest');

const PASSWORD = process.env.ACCESS_GATE_PASSWORD;
const ADMIN_IP = process.env.ADMIN_IP || process.argv[2];

(async () => {
  if (!PASSWORD) { console.error('ERROR: set ACCESS_GATE_PASSWORD'); process.exit(1); }
  const tls = process.env.MONGODB_TLS === 'false'
    ? {}
    : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };
  await mongoose.connect(process.env.MONGODB_URI, { ...tls, autoIndex: false });
  console.log('connected to', mongoose.connection.name);

  // 1) password hash (plaintext discarded)
  const { salt, hash } = hashPassword(PASSWORD);
  await AccessGate.updateOne({ key: 'gate' }, { $set: { salt, hash, updatedAt: new Date() } }, { upsert: true });
  console.log('access password hash stored (plaintext not persisted)');

  // 2) indexes (autoIndex is off app-wide)
  const mk = async (model, spec, opts, label) => {
    try { await model.collection.createIndex(spec, opts || {}); console.log('  index ok:', label); }
    catch (e) { console.log('  index note', label + ':', e.message.split('\n')[0]); }
  };
  await mk(AccessGate, { key: 1 }, { unique: true }, 'AccessGate.key');
  await mk(AccessWhitelist, { ip: 1 }, { unique: true }, 'AccessWhitelist.ip');
  await mk(AccessClick, { ip: 1, ts: -1 }, {}, 'AccessClick.ip_ts');
  await mk(AccessRequest, { token: 1 }, { unique: true }, 'AccessRequest.token');

  // 3) seed admin IP — whitelisted, NOT click-tracked ("this IP")
  if (ADMIN_IP) {
    await AccessWhitelist.updateOne(
      { ip: ADMIN_IP },
      { $set: { trackClicks: false, lastSeenAt: new Date() }, $setOnInsert: { ip: ADMIN_IP, addedAt: new Date(), addedVia: 'seed' } },
      { upsert: true }
    );
    console.log('seeded admin IP (whitelisted, no click tracking):', ADMIN_IP);
  } else {
    console.log('no ADMIN_IP provided — admin IP not seeded (unlock via password instead)');
  }

  console.log('whitelist count:', await AccessWhitelist.countDocuments());
  await mongoose.disconnect();
  console.log('done');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

// ADB heartbeat — keeps the Oracle Always-Free Autonomous Database active.
//
// Always-Free ADB is auto-stopped after 7 consecutive days of inactivity (and
// eventually reclaimed). The running app already touches the DB continuously,
// but this standalone script is an independent backstop for windows where the
// app is down/paused while the server stays up: run from cron, it connects,
// issues one trivial read, and exits. A read every few hours keeps activity far
// inside the 7-day window.
//
//   node scripts/adb-heartbeat.js
// Cron (every 6h), logging to a file:
//   0 */6 * * * cd /var/www/wavemax/wavemax-affiliate-program && \
//     /usr/bin/node scripts/adb-heartbeat.js >> /var/log/adb-heartbeat.log 2>&1
require('dotenv').config();
const mongoose = require('mongoose');

// One real read against a user collection — guaranteed to count as DB activity
// (more reliable than an admin ping, which the ADB Mongo API may not expose).
async function heartbeat(conn) {
  return conn.db.collection('systemconfigs').findOne({}, { projection: { _id: 1 } });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('adb-heartbeat: MONGODB_URI not set');
    process.exit(1);
  }
  const opts = {
    tls: process.env.MONGODB_TLS !== 'false',
    tlsAllowInvalidCertificates: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 20000
  };
  await mongoose.connect(uri, opts);
  await heartbeat(mongoose.connection);
  console.log(`adb-heartbeat ok ${new Date().toISOString()}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(`adb-heartbeat FAILED ${new Date().toISOString()}: ${e.message}`); process.exit(1); });
}

module.exports = { heartbeat };

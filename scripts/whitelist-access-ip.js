// Add / remove / list IPs on the crhsent.com access gate whitelist, WITHOUT
// touching the gate password (unlike seed-access-gate.js, which re-hashes it).
//
// Add a permanent admin IP (whitelisted, NOT click-tracked):
//     ADMIN_IP=1.2.3.4 node scripts/whitelist-access-ip.js
//     node scripts/whitelist-access-ip.js 1.2.3.4
// Remove an IP:
//     node scripts/whitelist-access-ip.js --remove 1.2.3.4
// List all whitelisted IPs:
//     node scripts/whitelist-access-ip.js --list
//
// Entries never expire — an add here is a PERMANENT whitelist. The running app
// picks it up within ~60s (cache refresh) or immediately on `pm2 reload`.
// The IP must be the address Cloudflare forwards as `cf-connecting-ip` (the
// visitor's public IP). No IP is hardcoded here — pass it at runtime.
require('dotenv').config();
const mongoose = require('mongoose');
const AccessWhitelist = require('../server/models/AccessWhitelist');

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const list = args.includes('--list');
const ip = process.env.ADMIN_IP || args.find((a) => !a.startsWith('--'));

(async () => {
  if (!list && !ip) {
    console.error('ERROR: provide an IP (ADMIN_IP=… or as an argument), or use --list');
    process.exit(1);
  }
  const tls = process.env.MONGODB_TLS === 'false'
    ? {}
    : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };
  await mongoose.connect(process.env.MONGODB_URI, { ...tls, autoIndex: false });
  console.log('connected to', mongoose.connection.name);

  if (list) {
    const all = await AccessWhitelist.find({}, { ip: 1, addedVia: 1, trackClicks: 1, addedAt: 1, email: 1 }).lean();
    console.log(`whitelisted IPs (${all.length}):`);
    all.forEach((w) => console.log(`  ${w.ip}  [${w.addedVia}, trackClicks=${w.trackClicks !== false}${w.email ? ', ' + w.email : ''}]`));
  } else if (remove) {
    const r = await AccessWhitelist.deleteOne({ ip });
    console.log(r.deletedCount ? `removed ${ip}` : `${ip} was not on the whitelist`);
  } else {
    await AccessWhitelist.updateOne(
      { ip },
      { $set: { trackClicks: false, lastSeenAt: new Date() }, $setOnInsert: { ip, addedAt: new Date(), addedVia: 'seed' } },
      { upsert: true }
    );
    console.log('whitelisted (permanent, no click tracking):', ip);
  }

  console.log('whitelist count:', await AccessWhitelist.countDocuments());
  await mongoose.disconnect();
  console.log('done');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

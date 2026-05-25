// Revoke franchise-preview grant(s) — sets revokedAt, after which the gated route
// 404s and the unlock fails. Stateless unlock cookies already issued expire on
// their own within the hour.
//
//   node scripts/revoke-franchise-preview.js --token <token>
//   node scripts/revoke-franchise-preview.js --slug  <slug>
//   node scripts/revoke-franchise-preview.js --email <email>
//   node scripts/revoke-franchise-preview.js --list            (show active grants)
require('dotenv').config();
const mongoose = require('mongoose');
const FranchisePreviewRequest = require('../server/models/FranchisePreviewRequest');
const { logAuditEvent, AuditEvents } = require('../server/utils/auditLogger');

(async () => {
  const [flag, value] = process.argv.slice(2);
  const fieldByFlag = { '--token': 'token', '--slug': 'locationSlug', '--email': 'email' };

  const tls = process.env.MONGODB_TLS === 'false'
    ? {}
    : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };
  await mongoose.connect(process.env.MONGODB_URI, { ...tls, autoIndex: false });

  if (flag === '--list') {
    const active = await FranchisePreviewRequest.find({ revokedAt: null })
      .select('locationSlug businessName email createdAt lastUnlockedAt').sort({ createdAt: -1 }).lean();
    console.log(`active grants: ${active.length}`);
    active.forEach((g) => console.log(`  ${g.locationSlug}  ${g.businessName || ''}  <${g.email}>  created ${g.createdAt && g.createdAt.toISOString()}  lastUnlock ${g.lastUnlockedAt ? g.lastUnlockedAt.toISOString() : '—'}`));
    await mongoose.disconnect();
    return;
  }

  const field = fieldByFlag[flag];
  if (!field || !value) {
    console.error('usage: --token|--slug|--email <value>   (or --list)');
    process.exit(1);
  }

  const res = await FranchisePreviewRequest.updateMany(
    { [field]: value, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  console.log(`revoked ${res.modifiedCount} grant(s) where ${field} = ${value}`);
  logAuditEvent(AuditEvents.PREVIEW_REVOKED, { field, value, count: res.modifiedCount });

  await mongoose.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

// Create a franchise-preview grant directly (bypasses the modal / email / Turnstile),
// for a visual smoke test of the gated route + unlock + rendered preview.
// Prints the unlock URL and the password.
//
//   GOOGLE_PLACES_API_KEY=... node scripts/create-franchise-preview.js "<google business link>" [email] [slugOverride]
//   GOOGLE_PLACES_API_KEY=... node scripts/create-franchise-preview.js --text "WaveMAX Laundry, Austin TX" [email]
//
// Then (with FRANCHISE_PREVIEW_ENABLED=true on the box) open the printed URL and
// enter the printed password. The unlock GET/POST do NOT require Turnstile.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const gbp = require('../server/services/gbpService');
const FranchisePreviewRequest = require('../server/models/FranchisePreviewRequest');
const { hashPassword } = require('../server/utils/encryption');
const { DISCLAIMER_VERSION } = require('../server/config/franchisePreviewCopy');
const fp = require('../server/middleware/franchisePreview');

(async () => {
  const args = process.argv.slice(2);
  let useText = false, query = '', email = 'preview@example.com', slugOverride = null;
  if (args[0] === '--text') { useText = true; query = args[1]; email = args[2] || email; }
  else { query = args[0]; email = args[1] || email; slugOverride = args[2] || null; }
  if (!query) { console.error('usage: create-franchise-preview.js "<gbp link>" [email] [slug]  |  --text "<name, city>" [email]'); process.exit(1); }

  const tls = process.env.MONGODB_TLS === 'false'
    ? {}
    : { tls: true, tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production' };
  await mongoose.connect(process.env.MONGODB_URI, { ...tls, autoIndex: false });
  console.log('connected to', mongoose.connection.name);

  // Indexes (autoIndex is off app-wide).
  try { await FranchisePreviewRequest.collection.createIndex({ token: 1 }, { unique: true }); } catch (e) { /* exists */ }
  try { await FranchisePreviewRequest.collection.createIndex({ locationSlug: 1 }); } catch (e) { /* exists */ }

  console.log('resolving Google business…');
  const details = useText ? await gbp.resolveByText(query) : await gbp.resolveGbpLink(query);

  const token = crypto.randomBytes(32).toString('hex');
  const password = fp._internals.genPassword();
  const { salt, hash } = hashPassword(password);
  const slug = slugOverride || fp._internals.locationSlug(details);

  await FranchisePreviewRequest.create({
    token, locationSlug: slug, placeId: details.placeId,
    businessName: details.name, formattedAddress: details.formattedAddress,
    email, passwordSalt: salt, passwordHash: hash, gbpData: details,
    attestation: { acceptedAt: new Date(), ip: 'script', version: DISCLAIMER_VERSION },
    requestIp: 'script', createdAt: new Date()
  });

  console.log('\n=== Franchise preview created ===');
  console.log('Business :', details.name);
  console.log('Address  :', details.formattedAddress);
  console.log('Slug     :', slug);
  console.log('Unlock   : https://crhsent.com/' + slug + '?key=' + token);
  console.log('Password :', password);
  console.log('\n(Set FRANCHISE_PREVIEW_ENABLED=true on the box; the GET + unlock do not need Turnstile.)');

  await mongoose.disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

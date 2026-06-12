#!/usr/bin/env node
// Seeds one affiliate + one ISSUED bag and prints the claim URL, so the
// /claim page can be measured (Lighthouse) or smoke-tested locally.
// Usage: node scripts/seed-claim-bag.js   (needs .env: MONGODB_URI, ENCRYPTION_KEY)
'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const encryptionUtil = require('../server/utils/encryption');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate');
  const Bag = require('../server/modules/bags/Bag');

  const affiliateId = 'AFF-' + uuidv4();
  // Minimal affiliate via the collection — bypasses password/required-field churn;
  // the claim resolver reads only affiliateId/businessName/name fields/isActive.
  await mongoose.connection.collection('affiliates').insertOne({
    affiliateId,
    firstName: 'Lighthouse',
    lastName: 'Seed',
    businessName: 'WaveMAX Lighthouse Test',
    email: `lh-seed-${Date.now()}@example.com`,
    isActive: true,
    languagePreference: 'en',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const token = encryptionUtil.generateToken(16); // 32 hex chars (spec §4.1 canon)
  const bag = await Bag.create({
    token,
    tokenHash: Bag.hashToken(token),
    affiliateId,
    status: 'issued',
    batchId: 'BATCH-' + uuidv4()
  });

  console.log('bagId:     ', bag.bagId);
  console.log('claim URL: ', `http://localhost:3000/embed-app-v2.html?route=/claim&bag=${token}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });

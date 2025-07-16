#!/usr/bin/env node

/**
 * Reverse Migration Script: Decrypt OAuth Tokens
 * 
 * This script decrypts OAuth tokens back to plain text.
 * USE WITH CAUTION: This reduces security. Only use if absolutely necessary.
 * 
 * Usage: node scripts/decrypt-oauth-tokens.js --confirm
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { decryptFromString } = require('../server/utils/encryption');
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');

// Require explicit confirmation
if (!process.argv.includes('--confirm')) {
  console.error('⚠️  WARNING: This script will decrypt OAuth tokens, reducing security!');
  console.error('To confirm, run: node scripts/decrypt-oauth-tokens.js --confirm');
  process.exit(1);
}

// Check if encryption key is available
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY not found in environment variables');
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Check if a token is encrypted
 * Encrypted tokens contain a ':' separator between IV and encrypted data
 */
function isEncrypted(token) {
  return token && typeof token === 'string' && token.includes(':');
}

async function decryptAffiliateTokens() {
  console.log('\n🔄 Decrypting Affiliate OAuth tokens...');
  
  const affiliates = await Affiliate.find({
    $or: [
      { 'socialAccounts.google.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.facebook.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.linkedin.accessToken': { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${affiliates.length} affiliates with OAuth tokens`);

  let decrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const affiliate of affiliates) {
    try {
      let updated = false;

      // Google tokens
      if (affiliate.socialAccounts.google) {
        if (affiliate.socialAccounts.google.accessToken && isEncrypted(affiliate.socialAccounts.google.accessToken)) {
          affiliate.socialAccounts.google.accessToken = decryptFromString(affiliate.socialAccounts.google.accessToken);
          updated = true;
        }
        if (affiliate.socialAccounts.google.refreshToken && isEncrypted(affiliate.socialAccounts.google.refreshToken)) {
          affiliate.socialAccounts.google.refreshToken = decryptFromString(affiliate.socialAccounts.google.refreshToken);
          updated = true;
        }
      }

      // Facebook tokens
      if (affiliate.socialAccounts.facebook) {
        if (affiliate.socialAccounts.facebook.accessToken && isEncrypted(affiliate.socialAccounts.facebook.accessToken)) {
          affiliate.socialAccounts.facebook.accessToken = decryptFromString(affiliate.socialAccounts.facebook.accessToken);
          updated = true;
        }
      }

      // LinkedIn tokens
      if (affiliate.socialAccounts.linkedin) {
        if (affiliate.socialAccounts.linkedin.accessToken && isEncrypted(affiliate.socialAccounts.linkedin.accessToken)) {
          affiliate.socialAccounts.linkedin.accessToken = decryptFromString(affiliate.socialAccounts.linkedin.accessToken);
          updated = true;
        }
        if (affiliate.socialAccounts.linkedin.refreshToken && isEncrypted(affiliate.socialAccounts.linkedin.refreshToken)) {
          affiliate.socialAccounts.linkedin.refreshToken = decryptFromString(affiliate.socialAccounts.linkedin.refreshToken);
          updated = true;
        }
      }

      if (updated) {
        await affiliate.save({ validateBeforeSave: false });
        decrypted++;
        console.log(`✅ Decrypted tokens for affiliate: ${affiliate.affiliateId}`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped affiliate ${affiliate.affiliateId} - tokens not encrypted`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error processing affiliate ${affiliate.affiliateId}:`, error.message);
    }
  }

  console.log(`\nAffiliate decryption complete: ${decrypted} decrypted, ${skipped} skipped, ${errors} errors`);
}

async function decryptCustomerTokens() {
  console.log('\n🔄 Decrypting Customer OAuth tokens...');
  
  const customers = await Customer.find({
    $or: [
      { 'socialAccounts.google.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.facebook.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.linkedin.accessToken': { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${customers.length} customers with OAuth tokens`);

  let decrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const customer of customers) {
    try {
      let updated = false;

      // Google tokens
      if (customer.socialAccounts.google) {
        if (customer.socialAccounts.google.accessToken && isEncrypted(customer.socialAccounts.google.accessToken)) {
          customer.socialAccounts.google.accessToken = decryptFromString(customer.socialAccounts.google.accessToken);
          updated = true;
        }
        if (customer.socialAccounts.google.refreshToken && isEncrypted(customer.socialAccounts.google.refreshToken)) {
          customer.socialAccounts.google.refreshToken = decryptFromString(customer.socialAccounts.google.refreshToken);
          updated = true;
        }
      }

      // Facebook tokens
      if (customer.socialAccounts.facebook) {
        if (customer.socialAccounts.facebook.accessToken && isEncrypted(customer.socialAccounts.facebook.accessToken)) {
          customer.socialAccounts.facebook.accessToken = decryptFromString(customer.socialAccounts.facebook.accessToken);
          updated = true;
        }
      }

      // LinkedIn tokens
      if (customer.socialAccounts.linkedin) {
        if (customer.socialAccounts.linkedin.accessToken && isEncrypted(customer.socialAccounts.linkedin.accessToken)) {
          customer.socialAccounts.linkedin.accessToken = decryptFromString(customer.socialAccounts.linkedin.accessToken);
          updated = true;
        }
        if (customer.socialAccounts.linkedin.refreshToken && isEncrypted(customer.socialAccounts.linkedin.refreshToken)) {
          customer.socialAccounts.linkedin.refreshToken = decryptFromString(customer.socialAccounts.linkedin.refreshToken);
          updated = true;
        }
      }

      if (updated) {
        await customer.save({ validateBeforeSave: false });
        decrypted++;
        console.log(`✅ Decrypted tokens for customer: ${customer.customerId}`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped customer ${customer.customerId} - tokens not encrypted`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error processing customer ${customer.customerId}:`, error.message);
    }
  }

  console.log(`\nCustomer decryption complete: ${decrypted} decrypted, ${skipped} skipped, ${errors} errors`);
}

async function main() {
  console.log('🔓 OAuth Token Decryption Script');
  console.log('=================================');
  console.log('⚠️  WARNING: This will decrypt tokens, reducing security!\n');

  await connectDB();

  try {
    await decryptAffiliateTokens();
    await decryptCustomerTokens();

    console.log('\n✅ Decryption completed!');
    console.log('\n⚠️  SECURITY WARNING: OAuth tokens are now stored in plain text.');
    console.log('Consider re-encrypting them once you\'ve completed necessary operations.');
  } catch (error) {
    console.error('\n❌ Decryption failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the decryption
main().catch(console.error);
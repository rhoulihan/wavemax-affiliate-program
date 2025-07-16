#!/usr/bin/env node

/**
 * Migration Script: Encrypt OAuth Tokens
 * 
 * This script encrypts all existing plain-text OAuth tokens in the database.
 * It checks if tokens are already encrypted (contain ':' separator) to avoid double encryption.
 * 
 * Usage: node scripts/encrypt-oauth-tokens.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { encryptToString } = require('../server/utils/encryption');
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');

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
 * Check if a token is already encrypted
 * Encrypted tokens contain a ':' separator between IV and encrypted data
 */
function isEncrypted(token) {
  return token && typeof token === 'string' && token.includes(':');
}

async function migrateAffiliateTokens() {
  console.log('\n🔄 Migrating Affiliate OAuth tokens...');
  
  const affiliates = await Affiliate.find({
    $or: [
      { 'socialAccounts.google.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.facebook.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.linkedin.accessToken': { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${affiliates.length} affiliates with OAuth tokens`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const affiliate of affiliates) {
    try {
      let updated = false;

      // Google tokens
      if (affiliate.socialAccounts.google) {
        if (affiliate.socialAccounts.google.accessToken && !isEncrypted(affiliate.socialAccounts.google.accessToken)) {
          affiliate.socialAccounts.google.accessToken = encryptToString(affiliate.socialAccounts.google.accessToken);
          updated = true;
        }
        if (affiliate.socialAccounts.google.refreshToken && !isEncrypted(affiliate.socialAccounts.google.refreshToken)) {
          affiliate.socialAccounts.google.refreshToken = encryptToString(affiliate.socialAccounts.google.refreshToken);
          updated = true;
        }
      }

      // Facebook tokens (no refresh token for Facebook)
      if (affiliate.socialAccounts.facebook) {
        if (affiliate.socialAccounts.facebook.accessToken && !isEncrypted(affiliate.socialAccounts.facebook.accessToken)) {
          affiliate.socialAccounts.facebook.accessToken = encryptToString(affiliate.socialAccounts.facebook.accessToken);
          updated = true;
        }
      }

      // LinkedIn tokens
      if (affiliate.socialAccounts.linkedin) {
        if (affiliate.socialAccounts.linkedin.accessToken && !isEncrypted(affiliate.socialAccounts.linkedin.accessToken)) {
          affiliate.socialAccounts.linkedin.accessToken = encryptToString(affiliate.socialAccounts.linkedin.accessToken);
          updated = true;
        }
        if (affiliate.socialAccounts.linkedin.refreshToken && !isEncrypted(affiliate.socialAccounts.linkedin.refreshToken)) {
          affiliate.socialAccounts.linkedin.refreshToken = encryptToString(affiliate.socialAccounts.linkedin.refreshToken);
          updated = true;
        }
      }

      if (updated) {
        await affiliate.save({ validateBeforeSave: false });
        migrated++;
        console.log(`✅ Encrypted tokens for affiliate: ${affiliate.affiliateId}`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped affiliate ${affiliate.affiliateId} - tokens already encrypted`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error processing affiliate ${affiliate.affiliateId}:`, error.message);
    }
  }

  console.log(`\nAffiliate migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

async function migrateCustomerTokens() {
  console.log('\n🔄 Migrating Customer OAuth tokens...');
  
  const customers = await Customer.find({
    $or: [
      { 'socialAccounts.google.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.facebook.accessToken': { $exists: true, $ne: null } },
      { 'socialAccounts.linkedin.accessToken': { $exists: true, $ne: null } }
    ]
  });

  console.log(`Found ${customers.length} customers with OAuth tokens`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const customer of customers) {
    try {
      let updated = false;

      // Google tokens
      if (customer.socialAccounts.google) {
        if (customer.socialAccounts.google.accessToken && !isEncrypted(customer.socialAccounts.google.accessToken)) {
          customer.socialAccounts.google.accessToken = encryptToString(customer.socialAccounts.google.accessToken);
          updated = true;
        }
        if (customer.socialAccounts.google.refreshToken && !isEncrypted(customer.socialAccounts.google.refreshToken)) {
          customer.socialAccounts.google.refreshToken = encryptToString(customer.socialAccounts.google.refreshToken);
          updated = true;
        }
      }

      // Facebook tokens (no refresh token for Facebook)
      if (customer.socialAccounts.facebook) {
        if (customer.socialAccounts.facebook.accessToken && !isEncrypted(customer.socialAccounts.facebook.accessToken)) {
          customer.socialAccounts.facebook.accessToken = encryptToString(customer.socialAccounts.facebook.accessToken);
          updated = true;
        }
      }

      // LinkedIn tokens
      if (customer.socialAccounts.linkedin) {
        if (customer.socialAccounts.linkedin.accessToken && !isEncrypted(customer.socialAccounts.linkedin.accessToken)) {
          customer.socialAccounts.linkedin.accessToken = encryptToString(customer.socialAccounts.linkedin.accessToken);
          updated = true;
        }
        if (customer.socialAccounts.linkedin.refreshToken && !isEncrypted(customer.socialAccounts.linkedin.refreshToken)) {
          customer.socialAccounts.linkedin.refreshToken = encryptToString(customer.socialAccounts.linkedin.refreshToken);
          updated = true;
        }
      }

      if (updated) {
        await customer.save({ validateBeforeSave: false });
        migrated++;
        console.log(`✅ Encrypted tokens for customer: ${customer.customerId}`);
      } else {
        skipped++;
        console.log(`⏭️  Skipped customer ${customer.customerId} - tokens already encrypted`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error processing customer ${customer.customerId}:`, error.message);
    }
  }

  console.log(`\nCustomer migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

async function main() {
  console.log('🔐 OAuth Token Encryption Migration Script');
  console.log('==========================================\n');

  await connectDB();

  try {
    await migrateAffiliateTokens();
    await migrateCustomerTokens();

    console.log('\n✅ Migration completed successfully!');
    console.log('\nIMPORTANT: This migration is one-way. Tokens cannot be decrypted without the encryption key.');
    console.log('Make sure to backup your ENCRYPTION_KEY environment variable!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the migration
main().catch(console.error);
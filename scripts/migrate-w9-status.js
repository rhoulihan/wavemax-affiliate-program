#!/usr/bin/env node

// Migration script to add W-9 status to existing affiliates
// Run with: node scripts/migrate-w9-status.js

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Affiliate = require('../server/models/Affiliate');

async function migrateW9Status() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wavemax_affiliate';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all affiliates without w9Information
    const affiliatesWithoutW9 = await Affiliate.find({
      'w9Information': { $exists: false }
    });

    console.log(`Found ${affiliatesWithoutW9.length} affiliates without W-9 information`);

    // Update each affiliate
    let updated = 0;
    let failed = 0;

    for (const affiliate of affiliatesWithoutW9) {
      try {
        // Set default W-9 information
        affiliate.w9Information = {
          status: 'not_submitted',
          quickbooksData: {
            vendorType: '1099 Contractor',
            terms: 'Net 15',
            defaultExpenseAccount: 'Commission Expense'
          }
        };

        await affiliate.save();
        updated++;
        console.log(`Updated affiliate ${affiliate.affiliateId} - ${affiliate.email}`);
      } catch (error) {
        console.error(`Failed to update affiliate ${affiliate.affiliateId}:`, error.message);
        failed++;
      }
    }

    // Also check for affiliates with partial w9Information
    const affiliatesWithPartialW9 = await Affiliate.find({
      'w9Information': { $exists: true },
      'w9Information.status': { $exists: false }
    });

    console.log(`\nFound ${affiliatesWithPartialW9.length} affiliates with partial W-9 information`);

    for (const affiliate of affiliatesWithPartialW9) {
      try {
        // Ensure all required fields exist
        if (!affiliate.w9Information.status) {
          affiliate.w9Information.status = 'not_submitted';
        }
        if (!affiliate.w9Information.quickbooksData) {
          affiliate.w9Information.quickbooksData = {
            vendorType: '1099 Contractor',
            terms: 'Net 15',
            defaultExpenseAccount: 'Commission Expense'
          };
        }

        await affiliate.save();
        updated++;
        console.log(`Updated partial W-9 for affiliate ${affiliate.affiliateId} - ${affiliate.email}`);
      } catch (error) {
        console.error(`Failed to update partial W-9 for affiliate ${affiliate.affiliateId}:`, error.message);
        failed++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total affiliates processed: ${affiliatesWithoutW9.length + affiliatesWithPartialW9.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);

    // Verify migration
    const totalAffiliates = await Affiliate.countDocuments();
    const affiliatesWithW9Status = await Affiliate.countDocuments({
      'w9Information.status': { $exists: true }
    });

    console.log(`\nTotal affiliates in database: ${totalAffiliates}`);
    console.log(`Affiliates with W-9 status: ${affiliatesWithW9Status}`);

    if (totalAffiliates === affiliatesWithW9Status) {
      console.log('\n✅ Migration completed successfully! All affiliates have W-9 status.');
    } else {
      console.log(`\n⚠️  Migration incomplete. ${totalAffiliates - affiliatesWithW9Status} affiliates still missing W-9 status.`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run migration
console.log('Starting W-9 status migration...\n');
migrateW9Status()
  .then(() => {
    console.log('\nMigration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration process failed:', error);
    process.exit(1);
  });
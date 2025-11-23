#!/usr/bin/env node

/**
 * Migration Script: Add Default Availability Schedule to Existing Affiliates
 *
 * This script adds the default availabilitySchedule field to all existing affiliates
 * who don't have one. The default schedule is:
 * - Monday-Saturday: All time slots available (morning, afternoon, evening)
 * - Sunday: Unavailable
 * - Default booking settings: 1 day advance, 30 days max, America/Chicago timezone
 *
 * Usage:
 *   node scripts/migrations/add-affiliate-schedule-defaults.js
 *
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *   --verbose    Show detailed logging
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Affiliate = require('../../server/models/Affiliate');

const isDryRun = process.argv.includes('--dry-run');
const isVerbose = process.argv.includes('--verbose');

// Default availability schedule
const defaultSchedule = {
  weeklyTemplate: {
    monday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    tuesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    wednesday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    thursday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    friday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    saturday: { enabled: true, timeSlots: { morning: true, afternoon: true, evening: true } },
    sunday: { enabled: false, timeSlots: { morning: false, afternoon: false, evening: false } }
  },
  dateExceptions: [],
  scheduleSettings: {
    advanceBookingDays: 1,
    maxBookingDays: 30,
    timezone: 'America/Chicago'
  }
};

async function migrate() {
  console.log('====================================');
  console.log('Affiliate Schedule Migration Script');
  console.log('====================================');

  if (isDryRun) {
    console.log('** DRY RUN MODE - No changes will be made **\n');
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully.\n');

    // Find affiliates without availability schedule
    const affiliatesWithoutSchedule = await Affiliate.find({
      $or: [
        { availabilitySchedule: { $exists: false } },
        { availabilitySchedule: null },
        { 'availabilitySchedule.weeklyTemplate': { $exists: false } }
      ]
    });

    console.log(`Found ${affiliatesWithoutSchedule.length} affiliates without schedule.\n`);

    if (affiliatesWithoutSchedule.length === 0) {
      console.log('All affiliates already have availability schedules. Nothing to migrate.');
      await mongoose.connection.close();
      return;
    }

    let updated = 0;
    let errors = 0;

    for (const affiliate of affiliatesWithoutSchedule) {
      try {
        if (isVerbose) {
          console.log(`Processing affiliate: ${affiliate.affiliateId} (${affiliate.firstName} ${affiliate.lastName})`);
        }

        if (!isDryRun) {
          affiliate.availabilitySchedule = defaultSchedule;
          await affiliate.save();
        }

        updated++;

        if (isVerbose) {
          console.log(`  ✓ Updated successfully`);
        }
      } catch (err) {
        errors++;
        console.error(`  ✗ Error updating ${affiliate.affiliateId}: ${err.message}`);
      }
    }

    console.log('\n====================================');
    console.log('Migration Summary');
    console.log('====================================');
    console.log(`Total affiliates found: ${affiliatesWithoutSchedule.length}`);
    console.log(`Successfully ${isDryRun ? 'would update' : 'updated'}: ${updated}`);
    console.log(`Errors: ${errors}`);

    if (isDryRun) {
      console.log('\n** This was a dry run. Run without --dry-run to apply changes. **');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run migration
migrate().then(() => {
  console.log('\nMigration complete.');
  process.exit(0);
}).catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

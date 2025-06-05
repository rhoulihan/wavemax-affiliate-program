/**
 * Migration script to update existing affiliates from legacy deliveryFee to new fee structure
 * This migrates all affiliates to have minimumDeliveryFee and perBagDeliveryFee
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Affiliate = require('../server/models/Affiliate');

async function migrateAffiliateFees() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all affiliates
    const affiliates = await Affiliate.find({});
    console.log(`Found ${affiliates.length} affiliates to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const affiliate of affiliates) {
      // Check if already migrated
      if (affiliate.minimumDeliveryFee !== null && affiliate.minimumDeliveryFee !== undefined &&
          affiliate.perBagDeliveryFee !== null && affiliate.perBagDeliveryFee !== undefined) {
        console.log(`✓ ${affiliate.affiliateId} already has new fee structure`);
        skipped++;
        continue;
      }

      // Migrate based on legacy deliveryFee or use defaults
      const legacyFee = affiliate.deliveryFee || 25;
      
      // Set minimum fee to legacy fee or default
      affiliate.minimumDeliveryFee = legacyFee;
      
      // Set per-bag fee to a reasonable default based on minimum
      // If legacy fee was low (< $10), use $2/bag
      // If legacy fee was medium ($10-20), use $3/bag
      // If legacy fee was high (> $20), use $5/bag
      if (legacyFee < 10) {
        affiliate.perBagDeliveryFee = 2;
      } else if (legacyFee <= 20) {
        affiliate.perBagDeliveryFee = 3;
      } else {
        affiliate.perBagDeliveryFee = 5;
      }

      // Remove the legacy field
      affiliate.deliveryFee = undefined;
      
      await affiliate.save();
      console.log(`✅ Migrated ${affiliate.affiliateId}: min=$${affiliate.minimumDeliveryFee}, per-bag=$${affiliate.perBagDeliveryFee}`);
      migrated++;
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total affiliates: ${affiliates.length}`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Already migrated: ${skipped}`);
    
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateAffiliateFees();
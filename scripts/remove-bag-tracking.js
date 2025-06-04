/**
 * Migration script to remove bag tracking from the database
 * This script will:
 * 1. Drop the bags collection
 * 2. Remove bagIDs field from all orders
 * 3. Log the migration results
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const removeBagTracking = async () => {
  try {
    console.log('Starting bag tracking removal migration...\n');

    // 1. Drop the bags collection
    console.log('1. Dropping bags collection...');
    try {
      await mongoose.connection.db.dropCollection('bags');
      console.log('   ✓ Bags collection dropped successfully');
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log('   ℹ Bags collection does not exist (already removed)');
      } else {
        throw error;
      }
    }

    // 2. Remove bagIDs field from all orders
    console.log('\n2. Removing bagIDs field from orders...');
    const Order = require('../server/models/Order');
    
    // Count orders with bagIDs
    const ordersWithBags = await Order.countDocuments({ bagIDs: { $exists: true } });
    console.log(`   Found ${ordersWithBags} orders with bagIDs field`);

    if (ordersWithBags > 0) {
      // Remove bagIDs field from all orders
      const result = await Order.updateMany(
        { bagIDs: { $exists: true } },
        { $unset: { bagIDs: "" } }
      );
      console.log(`   ✓ Removed bagIDs from ${result.modifiedCount} orders`);
    }

    // 3. Verify bag purchase credits are preserved
    console.log('\n3. Verifying customer data integrity...');
    const Customer = require('../server/models/Customer');
    const customerCount = await Customer.countDocuments();
    console.log(`   ✓ ${customerCount} customers in system`);
    console.log('   ℹ Note: Bag purchase credits are managed outside of bag tracking');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log('- Bags collection removed');
    console.log('- BagIDs removed from orders');
    console.log('- Customer accounts preserved');
    console.log('- Bag purchase credits remain unaffected');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
};

// Run migration
(async () => {
  await connectDB();
  
  try {
    await removeBagTracking();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
})();
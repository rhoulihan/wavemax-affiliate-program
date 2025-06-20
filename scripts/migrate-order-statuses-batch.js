// Migration script to update order statuses using bulk operations
const mongoose = require('mongoose');
const Order = require('../server/models/Order');

require('dotenv').config({ path: '../.env' });

// Status mapping from old to new
const statusMapping = {
  'scheduled': 'scheduled',        // Keep as is
  'picked_up': 'processing',       // Order picked up means processing started
  'processing': 'processing',      // Keep as is
  'ready_for_delivery': 'processed', // Ready for delivery means processed
  'delivered': 'complete',         // Delivered means complete
  'cancelled': 'cancelled'         // Keep as is
};

async function migrateOrderStatuses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-affiliate');
    console.log('Connected to MongoDB');

    // Get count of orders to migrate
    const totalOrders = await Order.countDocuments({});
    console.log(`Found ${totalOrders} total orders`);

    // Count orders by status
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\nCurrent status distribution:');
    statusCounts.forEach(s => console.log(`  ${s._id}: ${s.count}`));

    // Perform bulk updates for each status transition
    const updates = [];

    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
      if (oldStatus !== newStatus) {
        const result = await Order.updateMany(
          { status: oldStatus },
          {
            $set: {
              status: newStatus,
              ...(newStatus === 'processing' ? { processingStartedAt: new Date() } : {}),
              ...(newStatus === 'processed' ? { processedAt: new Date() } : {}),
              ...(newStatus === 'complete' ? { completedAt: new Date() } : {})
            }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`\nUpdated ${result.modifiedCount} orders from '${oldStatus}' to '${newStatus}'`);
          updates.push({ from: oldStatus, to: newStatus, count: result.modifiedCount });
        }
      }
    }

    // Check final status distribution
    const finalStatusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\nFinal status distribution:');
    finalStatusCounts.forEach(s => console.log(`  ${s._id}: ${s.count}`));

    console.log('\nMigration complete!');
    if (updates.length > 0) {
      console.log('Summary of changes:');
      updates.forEach(u => console.log(`  ${u.from} → ${u.to}: ${u.count} orders`));
    } else {
      console.log('No orders needed to be updated.');
    }

  } catch (error) {
    console.error('Error during migration:', error.message);
    if (error.code === 79) {
      console.log('\nNote: The migration may have partially succeeded despite the write concern error.');
      console.log('You may need to run the migration again or check the database directly.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateOrderStatuses();
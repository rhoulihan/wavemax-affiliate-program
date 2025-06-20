// Migration script to update order statuses to new schema
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

    // Get all orders
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const order of orders) {
      const oldStatus = order.status;
      const newStatus = statusMapping[oldStatus];

      if (newStatus && newStatus !== oldStatus) {
        order.status = newStatus;

        // Update timestamps based on new status
        if (newStatus === 'processing' && order.pickedUpAt && !order.processingStartedAt) {
          order.processingStartedAt = order.pickedUpAt;
        }
        if (newStatus === 'processed' && order.readyForDeliveryAt && !order.processedAt) {
          order.processedAt = order.readyForDeliveryAt;
        }
        if (newStatus === 'complete' && order.deliveredAt && !order.completedAt) {
          order.completedAt = order.deliveredAt;
        }

        await order.save();
        updated++;
        console.log(`Updated order ${order.orderId}: ${oldStatus} -> ${newStatus}`);
      } else {
        skipped++;
      }
    }

    console.log('\nMigration complete!');
    console.log(`Updated: ${updated} orders`);
    console.log(`Skipped: ${skipped} orders`);

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrateOrderStatuses();
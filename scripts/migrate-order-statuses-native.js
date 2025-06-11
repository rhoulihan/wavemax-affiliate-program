// Migration script using native MongoDB driver
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

// Status mapping from old to new
const statusMapping = {
  'picked_up': 'processing',
  'ready_for_delivery': 'processed',
  'delivered': 'complete'
};

async function migrateOrderStatuses() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-affiliate');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const orders = db.collection('orders');
    
    // Get current status counts
    const statusCounts = await orders.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\nCurrent status distribution:');
    statusCounts.forEach(s => console.log(`  ${s._id}: ${s.count}`));
    
    // Perform updates without write concern
    console.log('\nPerforming migrations...');
    
    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
      try {
        const result = await orders.updateMany(
          { status: oldStatus },
          { 
            $set: { 
              status: newStatus,
              [`${newStatus}At`]: new Date()
            }
          },
          { writeConcern: { w: 1 } } // Use simple write concern
        );
        
        console.log(`Updated ${result.modifiedCount} orders from '${oldStatus}' to '${newStatus}'`);
      } catch (error) {
        console.log(`Error updating ${oldStatus}: ${error.message}`);
      }
    }
    
    // Check final status distribution
    const finalStatusCounts = await orders.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\nFinal status distribution:');
    finalStatusCounts.forEach(s => console.log(`  ${s._id}: ${s.count}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

migrateOrderStatuses();
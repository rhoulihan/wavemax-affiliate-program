// Script to remove workStation field from all operators using native MongoDB
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: '../.env' });

async function removeWorkStationField() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-affiliate');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('operators');

    // Remove workStation field from all operators
    const result = await collection.updateMany(
      {},
      { $unset: { workStation: "" } }
    );

    console.log(`Updated ${result.modifiedCount} operators out of ${result.matchedCount} matched`);

    // Verify the update
    const sampleOperator = await collection.findOne({});
    if (sampleOperator) {
      console.log('\nSample operator fields:', Object.keys(sampleOperator));
      console.log('Has workStation?', 'workStation' in sampleOperator);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

removeWorkStationField();
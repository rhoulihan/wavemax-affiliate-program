// Script to remove workStation field from all operators
const mongoose = require('mongoose');
const Operator = require('../server/models/Operator');

require('dotenv').config({ path: '../.env' });

async function removeWorkStationField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-affiliate');
    console.log('Connected to MongoDB');

    // Remove workStation field from all operators
    const result = await Operator.updateMany(
      {},
      { $unset: { workStation: 1 } },
      { strict: false } // Allow updating fields not in schema
    );

    console.log('Update result:', result);
    console.log(`Updated ${result.modifiedCount} operators out of ${result.matchedCount} matched`);

    // Verify the update
    const sampleOperator = await Operator.findOne({});
    if (sampleOperator) {
      console.log('\nSample operator fields:', Object.keys(sampleOperator.toObject()));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

removeWorkStationField();
const mongoose = require('mongoose');
require('dotenv').config();

const Administrator = require('../server/models/Administrator');
const Operator = require('../server/models/Operator');

async function deleteAdminAndOperators() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate');
    console.log('Connected to MongoDB');

    const adminResult = await Administrator.deleteMany({});
    console.log(`Deleted ${adminResult.deletedCount} administrators`);

    const operatorResult = await Operator.deleteMany({});
    console.log(`Deleted ${operatorResult.deletedCount} operators`);

    console.log('Successfully deleted all administrators and operators');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteAdminAndOperators();
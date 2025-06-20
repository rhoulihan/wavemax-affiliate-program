#!/usr/bin/env node

/**
 * Test script for operator creation
 * Tests the operator creation endpoint directly
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Administrator = require('../server/models/Administrator');
const Operator = require('../server/models/Operator');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test operator creation
const testOperatorCreation = async () => {
  try {
    // Find an administrator to use as creator
    const admin = await Administrator.findOne({ isActive: true });
    if (!admin) {
      console.error('No active administrator found. Please create an administrator first.');
      return;
    }

    console.log(`Using administrator: ${admin.firstName} ${admin.lastName} (${admin.email})`);

    // Check if test operator already exists
    const existingOperator = await Operator.findOne({ email: 'test.operator@example.com' });
    if (existingOperator) {
      console.log('Test operator already exists, deleting...');
      await Operator.deleteOne({ email: 'test.operator@example.com' });
    }

    // Create test operator
    const operator = new Operator({
      firstName: 'Test',
      lastName: 'Operator',
      email: 'test.operator@example.com',
      password: 'R8der50!2025',
      workStation: 'Station 1',
      shiftStart: '08:00',
      shiftEnd: '17:00',
      createdBy: admin._id
    });

    await operator.save();

    console.log('\n=== Operator Created Successfully ===');
    console.log(`Operator ID: ${operator.operatorId}`);
    console.log(`Name: ${operator.firstName} ${operator.lastName}`);
    console.log(`Email: ${operator.email}`);
    console.log(`Work Station: ${operator.workStation}`);
    console.log(`Shift: ${operator.shiftStart} - ${operator.shiftEnd}`);
    console.log(`Is On Shift: ${operator.isOnShift}`);
    console.log('\nLogin credentials:');
    console.log('Email: test.operator@example.com');
    console.log('Password: R8der50!2025');

    // Test the virtuals are included in JSON
    const jsonOutput = operator.toJSON();
    console.log('\nVirtuals in JSON output:');
    console.log('- isOnShift:', jsonOutput.isOnShift);
    console.log('- isLocked:', jsonOutput.isLocked);

  } catch (error) {
    console.error('Error creating operator:', error.message);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await testOperatorCreation();

    console.log('\nDisconnecting from database...');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
main();
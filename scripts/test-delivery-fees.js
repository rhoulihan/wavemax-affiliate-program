#!/usr/bin/env node

// Test script for delivery fee calculations
require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');

async function calculateDeliveryFee(numberOfBags, minimumFee = 10, perBagFee = 2) {
  const calculatedFee = numberOfBags * perBagFee;
  const oneWayFee = Math.max(minimumFee, calculatedFee);
  const roundTripFee = oneWayFee * 2;
  
  return {
    numberOfBags,
    minimumFee,
    perBagFee,
    calculatedFee,
    oneWayFee,
    roundTripFee,
    minimumApplied: oneWayFee === minimumFee
  };
}

async function testFeeCalculations() {
  console.log('Testing Delivery Fee Calculations\n');
  console.log('System defaults: $10 minimum, $2 per bag\n');
  
  const testCases = [1, 3, 6, 10];
  
  for (const bags of testCases) {
    const result = await calculateDeliveryFee(bags);
    console.log(`${bags} bag(s):`);
    console.log(`  - Calculated: ${bags} × $${result.perBagFee} = $${result.calculatedFee}`);
    console.log(`  - One-way fee: $${result.oneWayFee} ${result.minimumApplied ? '(minimum applied)' : '(per-bag calculation)'}`);
    console.log(`  - Round trip: $${result.roundTripFee} (pickup + delivery)\n`);
  }
  
  // Test with custom affiliate rates
  console.log('\nTesting with custom affiliate rates: $25 minimum, $5 per bag\n');
  
  for (const bags of testCases) {
    const result = await calculateDeliveryFee(bags, 25, 5);
    console.log(`${bags} bag(s):`);
    console.log(`  - Calculated: ${bags} × $${result.perBagFee} = $${result.calculatedFee}`);
    console.log(`  - One-way fee: $${result.oneWayFee} ${result.minimumApplied ? '(minimum applied)' : '(per-bag calculation)'}`);
    console.log(`  - Round trip: $${result.roundTripFee} (pickup + delivery)\n`);
  }
}

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Check actual system config values
    const minimumFee = await SystemConfig.getValue('delivery_minimum_fee', 10);
    const perBagFee = await SystemConfig.getValue('delivery_per_bag_fee', 2);
    console.log(`\nActual system config values:`);
    console.log(`  - Minimum fee: $${minimumFee}`);
    console.log(`  - Per-bag fee: $${perBagFee}\n`);
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function main() {
  await connectToDatabase();
  await testFeeCalculations();
  await mongoose.disconnect();
  console.log('\nTest completed!');
}

main().catch(console.error);
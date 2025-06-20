#!/usr/bin/env node

/**
 * Complete the migration by creating demo operator
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Operator = require('../server/models/Operator');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Create demo operator
    console.log('\n=== Creating Demo Operator ===');

    // First get the admin to use as createdBy
    const Administrator = require('../server/models/Administrator');
    const admin = await Administrator.findOne({ adminId: 'ADM001' });

    const demoOperator = new Operator({
      operatorId: 'OPR001',
      firstName: 'Demo',
      lastName: 'Operator',
      email: 'demo.operator@wavemax.com',
      password: 'Demo1234!', // This will be hashed by the model
      shiftStart: '08:00',
      shiftEnd: '16:00',
      isActive: true,
      createdBy: admin._id
    });

    await demoOperator.save();
    console.log('✓ Demo operator created');
    console.log(`  Operator ID: ${demoOperator.operatorId}`);
    console.log(`  Email: ${demoOperator.email}`);
    console.log('  Password: Demo1234!');
    console.log(`  Shift: ${demoOperator.shiftStart} - ${demoOperator.shiftEnd}`);

    console.log('\n✓ Migration completed successfully!');
    console.log('\nYou can now access:');
    console.log('1. Administrator Portal: https://wavemax.promo/administrator-login-embed.html');
    console.log('   - Email: rickh@wavemaxlaundry.com');
    console.log('   - Password: R8der50!');
    console.log('\n2. Operator Portal: https://wavemax.promo/operator-login-embed.html');
    console.log('   - Email: demo.operator@wavemax.com');
    console.log('   - Password: Demo1234!');

  } catch (error) {
    if (error.code === 11000) {
      console.log('✓ Demo operator already exists');
      console.log('\nYou can now access:');
      console.log('1. Administrator Portal: https://wavemax.promo/administrator-login-embed.html');
      console.log('   - Email: rickh@wavemaxlaundry.com');
      console.log('\n2. Operator Portal: https://wavemax.promo/operator-login-embed.html');
      console.log('   - Email: demo.operator@wavemax.com');
      console.log('   - Password: Demo1234!');
    } else {
      console.error('✗ Error:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
#!/usr/bin/env node

/**
 * Complete the migration by creating demo operator with correct model
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Operator = require('../server/models/Operator');
const Administrator = require('../server/models/Administrator');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Create demo operator
    console.log('\n=== Creating Demo Operator ===');
    
    // First get the admin to use as createdBy
    const admin = await Administrator.findOne({ adminId: 'ADM001' });
    
    if (!admin) {
      console.error('✗ Administrator not found. Please run the initial migration first.');
      process.exit(1);
    }
    
    const demoOperator = new Operator({
      operatorId: 'OPR001',
      firstName: 'Demo',
      lastName: 'Operator',
      email: 'demo.operator@wavemax.com',
      password: 'Demo1234!', // This will be hashed by the model
      shiftStart: '08:00',
      shiftEnd: '16:00',
      workStation: null, // Not assigned initially
      isActive: true,
      createdBy: admin._id
    });

    await demoOperator.save();
    console.log('✓ Demo operator created successfully!');
    console.log(`  Operator ID: ${demoOperator.operatorId}`);
    console.log(`  Email: ${demoOperator.email}`);
    console.log(`  Password: Demo1234!`);
    console.log(`  Shift: ${demoOperator.shiftStart} - ${demoOperator.shiftEnd}`);

    console.log('\n✓ Migration completed successfully!');
    console.log('\n=== Access Information ===');
    console.log('\n1. Administrator Portal:');
    console.log('   URL: https://wavemax.promo/administrator-login-embed.html');
    console.log('   Email: rickh@wavemaxlaundry.com');
    console.log('   Password: R8der50!');
    console.log('\n2. Operator Portal:');
    console.log('   URL: https://wavemax.promo/operator-login-embed.html');
    console.log('   Email: demo.operator@wavemax.com');
    console.log('   Password: Demo1234!');
    console.log('\n3. Embedded Application:');
    console.log('   URL: https://wavemax.promo/embed-app.html');
    console.log('\n=== Important Notes ===');
    console.log('- Operators can only login during their shift hours (8:00 AM - 4:00 PM for demo)');
    console.log('- Administrators can create additional operators through the admin portal');
    console.log('- System configuration can be managed from the admin portal');
    
  } catch (error) {
    if (error.code === 11000) {
      console.log('✓ Demo operator already exists');
      console.log('\n=== Access Information ===');
      console.log('\n1. Administrator Portal:');
      console.log('   URL: https://wavemax.promo/administrator-login-embed.html');
      console.log('   Email: rickh@wavemaxlaundry.com');
      console.log('\n2. Operator Portal:');
      console.log('   URL: https://wavemax.promo/operator-login-embed.html');
      console.log('   Email: demo.operator@wavemax.com');
      console.log('   Password: Demo1234!');
    } else {
      console.error('✗ Error:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
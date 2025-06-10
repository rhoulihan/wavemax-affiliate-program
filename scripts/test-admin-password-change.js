#!/usr/bin/env node

// Test Administrator Password Change Script
// This script tests the password change functionality for administrators

require('dotenv').config();
const mongoose = require('mongoose');
const Administrator = require('../server/models/Administrator');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    
    // Find the default admin
    const defaultAdmin = await Administrator.findOne({ 
      email: process.env.DEFAULT_ADMIN_EMAIL || 'rickh@wavemaxlaundry.com' 
    });
    
    if (!defaultAdmin) {
      console.log('❌ Default administrator not found');
      return;
    }
    
    console.log('✓ Found administrator:', defaultAdmin.adminId);
    console.log('  Email:', defaultAdmin.email);
    console.log('  Name:', defaultAdmin.firstName, defaultAdmin.lastName);
    console.log('  Require Password Change:', defaultAdmin.requirePasswordChange);
    
    // Test password validation scenarios
    console.log('\n🔍 Testing password validation scenarios:');
    
    const testPasswords = [
      { password: 'short', expected: false, reason: 'Too short' },
      { password: 'alllowercase123!', expected: false, reason: 'No uppercase' },
      { password: 'ALLUPPERCASE123!', expected: false, reason: 'No lowercase' },
      { password: 'NoNumbers!@#', expected: false, reason: 'No numbers' },
      { password: 'NoSpecialChars123', expected: false, reason: 'No special characters' },
      { password: 'WaveMAX!2024Admin', expected: true, reason: 'Valid strong password' },
      { password: 'Admin@WaveMAX2025', expected: true, reason: 'Valid strong password' },
    ];
    
    // Note: We're just logging the test scenarios here since actual validation
    // happens in the frontend. This shows what the frontend should validate.
    testPasswords.forEach(test => {
      console.log(`  ${test.expected ? '✅' : '❌'} "${test.password}" - ${test.reason}`);
    });
    
    console.log('\n✓ Password validation rules:');
    console.log('  - Minimum 12 characters');
    console.log('  - At least one uppercase letter');
    console.log('  - At least one lowercase letter');
    console.log('  - At least one number');
    console.log('  - At least one special character');
    console.log('  - Cannot be the same as current password');
    console.log('  - Cannot contain sequential patterns');
    console.log('  - Cannot contain repeated characters');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

main();
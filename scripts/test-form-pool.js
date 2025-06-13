#!/usr/bin/env node

// Test script for Paygistix form pool
require('dotenv').config();
const mongoose = require('mongoose');
const formPoolManager = require('../server/services/formPoolManager');

async function testFormPool() {
  try {
    console.log('Testing Paygistix Form Pool...\n');
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      tls: true,
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
    });
    console.log('✓ Connected to MongoDB\n');
    
    // Initialize form pool
    console.log('Initializing form pool...');
    await formPoolManager.initializePool();
    console.log('✓ Form pool initialized\n');
    
    // Get pool stats
    console.log('Getting pool statistics...');
    const stats = await formPoolManager.getPoolStats();
    console.log('Pool Stats:');
    console.log(`  Total forms: ${stats.total}`);
    console.log(`  Available: ${stats.available}`);
    console.log(`  Locked: ${stats.locked}`);
    console.log('\nForm Details:');
    stats.forms.forEach(form => {
      console.log(`  ${form.formId}: ${form.isLocked ? 'LOCKED' : 'Available'}`);
    });
    console.log('');
    
    // Test acquiring forms
    console.log('Testing form acquisition...');
    const tokens = [];
    
    // Acquire 3 forms
    for (let i = 1; i <= 3; i++) {
      const token = `test-token-${i}`;
      const form = await formPoolManager.acquireForm(token);
      if (form) {
        tokens.push({ token, formId: form.formId });
        console.log(`✓ Acquired form ${form.formId} for token ${token}`);
      } else {
        console.log(`✗ Failed to acquire form for token ${token}`);
      }
    }
    console.log('');
    
    // Get stats after acquisition
    const statsAfter = await formPoolManager.getPoolStats();
    console.log('Pool Stats After Acquisition:');
    console.log(`  Available: ${statsAfter.available}`);
    console.log(`  Locked: ${statsAfter.locked}\n`);
    
    // Test releasing forms
    console.log('Testing form release...');
    for (const { token, formId } of tokens) {
      const released = await formPoolManager.releaseFormByToken(token);
      console.log(`${released ? '✓' : '✗'} Released form ${formId}`);
    }
    console.log('');
    
    // Final stats
    const statsFinal = await formPoolManager.getPoolStats();
    console.log('Final Pool Stats:');
    console.log(`  Available: ${statsFinal.available}`);
    console.log(`  Locked: ${statsFinal.locked}\n`);
    
    console.log('✅ Form pool test completed successfully!');
    
  } catch (error) {
    console.error('❌ Form pool test failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run the test
testFormPool();
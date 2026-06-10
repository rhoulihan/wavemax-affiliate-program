#!/usr/bin/env node

/**
 * Script to update payment check interval
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('../../server/models/SystemConfig');

async function updatePaymentInterval() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Update the IMAP payment-detection scan interval to 60 seconds (the
    // canonical key seeded by initializeDefaults; min 60000 per spec §8)
    const intervalMs = 60000; // 1 minute

    await SystemConfig.setValue('payment_scan_interval_ms', intervalMs);
    console.log(`Payment scan interval updated to ${intervalMs}ms (${intervalMs / 1000} seconds)`);

    // Also ensure V2 payment system is enabled
    await SystemConfig.setValue('payment_version', 'v2');
    console.log('V2 payment system enabled');

    // Show current settings
    const currentInterval = await SystemConfig.getValue('payment_scan_interval_ms');
    const paymentVersion = await SystemConfig.getValue('payment_version');
    
    console.log('\nCurrent settings:');
    console.log(`- Payment check interval: ${currentInterval}ms (${currentInterval / 60000} minutes)`);
    console.log(`- Payment version: ${paymentVersion}`);

    await mongoose.disconnect();
    console.log('\nConfiguration updated successfully!');
    console.log('Please restart the server for changes to take effect.');
    
  } catch (error) {
    console.error('Error updating payment interval:', error);
    process.exit(1);
  }
}

updatePaymentInterval();
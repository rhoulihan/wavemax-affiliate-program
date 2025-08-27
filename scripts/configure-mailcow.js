#!/usr/bin/env node

/**
 * Script to configure Mailcow API settings
 * Run this after creating the payments@wavemax.promo mailbox
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
const { encrypt } = require('../server/utils/encryption');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function configureMailcow() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    console.log('\n=== Mailcow API Configuration ===\n');
    
    // Get configuration values from user
    const apiUrl = await question('Enter Mailcow API URL (default: https://mail.wavemax.promo/api/v1): ');
    const apiKey = await question('Enter Mailcow API Key: ');
    const paymentEmail = await question('Enter payment notification email (default: payments@wavemax.promo): ');
    
    // Set API URL
    await SystemConfig.findOneAndUpdate(
      { key: 'mailcow_api_url' },
      { 
        value: apiUrl || 'https://mail.wavemax.promo/api/v1',
        defaultValue: 'https://mail.wavemax.promo/api/v1',
        description: 'Mailcow API endpoint URL'
      },
      { upsert: true }
    );
    console.log('✓ API URL configured');
    
    // Encrypt and store API key
    if (apiKey) {
      const encryptedKey = encrypt(apiKey);
      await SystemConfig.findOneAndUpdate(
        { key: 'mailcow_api_key' },
        { 
          value: encryptedKey,
          description: 'Encrypted Mailcow API key for email access',
          dataType: 'string' // Changed from 'encrypted' to 'string'
        },
        { upsert: true }
      );
      console.log('✓ API key encrypted and stored');
    }
    
    // Set payment email address
    await SystemConfig.findOneAndUpdate(
      { key: 'payment_notification_email' },
      { 
        value: paymentEmail || 'payments@wavemax.promo',
        defaultValue: 'payments@wavemax.promo',
        description: 'Email address where payment notifications are sent'
      },
      { upsert: true }
    );
    console.log('✓ Payment email configured');
    
    // Test the connection
    console.log('\n=== Testing Mailcow Connection ===\n');
    
    const mailcowService = require('../server/services/mailcowService');
    await mailcowService.initialize();
    
    console.log('Attempting to fetch emails...');
    const emails = await mailcowService.getUnreadPaymentEmails(1);
    
    if (emails === null || emails === undefined) {
      console.log('⚠ Could not verify connection - please check API key and URL');
    } else {
      console.log(`✓ Connection successful! Found ${emails.length} unread emails`);
    }
    
    console.log('\n=== Configuration Complete ===\n');
    console.log('Next steps:');
    console.log('1. Make sure payments@wavemax.promo mailbox exists in Mailcow');
    console.log('2. Configure payment providers to send notifications to payments@wavemax.promo');
    console.log('3. The payment verification job will automatically scan emails every 5 minutes');
    console.log('4. Test by sending a test payment and checking the logs');
    
  } catch (error) {
    console.error('Error configuring Mailcow:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run the configuration
configureMailcow();
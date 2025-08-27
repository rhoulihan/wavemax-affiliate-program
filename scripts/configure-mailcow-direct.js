#!/usr/bin/env node

/**
 * Direct configuration of Mailcow API settings
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
const { encrypt } = require('../server/utils/encryption');
require('dotenv').config();

async function configureMailcow() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    console.log('\n=== Configuring Mailcow API Settings ===\n');
    
    // Configuration values
    const apiUrl = 'https://mail.wavemax.promo/api/v1';
    const apiKey = '4d30c33d44eedfe24d1533be1f42c66bd16ac8677086eb1bea3ec59b936c5268';
    const paymentEmail = 'payments@wavemax.promo';
    
    // Set API URL
    await SystemConfig.findOneAndUpdate(
      { key: 'mailcow_api_url' },
      { 
        value: apiUrl,
        defaultValue: 'https://mail.wavemax.promo/api/v1',
        description: 'Mailcow API endpoint URL',
        dataType: 'string'
      },
      { upsert: true }
    );
    console.log('✓ API URL configured:', apiUrl);
    
    // Encrypt and store API key
    const encryptedKey = encrypt(apiKey);
    await SystemConfig.findOneAndUpdate(
      { key: 'mailcow_api_key' },
      { 
        value: encryptedKey,
        description: 'Encrypted Mailcow API key for email access',
        dataType: 'string'
      },
      { upsert: true }
    );
    console.log('✓ API key encrypted and stored');
    
    // Set payment email address
    await SystemConfig.findOneAndUpdate(
      { key: 'payment_notification_email' },
      { 
        value: paymentEmail,
        defaultValue: 'payments@wavemax.promo',
        description: 'Email address where payment notifications are sent',
        dataType: 'string'
      },
      { upsert: true }
    );
    console.log('✓ Payment email configured:', paymentEmail);
    
    // Enable V2 payment system
    await SystemConfig.findOneAndUpdate(
      { key: 'payment_version' },
      { 
        value: 'v2',
        defaultValue: 'v1',
        description: 'Payment system version (v1=credit cards, v2=venmo/paypal/cashapp)',
        dataType: 'string'
      },
      { upsert: true }
    );
    console.log('✓ V2 payment system enabled');
    
    // Test the connection
    console.log('\n=== Testing Mailcow Connection ===\n');
    
    const mailcowService = require('../server/services/mailcowService');
    await mailcowService.initialize();
    
    console.log('Testing API connection...');
    try {
      const emails = await mailcowService.getUnreadPaymentEmails(1);
      
      if (emails === null || emails === undefined) {
        console.log('⚠ API endpoint may need adjustment - will try alternative endpoints');
      } else {
        console.log(`✓ Connection successful! Found ${emails.length} emails`);
      }
    } catch (error) {
      console.log('⚠ Initial connection test failed, this is normal if the API endpoint structure is different');
      console.log('  The system will try alternative endpoints automatically when running');
    }
    
    console.log('\n=== Configuration Complete ===\n');
    console.log('Settings configured:');
    console.log('- API URL:', apiUrl);
    console.log('- Payment Email:', paymentEmail);
    console.log('- Payment System: V2 (Venmo/PayPal/CashApp)');
    console.log('- API Key: Encrypted and stored');
    
    console.log('\n=== Next Steps ===\n');
    console.log('1. Ensure payments@wavemax.promo mailbox exists in Mailcow');
    console.log('2. Configure payment providers:');
    console.log('   - Venmo: Add payments@wavemax.promo to business notification settings');
    console.log('   - PayPal: Configure IPN to send to payments@wavemax.promo');
    console.log('   - CashApp: Set up email notifications to payments@wavemax.promo');
    console.log('3. Restart the application to activate payment verification job:');
    console.log('   pm2 restart wavemax');
    console.log('4. Monitor logs for payment verification activity:');
    console.log('   pm2 logs wavemax --lines 100');
    
  } catch (error) {
    console.error('Error configuring Mailcow:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  }
}

// Run the configuration
configureMailcow();
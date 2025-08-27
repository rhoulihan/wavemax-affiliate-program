#!/usr/bin/env node

/**
 * Script to add V2 payment system configuration to SystemConfig
 * Run: node scripts/add-v2-payment-config.js
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
require('dotenv').config();

const v2PaymentConfigs = [
  {
    key: 'payment_version',
    value: 'v1', // Start with v1, switch to v2 when ready
    defaultValue: 'v1',
    dataType: 'string',
    category: 'payment',
    description: 'Payment system version toggle (v1: Paygistix, v2: Venmo/PayPal/CashApp)',
    displayOrder: 1001,
    isPublic: true
  },
  {
    key: 'payment_notification_email',
    value: 'payments@wavemax.promo',
    defaultValue: 'payments@wavemax.promo',
    dataType: 'string',
    category: 'payment',
    description: 'Email address for receiving payment notifications',
    displayOrder: 1002
  },
  {
    key: 'venmo_handle',
    value: '@wavemax',
    defaultValue: '@wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'Venmo business handle (without @ symbol)',
    displayOrder: 1003
  },
  {
    key: 'paypal_handle',
    value: 'wavemax',
    defaultValue: 'wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'PayPal.me handle',
    displayOrder: 1004
  },
  {
    key: 'cashapp_handle',
    value: '$wavemax',
    defaultValue: '$wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'CashApp cashtag (with $ symbol)',
    displayOrder: 1005
  },
  {
    key: 'free_initial_bags',
    value: 2,
    defaultValue: 2,
    dataType: 'number',
    category: 'customer',
    description: 'Number of free bags for V2 customer registration',
    displayOrder: 1006
  },
  {
    key: 'payment_check_interval',
    value: 300000, // 5 minutes in milliseconds
    defaultValue: 300000,
    dataType: 'number',
    category: 'payment',
    description: 'Interval for checking payment status in milliseconds (default: 5 minutes)',
    displayOrder: 1007
  },
  {
    key: 'payment_check_max_attempts',
    value: 48, // 4 hours with 5-minute intervals
    defaultValue: 48,
    dataType: 'number',
    category: 'payment',
    description: 'Maximum payment verification attempts before escalation',
    displayOrder: 1008
  },
  {
    key: 'mailcow_api_url',
    value: 'https://mail.wavemax.promo/api/v1',
    defaultValue: 'https://mail.wavemax.promo/api/v1',
    dataType: 'string',
    category: 'system',
    description: 'Mailcow API endpoint URL',
    displayOrder: 1009
  },
  {
    key: 'mailcow_api_key',
    value: '', // Will need to be set and encrypted manually
    defaultValue: '',
    dataType: 'string',
    category: 'system',
    description: 'Mailcow API key (should be encrypted) - set via admin interface',
    displayOrder: 1010,
    isEditable: false // Prevent accidental exposure
  }
];

async function addV2PaymentConfig() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    console.log('Adding V2 payment system configuration...\n');

    for (const config of v2PaymentConfigs) {
      try {
        // Check if config already exists
        const existing = await SystemConfig.findOne({ key: config.key });
        
        if (existing) {
          console.log(`✓ Config '${config.key}' already exists (current value: ${existing.value})`);
        } else {
          // Create new config
          await SystemConfig.create(config);
          console.log(`✓ Added config '${config.key}' with value: ${config.value}`);
        }
      } catch (error) {
        console.error(`✗ Error adding config '${config.key}':`, error.message);
      }
    }

    console.log('\n✅ V2 payment configuration complete!');
    console.log('\n⚠️  Important: Set the mailcow_api_key via admin interface');
    console.log('⚠️  Important: Update payment handles (venmo, paypal, cashapp) with actual business accounts');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
addV2PaymentConfig();
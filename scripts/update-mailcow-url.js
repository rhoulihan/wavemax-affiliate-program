#!/usr/bin/env node

/**
 * Update Mailcow API URL to use the correct mail subdomain
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
require('dotenv').config();

async function updateMailcowUrl() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    console.log('\n=== Updating Mailcow API URL ===\n');
    
    // Update API URL to use mail subdomain
    const newApiUrl = 'https://mail.wavemax.promo/api/v1';
    
    await SystemConfig.findOneAndUpdate(
      { key: 'mailcow_api_url' },
      { 
        value: newApiUrl,
        defaultValue: 'https://mail.wavemax.promo/api/v1',
        description: 'Mailcow API endpoint URL',
        dataType: 'string'
      },
      { upsert: true }
    );
    
    console.log('✓ API URL updated to:', newApiUrl);
    console.log('\nThis ensures API requests go to the Mailcow server at mail.wavemax.promo');
    console.log('instead of being handled by the Node.js app at wavemax.promo');
    
  } catch (error) {
    console.error('Error updating Mailcow URL:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    console.log('\nPlease restart the application:');
    console.log('  pm2 restart wavemax');
    process.exit(0);
  }
}

// Run the update
updateMailcowUrl();
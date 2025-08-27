#!/usr/bin/env node

/**
 * Configure IMAP settings for payment email scanning
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
const { encrypt } = require('../server/utils/encryption');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const questionPassword = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      // Clear the line after password input
      process.stdout.write('\n');
      resolve(answer);
    });
  });
};

async function configureIMAP() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    console.log('\n=== IMAP Configuration for Payment Email Scanning ===\n');
    
    // Configure IMAP settings
    await SystemConfig.findOneAndUpdate(
      { key: 'imap_host' },
      { 
        value: 'localhost',
        defaultValue: 'localhost',
        description: 'IMAP server hostname',
        dataType: 'string'
      },
      { upsert: true }
    );
    
    await SystemConfig.findOneAndUpdate(
      { key: 'imap_port' },
      { 
        value: '143',
        defaultValue: '143',
        description: 'IMAP server port (143 for TLS/STARTTLS)',
        dataType: 'string'
      },
      { upsert: true }
    );
    
    console.log('IMAP host: localhost');
    console.log('IMAP port: 143 (TLS)');
    console.log('Email account: payments@wavemax.promo');
    
    // Get password
    console.log('\nEnter the password for payments@wavemax.promo mailbox:');
    const password = await questionPassword('Password: ');
    
    if (password) {
      // Encrypt and store password
      const encryptedPassword = encrypt(password);
      await SystemConfig.findOneAndUpdate(
        { key: 'payment_email_password' },
        { 
          value: encryptedPassword,
          description: 'Encrypted password for payment notification email account',
          dataType: 'string'
        },
        { upsert: true }
      );
      console.log('✓ Password encrypted and stored');
    } else {
      console.log('⚠ No password provided');
    }
    
    // Test the connection
    console.log('\n=== Testing IMAP Connection ===\n');
    
    const imapScanner = require('../server/services/imapEmailScanner');
    
    try {
      const connected = await imapScanner.connect();
      if (connected) {
        console.log('✓ Successfully connected to IMAP server');
        
        const emails = await imapScanner.getUnreadEmails();
        console.log(`✓ Found ${emails.length} unread emails in inbox`);
        
        if (emails.length > 0) {
          console.log('\nFirst email:');
          console.log(`  From: ${emails[0].from}`);
          console.log(`  Subject: ${emails[0].subject}`);
          console.log(`  Date: ${emails[0].date}`);
        }
        
        imapScanner.disconnect();
      } else {
        console.log('✗ Failed to connect to IMAP server');
      }
    } catch (error) {
      console.log('✗ Connection test failed:', error.message);
    }
    
    console.log('\n=== Configuration Complete ===\n');
    console.log('Next steps:');
    console.log('1. Update paymentEmailScanner.js to use imapEmailScanner instead of mailcowService');
    console.log('2. Restart the application: pm2 restart wavemax');
    console.log('3. Payment verification will check emails every 5 minutes');
    
  } catch (error) {
    console.error('Error configuring IMAP:', error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run configuration
configureIMAP();
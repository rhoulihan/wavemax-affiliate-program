#!/usr/bin/env node

/**
 * Direct IMAP configuration with provided password
 */

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
const { encrypt } = require('../server/utils/encryption');
require('dotenv').config();

async function configureIMAP() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to database');
    console.log('\n=== Configuring IMAP for Payment Email Scanning ===\n');
    
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
    
    // Encrypt and store password
    const password = 'aCaSID,24,-';
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
    
    console.log('✓ IMAP host: localhost');
    console.log('✓ IMAP port: 143');
    console.log('✓ Email: payments@wavemax.promo');
    console.log('✓ Password: Encrypted and stored');
    
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
          console.log('\nSample of unread emails:');
          emails.slice(0, 3).forEach((email, index) => {
            console.log(`\nEmail ${index + 1}:`);
            console.log(`  From: ${email.from}`);
            console.log(`  Subject: ${email.subject}`);
            console.log(`  Date: ${email.date}`);
            if (email.text) {
              console.log(`  Preview: ${email.text.substring(0, 100)}...`);
            }
          });
        }
        
        imapScanner.disconnect();
      } else {
        console.log('✗ Failed to connect to IMAP server');
      }
    } catch (error) {
      console.log('✗ Connection test failed:', error.message);
      console.log('This might be normal if IMAP service needs to be on different port');
    }
    
    console.log('\n=== Configuration Complete ===\n');
    
  } catch (error) {
    console.error('Error configuring IMAP:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  }
}

// Run configuration
configureIMAP();
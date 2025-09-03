#!/usr/bin/env node

/**
 * Script to read and display payment emails for template analysis
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function readPaymentEmail() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get the email scanner
    const imapScanner = require('../server/services/imapEmailScanner');
    
    // Connect to IMAP
    const connected = await imapScanner.connect();
    if (!connected) {
      console.log('Could not connect to IMAP server');
      process.exit(1);
    }
    
    // Get all emails (both read and unread)
    const emails = await imapScanner.getUnreadEmails();
    console.log(`\nFound ${emails.length} unread emails\n`);
    
    for (const email of emails) {
      console.log('='.repeat(80));
      console.log('From:', email.from);
      console.log('From Address:', email.fromAddress);
      console.log('Subject:', email.subject);
      console.log('Date:', email.date);
      console.log('Message ID:', email.messageId);
      console.log('-'.repeat(80));
      console.log('TEXT CONTENT:');
      console.log(email.text);
      console.log('-'.repeat(80));
      if (email.html) {
        console.log('HTML CONTENT (first 2000 chars):');
        console.log(email.html.substring(0, 2000));
      }
      console.log('='.repeat(80));
      console.log('\n');
    }
    
    imapScanner.disconnect();
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

readPaymentEmail();
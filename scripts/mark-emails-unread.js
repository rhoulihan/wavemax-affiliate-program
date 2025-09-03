#!/usr/bin/env node

/**
 * Script to mark all emails in payments inbox as unread for testing
 */

require('dotenv').config();
const Imap = require('imap');
const SystemConfig = require('../server/models/SystemConfig');
const { decrypt } = require('../server/utils/encryption');
const mongoose = require('mongoose');

async function markEmailsAsUnread() {
  try {
    // Connect to MongoDB to get config
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get mailbox credentials from SystemConfig
    const host = await SystemConfig.getValue('imap_host', 'localhost');
    const port = parseInt(await SystemConfig.getValue('imap_port', '993'));
    const user = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
    
    // Get encrypted password
    const encryptedPassword = await SystemConfig.getValue('payment_email_password', '');
    if (!encryptedPassword) {
      console.error('Payment email password not configured');
      process.exit(1);
    }
    
    const password = decrypt(encryptedPassword);
    
    console.log(`Connecting to ${user} at ${host}:${port}...`);
    
    // Create IMAP connection
    const imap = new Imap({
      user: user,
      password: password,
      host: host,
      port: port,
      tls: port === 993,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: host
      },
      authTimeout: 10000,
      connTimeout: 10000
    });
    
    await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        console.log('IMAP connection established');
        
        // Open inbox
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }
          
          console.log(`Inbox opened. Total messages: ${box.messages.total}`);
          
          // Search for ALL messages
          imap.search(['ALL'], (err, results) => {
            if (err) {
              console.error('Error searching emails:', err);
              reject(err);
              return;
            }
            
            if (!results || results.length === 0) {
              console.log('No emails found in inbox');
              resolve();
              return;
            }
            
            console.log(`Found ${results.length} emails. Marking as unread...`);
            
            // Mark all messages as unseen
            imap.delFlags(results, '\\Seen', (err) => {
              if (err) {
                console.error('Error marking emails as unread:', err);
                reject(err);
                return;
              }
              
              console.log(`Successfully marked ${results.length} emails as unread`);
              resolve();
            });
          });
        });
      });
      
      imap.once('error', (err) => {
        console.error('IMAP error:', err);
        reject(err);
      });
      
      imap.connect();
    });
    
    imap.end();
    await mongoose.disconnect();
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

markEmailsAsUnread();
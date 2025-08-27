/**
 * IMAP Email Scanner Service
 * Connects to payments@wavemax.promo mailbox via IMAP to read payment emails
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const SystemConfig = require('../models/SystemConfig');
const { decrypt } = require('../utils/encryption');

class IMAPEmailScanner {
  constructor() {
    this.imap = null;
    this.connected = false;
  }

  /**
   * Initialize IMAP connection
   */
  async connect() {
    try {
      // Get mailbox credentials from SystemConfig
      const host = await SystemConfig.getValue('imap_host', 'localhost');
      const port = parseInt(await SystemConfig.getValue('imap_port', '993'));
      const user = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
      
      // Get encrypted password
      const encryptedPassword = await SystemConfig.getValue('payment_email_password', '');
      if (!encryptedPassword) {
        console.warn('Payment email password not configured');
        return false;
      }
      
      const password = decrypt(encryptedPassword);
      
      // Create IMAP connection with correct settings for Mailcow/Dovecot
      this.imap = new Imap({
        user: user,
        password: password,
        host: host,
        port: port,
        tls: port === 993, // Use TLS for port 993
        tlsOptions: {
          rejectUnauthorized: false, // Accept self-signed certificates
          servername: host // Important for TLS
        },
        authTimeout: 10000,
        connTimeout: 10000
        // debug: console.log // Uncomment for debugging
      });
      
      return new Promise((resolve, reject) => {
        this.imap.once('ready', () => {
          console.log('IMAP connection established');
          this.connected = true;
          resolve(true);
        });
        
        this.imap.once('error', (err) => {
          console.error('IMAP connection error:', err.message);
          reject(err);
        });
        
        this.imap.once('end', () => {
          console.log('IMAP connection ended');
          this.connected = false;
        });
        
        this.imap.connect();
      });
    } catch (error) {
      console.error('Error connecting to IMAP:', error);
      return false;
    }
  }

  /**
   * Fetch unread emails from inbox
   */
  async getUnreadEmails() {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) return [];
    }
    
    return new Promise((resolve, reject) => {
      const emails = [];
      
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          reject(err);
          return;
        }
        
        // Search for unseen messages
        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('Error searching emails:', err);
            reject(err);
            return;
          }
          
          if (!results || results.length === 0) {
            console.log('No unread emails found');
            resolve([]);
            return;
          }
          
          console.log(`Found ${results.length} unread emails`);
          
          // Fetch the emails
          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: false // Don't mark as read yet
          });
          
          fetch.on('message', (msg, seqno) => {
            let emailData = {
              seqno: seqno,
              uid: null,
              headers: {},
              text: '',
              html: ''
            };
            
            msg.on('body', (stream, info) => {
              simpleParser(stream, (err, parsed) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }
                
                emailData.from = parsed.from?.text || '';
                emailData.subject = parsed.subject || '';
                emailData.date = parsed.date || new Date();
                emailData.text = parsed.text || '';
                emailData.html = parsed.html || '';
                emailData.messageId = parsed.messageId || '';
                
                // Extract sender email
                if (parsed.from && parsed.from.value && parsed.from.value[0]) {
                  emailData.fromAddress = parsed.from.value[0].address;
                }
              });
            });
            
            msg.once('attributes', (attrs) => {
              emailData.uid = attrs.uid;
              emailData.flags = attrs.flags;
            });
            
            msg.once('end', () => {
              emails.push(emailData);
            });
          });
          
          fetch.once('error', (err) => {
            console.error('Fetch error:', err);
            reject(err);
          });
          
          fetch.once('end', () => {
            console.log(`Successfully fetched ${emails.length} emails`);
            resolve(emails);
          });
        });
      });
    });
  }

  /**
   * Mark an email as read
   */
  async markAsRead(uid) {
    if (!this.connected) return false;
    
    return new Promise((resolve, reject) => {
      this.imap.addFlags(uid, ['\\Seen'], (err) => {
        if (err) {
          console.error('Error marking email as read:', err);
          resolve(false);
        } else {
          console.log(`Marked email ${uid} as read`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Move email to a folder
   */
  async moveToFolder(uid, folderName) {
    if (!this.connected) return false;
    
    return new Promise((resolve, reject) => {
      // First copy to the target folder
      this.imap.copy(uid, folderName, (err) => {
        if (err) {
          console.error(`Error copying email to ${folderName}:`, err);
          resolve(false);
          return;
        }
        
        // Then mark as deleted in current folder
        this.imap.addFlags(uid, ['\\Deleted'], (err) => {
          if (err) {
            console.error('Error marking email as deleted:', err);
            resolve(false);
          } else {
            // Expunge to actually delete
            this.imap.expunge((err) => {
              if (err) {
                console.error('Error expunging:', err);
              }
              console.log(`Moved email ${uid} to ${folderName}`);
              resolve(true);
            });
          }
        });
      });
    });
  }

  /**
   * Disconnect from IMAP server
   */
  disconnect() {
    if (this.imap && this.connected) {
      this.imap.end();
      this.connected = false;
    }
  }
}

module.exports = new IMAPEmailScanner();
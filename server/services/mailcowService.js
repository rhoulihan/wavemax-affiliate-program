/**
 * Mailcow API Service
 * Integrates with Mailcow email server for payment verification
 */

const axios = require('axios');
const SystemConfig = require('../models/SystemConfig');
const { decrypt } = require('../utils/encryption');

class MailcowService {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
    this.initialized = false;
    this.axios = null;
  }

  /**
   * Initialize the service with API credentials
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Get API configuration from SystemConfig
      // Try direct connection to Mailcow container on port 8443 to bypass nginx proxy issues
      this.apiUrl = await SystemConfig.getValue('mailcow_api_url', 'https://localhost:8443/api/v1');
      
      // Get encrypted API key
      const encryptedKey = await SystemConfig.getValue('mailcow_api_key', '');
      
      if (!encryptedKey) {
        console.warn('Mailcow API key not configured. Email scanning disabled.');
        return;
      }
      
      // Decrypt the API key
      this.apiKey = decrypt(encryptedKey);
      
      // Create axios instance with default headers
      this.axios = axios.create({
        baseURL: this.apiUrl,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000, // 30 seconds
        // Temporarily ignore SSL certificate issues for mail subdomain
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });
      
      this.initialized = true;
      console.log('Mailcow service initialized successfully');
    } catch (error) {
      console.error('Error initializing Mailcow service:', error);
      throw new Error('Failed to initialize Mailcow service');
    }
  }

  /**
   * Get unread emails sent to payment notification address
   * @param {Number} limit - Maximum number of emails to retrieve
   * @returns {Array} Array of email messages
   */
  async getUnreadPaymentEmails(limit = 50) {
    await this.initialize();
    
    if (!this.axios) {
      console.warn('Mailcow service not properly initialized');
      return [];
    }

    try {
      const paymentEmail = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
      
      // Mailcow API endpoint for retrieving messages
      // Note: Actual endpoint may vary based on Mailcow version
      const response = await this.axios.get('/mail/messages', {
        params: {
          to: paymentEmail,
          unread: true,
          limit: limit,
          sort: 'date_desc'
        }
      });
      
      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching unread payment emails:', error.message);
      
      // If API structure is different, try alternative approach
      if (error.response && error.response.status === 404) {
        return this.getUnreadEmailsAlternative(limit);
      }
      
      return [];
    }
  }

  /**
   * Alternative method to get emails using IMAP if API is different
   * @param {Number} limit - Maximum number of emails
   * @returns {Array} Array of email messages
   */
  async getUnreadEmailsAlternative(limit = 50) {
    try {
      // Try alternative API endpoint structure
      const paymentEmail = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
      
      // Some Mailcow versions use different endpoint
      const response = await this.axios.get('/mailbox/messages', {
        params: {
          mailbox: paymentEmail,
          folder: 'INBOX',
          unseen: 1,
          limit: limit
        }
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Alternative email fetch also failed:', error.message);
      return [];
    }
  }

  /**
   * Mark an email as read/processed
   * @param {String} messageId - The message ID to mark as processed
   * @param {String} folder - The folder containing the message
   */
  async markEmailAsProcessed(messageId, folder = 'INBOX') {
    await this.initialize();
    
    if (!this.axios) {
      console.warn('Mailcow service not properly initialized');
      return false;
    }

    try {
      // Mark email as read
      await this.axios.put(`/mail/message/${messageId}`, {
        folder: folder,
        flags: ['\\Seen', 'Processed'],
        action: 'add_flags'
      });
      
      return true;
    } catch (error) {
      console.error('Error marking email as processed:', error.message);
      
      // Try alternative approach
      return this.markEmailAsProcessedAlternative(messageId, folder);
    }
  }

  /**
   * Alternative method to mark email as processed
   */
  async markEmailAsProcessedAlternative(messageId, folder) {
    try {
      await this.axios.post('/mail/action', {
        action: 'mark_read',
        message_id: messageId,
        folder: folder
      });
      
      return true;
    } catch (error) {
      console.error('Alternative mark as processed also failed:', error.message);
      return false;
    }
  }

  /**
   * Search emails by content
   * @param {String} searchTerm - Term to search for (e.g., order ID)
   * @param {String} folder - Folder to search in
   * @returns {Array} Matching emails
   */
  async searchEmails(searchTerm, folder = 'INBOX') {
    await this.initialize();
    
    if (!this.axios) {
      return [];
    }

    try {
      const paymentEmail = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
      
      const response = await this.axios.get('/mail/search', {
        params: {
          mailbox: paymentEmail,
          folder: folder,
          query: searchTerm,
          limit: 10
        }
      });
      
      return response.data.messages || [];
    } catch (error) {
      console.error('Error searching emails:', error.message);
      return [];
    }
  }

  /**
   * Get email by ID
   * @param {String} messageId - The message ID
   * @returns {Object} Email message object
   */
  async getEmailById(messageId) {
    await this.initialize();
    
    if (!this.axios) {
      return null;
    }

    try {
      const response = await this.axios.get(`/mail/message/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching email by ID:', error.message);
      return null;
    }
  }

  /**
   * Move email to a folder
   * @param {String} messageId - The message ID
   * @param {String} targetFolder - Target folder name
   */
  async moveEmail(messageId, targetFolder) {
    await this.initialize();
    
    if (!this.axios) {
      return false;
    }

    try {
      await this.axios.post('/mail/move', {
        message_id: messageId,
        target_folder: targetFolder
      });
      
      return true;
    } catch (error) {
      console.error('Error moving email:', error.message);
      return false;
    }
  }

  /**
   * Create a folder if it doesn't exist
   * @param {String} folderName - Name of the folder to create
   */
  async createFolder(folderName) {
    await this.initialize();
    
    if (!this.axios) {
      return false;
    }

    try {
      const paymentEmail = await SystemConfig.getValue('payment_notification_email', 'payments@wavemax.promo');
      
      await this.axios.post('/mailbox/folder', {
        mailbox: paymentEmail,
        folder_name: folderName
      });
      
      return true;
    } catch (error) {
      if (error.response && error.response.status === 409) {
        // Folder already exists
        return true;
      }
      console.error('Error creating folder:', error.message);
      return false;
    }
  }

  /**
   * Test connection to Mailcow API
   * @returns {Boolean} True if connection successful
   */
  async testConnection() {
    await this.initialize();
    
    if (!this.axios) {
      return false;
    }

    try {
      // Try to get API info or mailbox list
      const response = await this.axios.get('/');
      return response.status === 200;
    } catch (error) {
      console.error('Mailcow connection test failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new MailcowService();
/**
 * Payment Email Scanner Service
 * Parses payment notification emails from Venmo, PayPal, and CashApp
 * Automatically verifies payments based on order ID in payment notes
 */

const imapScanner = require('./imapEmailScanner');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const emailService = require('../utils/emailService');
const SystemConfig = require('../models/SystemConfig');

class PaymentEmailScanner {
  constructor() {
    this.providers = {
      venmo: {
        domains: ['venmo.com', 'notifications.venmo.com'],
        patterns: {
          amount: /\$?([\d,]+\.?\d*)/,
          orderIdInNote: /Order\s*#?\s*([A-Z0-9]{8})/i,
          sender: /from\s+([\w\s]+)/i,
          transactionId: /Transaction\s*ID:?\s*([A-Z0-9-]+)/i
        }
      },
      paypal: {
        domains: ['paypal.com', 'mail.paypal.com', 'service.paypal.com'],
        patterns: {
          amount: /\$?([\d,]+\.?\d*)\s*USD/i,
          orderIdInNote: /Order\s*#?\s*([A-Z0-9]{8})/i,
          sender: /from\s+([\w\s@.]+)/i,
          transactionId: /Transaction\s*ID:?\s*([A-Z0-9]+)/i
        }
      },
      cashapp: {
        domains: ['cash.app', 'square.com', 'squareup.com'],
        patterns: {
          amount: /\$?([\d,]+\.?\d*)/,
          orderIdInNote: /Order\s*#?\s*([A-Z0-9]{8})/i,
          sender: /from\s+\$?([\w]+)/i,
          transactionId: /Payment\s*ID:?\s*([A-Z0-9-]+)/i
        }
      }
    };
  }

  /**
   * Scan for new payment emails and process them
   * @returns {Array} Array of verified payments
   */
  async scanForPayments() {
    try {
      // Connect to IMAP
      const connected = await imapScanner.connect();
      if (!connected) {
        console.log('Could not connect to IMAP server');
        return [];
      }

      // Get unread payment emails
      const emails = await imapScanner.getUnreadEmails();
      
      if (!emails || emails.length === 0) {
        console.log('No new payment emails found');
        imapScanner.disconnect();
        return [];
      }

      console.log(`Found ${emails.length} unread payment emails`);
      
      const verifiedPayments = [];
      
      for (const email of emails) {
        try {
          const payment = await this.parsePaymentEmail(email);
          
          if (payment) {
            // Verify and update order
            const verified = await this.verifyAndUpdateOrder(payment);
            
            if (verified) {
              verifiedPayments.push(payment);
              // Mark email as read
              await imapScanner.markAsRead(email.uid);
              // Move to processed folder if needed
              // await imapScanner.moveToFolder(email.uid, 'Processed');
            }
          }
        } catch (error) {
          console.error(`Error processing email ${email.uid}:`, error);
        }
      }
      
      console.log(`Verified ${verifiedPayments.length} payments`);
      imapScanner.disconnect();
      return verifiedPayments;
    } catch (error) {
      console.error('Error scanning for payments:', error);
      return [];
    }
  }

  /**
   * Parse a payment email to extract payment details
   * @param {Object} email - Email object from IMAP
   * @returns {Object|null} Parsed payment details or null if not a payment email
   */
  async parsePaymentEmail(email) {
    try {
      const { from, fromAddress, subject, text, html, date } = email;
      const body = text || html || '';
      
      // Determine provider based on sender domain
      const provider = this.identifyProvider(fromAddress || from);
      
      if (!provider) {
        console.log(`Not a payment email from known provider: ${from}`);
        return null;
      }
      
      // Use text body preferentially, fall back to HTML if needed
      const content = text || this.stripHtml(html || body || '');
      
      // Extract payment details using provider-specific patterns
      const patterns = this.providers[provider].patterns;
      
      // Extract order ID from note/memo
      const orderIdMatch = content.match(patterns.orderIdInNote);
      if (!orderIdMatch) {
        console.log('No order ID found in payment note');
        return null;
      }
      
      const shortOrderId = orderIdMatch[1].toUpperCase();
      
      // Extract amount
      const amountMatch = content.match(patterns.amount);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null;
      
      // Extract sender info
      const senderMatch = content.match(patterns.sender);
      const sender = senderMatch ? senderMatch[1].trim() : 'Unknown';
      
      // Extract transaction ID if available
      const transactionMatch = content.match(patterns.transactionId);
      const transactionId = transactionMatch ? transactionMatch[1] : `${provider}-${Date.now()}`;
      
      // Find full order by short ID
      const order = await this.findOrderByShortId(shortOrderId);
      
      if (!order) {
        console.log(`No matching order found for ID: ${shortOrderId}`);
        return null;
      }
      
      return {
        orderId: order._id,
        shortOrderId,
        provider,
        amount,
        sender,
        transactionId,
        emailId: email.id || email.uid,
        emailSubject: subject,
        emailDate: new Date(date),
        verifiedAt: new Date()
      };
    } catch (error) {
      console.error('Error parsing payment email:', error);
      return null;
    }
  }

  /**
   * Identify payment provider from email sender
   * @param {String} from - Email sender address
   * @returns {String|null} Provider name or null
   */
  identifyProvider(from) {
    if (!from) return null;
    
    const fromLower = from.toLowerCase();
    
    for (const [provider, config] of Object.entries(this.providers)) {
      for (const domain of config.domains) {
        if (fromLower.includes(domain)) {
          return provider;
        }
      }
    }
    
    return null;
  }

  /**
   * Strip HTML tags from content
   * @param {String} html - HTML content
   * @returns {String} Plain text
   */
  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find order by short ID (last 8 characters)
   * @param {String} shortOrderId - Last 8 characters of order ID
   * @returns {Object|null} Order document or null
   */
  async findOrderByShortId(shortOrderId) {
    try {
      // Find orders with v2PaymentStatus = 'awaiting'
      const orders = await Order.find({
        v2PaymentStatus: 'awaiting'
      });
      
      // Match by last 8 characters
      for (const order of orders) {
        const orderIdStr = order._id.toString();
        const orderShortId = orderIdStr.slice(-8).toUpperCase();
        
        if (orderShortId === shortOrderId) {
          return order;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding order by short ID:', error);
      return null;
    }
  }

  /**
   * Verify payment amount and update order
   * @param {Object} payment - Payment details
   * @returns {Boolean} True if verified and updated
   */
  async verifyAndUpdateOrder(payment) {
    try {
      const order = await Order.findById(payment.orderId);
      
      if (!order) {
        console.error('Order not found:', payment.orderId);
        return false;
      }
      
      // Check if already verified
      if (order.v2PaymentStatus === 'verified') {
        console.log('Order already verified:', payment.orderId);
        return true;
      }
      
      // Verify amount (allow small variance for fees)
      const expectedAmount = order.v2PaymentAmount || order.actualTotal || order.estimatedTotal;
      const variance = Math.abs(payment.amount - expectedAmount);
      
      if (variance > 1.00) {
        console.warn(`Payment amount mismatch. Expected: $${expectedAmount}, Received: $${payment.amount}`);
        // Still mark as verified but note the discrepancy
        order.v2PaymentNotes = `Amount variance: Expected $${expectedAmount}, received $${payment.amount}`;
      }
      
      // Update order with payment verification
      order.v2PaymentStatus = 'verified';
      order.v2PaymentVerifiedAt = new Date();
      order.v2PaymentTransactionId = payment.transactionId;
      order.v2PaymentMethod = payment.provider;
      
      if (!order.v2PaymentNotes) {
        order.v2PaymentNotes = `Payment verified via email from ${payment.sender}`;
      }
      
      await order.save();
      
      console.log(`Payment verified for order ${payment.orderId}`);
      
      // Send payment confirmation to customer
      await this.sendPaymentConfirmation(order);
      
      // If WDF is complete, send pickup notification
      if (order.status === 'processed') {
        await this.sendPickupNotification(order);
      }
      
      return true;
    } catch (error) {
      console.error('Error verifying and updating order:', error);
      return false;
    }
  }

  /**
   * Send payment confirmation email to customer
   * @param {Object} order - Order document
   */
  async sendPaymentConfirmation(order) {
    try {
      const customer = await Customer.findById(order.customerId);
      
      if (!customer) {
        console.error('Customer not found for payment confirmation');
        return;
      }
      
      // Use emailService to send confirmation
      // This would be implemented in emailService
      console.log(`Sending payment confirmation to ${customer.email}`);
      
      // Placeholder for actual email sending
      // await emailService.sendV2PaymentConfirmation(order, customer);
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
    }
  }

  /**
   * Send pickup ready notification to affiliate
   * @param {Object} order - Order document
   */
  async sendPickupNotification(order) {
    try {
      console.log(`Sending pickup notification for order ${order._id}`);
      
      // This would trigger the existing pickup notification
      // await emailService.sendPickupReadyNotification(order);
    } catch (error) {
      console.error('Error sending pickup notification:', error);
    }
  }

  /**
   * Check specific order for payment
   * @param {String} orderId - Order ID to check
   * @returns {Boolean} True if payment found and verified
   */
  async checkOrderPayment(orderId) {
    try {
      const order = await Order.findById(orderId);
      
      if (!order || order.v2PaymentStatus === 'verified') {
        return order?.v2PaymentStatus === 'verified';
      }
      
      // Get short order ID
      const shortOrderId = orderId.toString().slice(-8).toUpperCase();
      
      // Search emails for this order ID
      const emails = await mailcowService.searchEmails(`Order #${shortOrderId}`);
      
      for (const email of emails) {
        const payment = await this.parsePaymentEmail(email);
        
        if (payment && payment.orderId.toString() === orderId.toString()) {
          const verified = await this.verifyAndUpdateOrder(payment);
          
          if (verified) {
            await mailcowService.markEmailAsProcessed(email.id || email.uid);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking order payment:', error);
      return false;
    }
  }

  /**
   * Process all pending payments (manual trigger)
   * @returns {Object} Processing results
   */
  async processAllPendingPayments() {
    try {
      const results = {
        processed: 0,
        verified: 0,
        failed: 0,
        errors: []
      };
      
      // Get all orders awaiting payment
      const pendingOrders = await Order.find({
        v2PaymentStatus: 'awaiting'
      });
      
      console.log(`Processing ${pendingOrders.length} pending orders`);
      
      for (const order of pendingOrders) {
        try {
          const verified = await this.checkOrderPayment(order._id);
          
          results.processed++;
          
          if (verified) {
            results.verified++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            orderId: order._id,
            error: error.message
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error processing pending payments:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PaymentEmailScanner();
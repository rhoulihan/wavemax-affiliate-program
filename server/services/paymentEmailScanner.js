/**
 * Payment Email Scanner Service
 * Parses payment notification emails from Venmo, PayPal, and CashApp
 * Automatically verifies payments based on order ID in payment notes
 */

const imapScanner = require('./imapEmailScanner');
const mailcowService = require('./mailcowService');
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
          amount: /\$\s*(\d+)\s*[\.\n\s]+(\d{2})/, // Venmo displays as "$ 2 . 35" or with newlines
          amountFallback: /\$?([\d,]+\.?\d*)/, // Fallback pattern
          orderIdInNote: /WaveMAX\s+Order\s+(ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})/i, // Match "WaveMAX Order ORD-[UUID]"
          orderIdFallback: /ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/i, // Fallback pattern for UUID
          sender: /([A-Za-z\s]+)\s+paid\s+you/i, // "John Houlihan paid you"
          senderFallback: /Subject:\s*([A-Za-z\s]+)\s+paid\s+you/i, // From subject line
          transactionId: /Transaction\s*ID[\s\n]*(\d+)/i // May have newline after ID
        }
      },
      paypal: {
        domains: ['paypal.com', 'mail.paypal.com', 'service.paypal.com'],
        patterns: {
          amount: /\$?([\d,]+\.?\d*)\s*USD/i,
          orderIdInNote: /Order\s*:?\s*(ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})/i,
          orderIdFallback: /ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/i,
          sender: /from\s+([\w\s@.]+)/i,
          transactionId: /Transaction\s*ID:?\s*([A-Z0-9]+)/i
        }
      },
      cashapp: {
        domains: ['cash.app', 'square.com', 'squareup.com'],
        patterns: {
          amount: /\$?([\d,]+\.?\d*)/,
          orderIdInNote: /Order\s*:?\s*(ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})/i,
          orderIdFallback: /ORD-[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/i,
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
          console.log(`Processing email: From: ${email.from}, Subject: ${email.subject}`);
          const payment = await this.parsePaymentEmail(email);
          
          if (payment) {
            console.log(`Parsed payment: Order ${payment.orderNumber}, Amount: $${payment.amount}, Provider: ${payment.provider}`);
            // Verify and update order
            const verified = await this.verifyAndUpdateOrder(payment);
            
            if (verified) {
              console.log(`Payment verified for order ${payment.orderNumber}`);
              verifiedPayments.push(payment);
              // Mark email as read
              await imapScanner.markAsRead(email.uid);
              // Move to processed folder if needed
              // await imapScanner.moveToFolder(email.uid, 'Processed');
            } else {
              console.log(`Payment could not be verified for order ${payment.orderNumber}`);
            }
          } else {
            console.log('Email was not parsed as a valid payment');
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
      
      // Check if this is a forwarded email
      const isForwarded = subject && (
        subject.toLowerCase().includes('fwd:') || 
        subject.toLowerCase().includes('forwarded')
      );
      
      // For forwarded emails, look for the provider in the subject or body
      let provider = null;
      
      if (isForwarded) {
        // Check subject for payment provider
        const subjectLower = subject.toLowerCase();
        const bodyLower = (text || html || '').toLowerCase();
        
        if (subjectLower.includes('venmo') || bodyLower.includes('venmo@venmo.com')) {
          provider = 'venmo';
        } else if (subjectLower.includes('paypal') || bodyLower.includes('@paypal.com')) {
          provider = 'paypal';
        } else if (subjectLower.includes('cash app') || bodyLower.includes('@cash.app')) {
          provider = 'cashapp';
        }
      } else {
        // For direct emails, check sender domain
        provider = this.identifyProvider(fromAddress || from);
      }
      
      if (!provider) {
        console.log(`Not a payment email from known provider: ${from} (subject: ${subject})`);
        return null;
      }
      
      // Use text body preferentially, fall back to HTML if needed
      const content = text || this.stripHtml(html || body || '');
      
      // Extract payment details using provider-specific patterns
      const patterns = this.providers[provider].patterns;
      
      // Extract order ID from note/memo - try primary pattern first, then fallback
      let orderIdMatch = content.match(patterns.orderIdInNote);
      if (!orderIdMatch && patterns.orderIdFallback) {
        orderIdMatch = content.match(patterns.orderIdFallback);
      }
      
      if (!orderIdMatch) {
        console.log('No order ID found in payment note');
        return null;
      }
      
      // Extract the full order ID (ORD-[UUID])
      const orderId = orderIdMatch[1];
      
      // Extract amount - handle Venmo's special format
      let amount = null;
      if (provider === 'venmo') {
        // Try Venmo's separated dollar/cents format first
        const venmoAmountMatch = content.match(patterns.amount);
        if (venmoAmountMatch) {
          const dollars = parseInt(venmoAmountMatch[1]);
          const cents = parseInt(venmoAmountMatch[2]);
          amount = dollars + (cents / 100);
        } else if (patterns.amountFallback) {
          // Fall back to standard format
          const fallbackMatch = content.match(patterns.amountFallback);
          amount = fallbackMatch ? parseFloat(fallbackMatch[1].replace(',', '')) : null;
        }
      } else {
        // Standard amount extraction for other providers
        const amountMatch = content.match(patterns.amount);
        amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null;
      }
      
      // Extract sender info - try primary pattern first, then fallback
      let senderMatch = content.match(patterns.sender);
      if (!senderMatch && patterns.senderFallback) {
        senderMatch = content.match(patterns.senderFallback);
      }
      const sender = senderMatch ? senderMatch[1].trim() : 'Unknown';
      
      // Extract transaction ID if available
      const transactionMatch = content.match(patterns.transactionId);
      const transactionId = transactionMatch ? transactionMatch[1] : `${provider}-${Date.now()}`;
      
      // Find order by full order ID
      const order = await this.findOrderById(orderId);
      
      if (!order) {
        console.log(`No matching order found for ID: ${orderId}`);
        return null;
      }
      
      return {
        orderId: order.orderId,  // Use the orderId field, not _id
        orderNumber: orderId,
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
   * Find order by order ID
   * @param {String} orderId - Full order ID (ORD-[UUID])
   * @returns {Object|null} Order document or null
   */
  async findOrderById(orderId) {
    try {
      // Find order with matching orderId and v2PaymentStatus = 'awaiting'
      const order = await Order.findOne({
        orderId: orderId,
        v2PaymentStatus: 'awaiting'
      });
      
      return order;
    } catch (error) {
      console.error('Error finding order by ID:', error);
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
      // Find order by orderId field (not _id)
      const order = await Order.findOne({ orderId: payment.orderId });
      
      if (!order) {
        console.error('Order not found:', payment.orderId);
        return false;
      }
      
      // Check if already verified - this would be a duplicate payment
      if (order.v2PaymentStatus === 'verified') {
        console.log('Order already verified - duplicate payment detected:', payment.orderId);
        
        // Notify admin about duplicate payment
        try {
          await this.notifyAdminPaymentIssue(order, payment, order.v2PaymentAmount || order.actualTotal, 'duplicate');
        } catch (error) {
          console.error('Error notifying admin about duplicate payment:', error);
        }
        
        return true;
      }
      
      // Verify amount - payment must be >= order amount
      const expectedAmount = order.v2PaymentAmount || order.actualTotal || order.estimatedTotal;
      const paymentDifference = payment.amount - expectedAmount;
      
      if (payment.amount < expectedAmount) {
        // Payment is less than required - notify admin but don't verify
        console.warn(`Payment insufficient. Expected: $${expectedAmount}, Received: $${payment.amount}`);
        
        // Notify admin about insufficient payment
        try {
          await this.notifyAdminPaymentIssue(order, payment, expectedAmount, 'underpayment');
        } catch (error) {
          console.error('Error notifying admin about underpayment:', error);
        }
        
        return false; // Don't verify the payment
      }
      
      // Payment is sufficient (exact or overpayment)
      // Update order with payment verification
      order.v2PaymentStatus = 'verified';
      order.v2PaymentVerifiedAt = new Date();
      order.v2PaymentTransactionId = payment.transactionId;
      order.v2PaymentMethod = payment.provider;
      
      if (paymentDifference > 0) {
        // Customer overpaid - note this and notify admin
        order.v2PaymentNotes = `Payment verified. Amount variance: Overpayment of $${paymentDifference.toFixed(2)} received`;
        
        // Notify admin about overpayment
        try {
          await this.notifyAdminPaymentIssue(order, payment, expectedAmount, 'overpayment');
        } catch (error) {
          console.error('Error notifying admin about overpayment:', error);
        }
      } else {
        // Exact payment
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
      const customer = await Customer.findOne({ customerId: order.customerId });
      
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
      
      // Search emails for this order ID (using the full ORD-UUID format)
      const emails = await mailcowService.searchEmails(order.orderId);
      
      for (const email of emails) {
        const payment = await this.parsePaymentEmail(email);
        
        if (payment && payment.orderId === order.orderId) {
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

  /**
   * Notify admin about payment issues (overpayment or underpayment)
   * @param {Object} order - Order document
   * @param {Object} payment - Payment details
   * @param {Number} expectedAmount - Expected payment amount
   * @param {String} issueType - 'overpayment' or 'underpayment'
   */
  async notifyAdminPaymentIssue(order, payment, expectedAmount, issueType) {
    try {
      // Get customer details
      const customer = await Customer.findOne({ customerId: order.customerId });
      if (!customer) {
        console.error('Customer not found for payment issue notification');
        return;
      }

      const paymentDifference = Math.abs(payment.amount - expectedAmount);
      
      let subject, issueDescription, actionRequired;
      
      if (issueType === 'duplicate') {
        subject = `Duplicate Payment Received - Order ${order.orderId || order._id.toString().slice(-8).toUpperCase()}`;
        issueDescription = `Customer has made a duplicate payment of $${payment.amount.toFixed(2)} for an already paid order`;
        actionRequired = 'This order was already paid. Please refund this duplicate payment to the customer immediately.';
      } else if (issueType === 'overpayment') {
        subject = `Overpayment Received - Order ${order.orderId || order._id.toString().slice(-8).toUpperCase()}`;
        issueDescription = `Customer has overpaid by $${paymentDifference.toFixed(2)}`;
        actionRequired = 'Consider refunding the overpayment amount or applying it as credit to future orders.';
      } else {
        subject = `Underpayment Received - Order ${order.orderId || order._id.toString().slice(-8).toUpperCase()}`;
        issueDescription = `Customer has underpaid by $${paymentDifference.toFixed(2)}`;
        actionRequired = 'Payment verification was blocked. Please follow up with the customer for the remaining amount.';
      }

      const alertTitle = issueType === 'duplicate' ? 'Duplicate Payment' : 
                         issueType === 'overpayment' ? 'Overpayment' : 'Underpayment';
      
      const emailContent = `
        <h2>Payment ${alertTitle} Alert</h2>
        
        <p>${issueDescription}</p>
        
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Order ID:</strong> ${order._id}</li>
          <li><strong>Short Order ID:</strong> ${order._id.toString().slice(-8).toUpperCase()}</li>
          <li><strong>Customer:</strong> ${customer.firstName} ${customer.lastName}</li>
          <li><strong>Customer Email:</strong> ${customer.email}</li>
          <li><strong>Customer Phone:</strong> ${customer.phone}</li>
        </ul>
        
        <h3>Payment Details:</h3>
        <ul>
          <li><strong>Expected Amount:</strong> $${expectedAmount.toFixed(2)}</li>
          <li><strong>Received Amount:</strong> $${payment.amount.toFixed(2)}</li>
          <li><strong>Difference:</strong> $${paymentDifference.toFixed(2)}</li>
          <li><strong>Payment Method:</strong> ${payment.provider}</li>
          <li><strong>Transaction ID:</strong> ${payment.transactionId}</li>
          <li><strong>Sender:</strong> ${payment.sender}</li>
        </ul>
        
        <h3>Action Required:</h3>
        <p>${actionRequired}</p>
        
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from the WaveMAX Payment Scanner system.
        </p>
      `;

      // Send notification to admin
      await emailService.sendAdminNotification({
        subject: subject,
        html: emailContent,
        priority: issueType === 'underpayment' ? 'high' : 'normal'
      });

      console.log(`Admin notified about ${issueType} for order ${order._id}`);
    } catch (error) {
      console.error(`Error sending admin notification for ${issueType}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PaymentEmailScanner();
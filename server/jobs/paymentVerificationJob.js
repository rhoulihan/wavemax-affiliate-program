/**
 * Payment Verification Cron Job
 * Runs periodically to check for payments and send reminders
 */

const cron = require('node-cron');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const paymentEmailScanner = require('../services/paymentEmailScanner');
const emailService = require('../utils/emailService');

class PaymentVerificationJob {
  constructor() {
    this.running = false;
    this.job = null;
    this.checkInterval = 5; // Default 5 minutes
    this.maxAttempts = 48; // Default 48 attempts (4 hours)
  }

  /**
   * Initialize and start the cron job
   */
  async start() {
    try {
      // Get configuration
      const paymentVersion = await SystemConfig.getValue('payment_version', 'v1');
      
      // Only run if V2 payment system is enabled
      if (paymentVersion !== 'v2') {
        console.log('Payment verification job not started - V1 payment system active');
        return;
      }

      // Get check interval from config (in milliseconds, convert to minutes for cron)
      const intervalMs = await SystemConfig.getValue('payment_check_interval', 300000);
      this.checkInterval = Math.max(1, Math.round(intervalMs / 60000)); // Convert to minutes, minimum 1
      this.maxAttempts = await SystemConfig.getValue('payment_check_max_attempts', 48);

      // Create cron pattern (run every N minutes)
      const cronPattern = `*/${this.checkInterval} * * * *`;
      
      console.log(`Starting payment verification job - checking every ${this.checkInterval} minutes`);
      
      // Schedule the job
      this.job = cron.schedule(cronPattern, async () => {
        await this.runVerification();
      });
      
      // Run immediately on startup
      await this.runVerification();
      
      console.log('Payment verification job started successfully');
    } catch (error) {
      console.error('Error starting payment verification job:', error);
    }
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('Payment verification job stopped');
    }
  }

  /**
   * Run the verification process
   */
  async runVerification() {
    // Prevent concurrent runs
    if (this.running) {
      console.log('Payment verification already running, skipping...');
      return;
    }

    this.running = true;
    const startTime = Date.now();
    
    try {
      console.log(`[${new Date().toISOString()}] Starting payment verification check`);
      
      // First, scan for new payment emails
      const scannedPayments = await paymentEmailScanner.scanForPayments();
      
      if (scannedPayments.length > 0) {
        console.log(`Verified ${scannedPayments.length} payments from email scan`);
      }
      
      // Then check pending orders
      await this.checkPendingPayments();
      
      const duration = Date.now() - startTime;
      console.log(`Payment verification completed in ${duration}ms`);
      
    } catch (error) {
      console.error('Error in payment verification job:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Check all orders awaiting payment
   */
  async checkPendingPayments() {
    try {
      // Get orders awaiting payment that have been weighed (WDF complete)
      const pendingOrders = await Order.find({
        v2PaymentStatus: 'awaiting',
        status: { $in: ['processing', 'processed'] }, // Order has been weighed
        v2PaymentCheckAttempts: { $lt: this.maxAttempts }
      }).populate('customerId').populate('affiliateId');
      
      if (pendingOrders.length === 0) {
        return;
      }
      
      console.log(`Found ${pendingOrders.length} orders awaiting payment`);
      
      for (const order of pendingOrders) {
        try {
          await this.processOrder(order);
        } catch (error) {
          console.error(`Error processing order ${order._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking pending payments:', error);
    }
  }

  /**
   * Process a single order for payment verification
   */
  async processOrder(order) {
    try {
      // Check if customer is V2
      const customer = order.customerId;
      if (!customer || customer.registrationVersion !== 'v2') {
        return; // Skip non-V2 customers
      }

      // Try to verify payment via email scan
      const verified = await paymentEmailScanner.checkOrderPayment(order._id);
      
      if (verified) {
        console.log(`Payment verified for order ${order._id}`);
        
        // If order is ready (WDF complete), send pickup notification
        if (order.status === 'processed') {
          await this.sendPickupNotification(order);
        }
        
        return;
      }
      
      // Payment not found, increment check attempts
      order.v2PaymentCheckAttempts = (order.v2PaymentCheckAttempts || 0) + 1;
      order.v2LastPaymentCheck = new Date();
      
      // Check if we should send a reminder or escalate
      if (order.v2PaymentCheckAttempts >= this.maxAttempts) {
        // Max attempts reached - mark as failed and escalate
        order.v2PaymentStatus = 'failed';
        await order.save();
        
        console.log(`Payment timeout for order ${order._id} - escalating to admin`);
        await this.escalateToAdmin(order);
        
      } else {
        // Determine if we should send a reminder
        const shouldSendReminder = this.shouldSendReminder(order);
        
        if (shouldSendReminder) {
          await this.sendPaymentReminder(order);
        }
        
        await order.save();
      }
      
    } catch (error) {
      console.error(`Error processing order ${order._id}:`, error);
    }
  }

  /**
   * Determine if a payment reminder should be sent
   */
  shouldSendReminder(order) {
    const attempts = order.v2PaymentCheckAttempts || 0;
    
    // Send reminders at specific intervals
    // First reminder after 30 minutes (6 attempts at 5-minute intervals)
    // Then every hour (12 attempts)
    const reminderIntervals = [6, 12, 24, 36];
    
    return reminderIntervals.includes(attempts);
  }

  /**
   * Send payment reminder to customer
   */
  async sendPaymentReminder(order) {
    try {
      const customer = order.customerId;
      
      if (!customer || !customer.email) {
        console.error('Cannot send reminder - customer email not found');
        return;
      }
      
      console.log(`Sending payment reminder to ${customer.email} for order ${order._id}`);
      
      // Generate fresh payment links (in case they expired or were lost)
      const paymentLinkService = require('../services/paymentLinkService');
      const { links, qrCodes } = await paymentLinkService.generatePaymentLinks(
        order._id,
        order.v2PaymentAmount || order.actualTotal || order.estimatedTotal,
        customer.name
      );
      
      // Update order with fresh links
      order.v2PaymentLinks = links;
      order.v2PaymentQRCodes = qrCodes;
      await order.save();
      
      // Send reminder email
      await this.sendReminderEmail(order, customer);
      
    } catch (error) {
      console.error('Error sending payment reminder:', error);
    }
  }

  /**
   * Send reminder email to customer
   */
  async sendReminderEmail(order, customer) {
    try {
      // This will be implemented in emailService
      // For now, log the action
      console.log(`Payment reminder email would be sent to ${customer.email}`);
      
      // Placeholder for actual implementation
      // await emailService.sendV2PaymentReminder(order, customer);
    } catch (error) {
      console.error('Error sending reminder email:', error);
    }
  }

  /**
   * Send pickup ready notification to affiliate
   */
  async sendPickupNotification(order) {
    try {
      const affiliate = order.affiliateId;
      
      if (!affiliate) {
        console.error('Cannot send pickup notification - affiliate not found');
        return;
      }
      
      console.log(`Sending pickup notification to affiliate ${affiliate.email} for order ${order._id}`);
      
      // This will use existing emailService method
      // await emailService.sendPickupReadyNotification(order);
    } catch (error) {
      console.error('Error sending pickup notification:', error);
    }
  }

  /**
   * Escalate to admin when payment timeout occurs
   */
  async escalateToAdmin(order) {
    try {
      console.log(`Escalating payment timeout for order ${order._id} to admin`);
      
      // Get admin email from config or use default
      const adminEmail = await SystemConfig.getValue('admin_notification_email', 'admin@wavemax.promo');
      
      // Send escalation email
      // await emailService.sendPaymentTimeoutEscalation(order, adminEmail);
      
      // Log for now
      console.log(`Admin escalation email would be sent to ${adminEmail} for order ${order._id}`);
      
    } catch (error) {
      console.error('Error escalating to admin:', error);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      running: this.running,
      scheduled: this.job !== null,
      checkInterval: this.checkInterval,
      maxAttempts: this.maxAttempts
    };
  }

  /**
   * Manually trigger verification (for testing)
   */
  async triggerManual() {
    console.log('Manual payment verification triggered');
    await this.runVerification();
  }
}

// Create singleton instance
const paymentVerificationJob = new PaymentVerificationJob();

// Export the instance
module.exports = paymentVerificationJob;
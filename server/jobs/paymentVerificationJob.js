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
    
    // Send reminders hourly after the first 30 minutes
    // First reminder after 30 minutes (6 attempts at 5-minute intervals)
    // Then every hour (12 attempts each hour)
    if (attempts >= 6) {
      // After 30 minutes, send reminder every hour (every 12 attempts)
      return (attempts - 6) % 12 === 0;
    }
    
    // First reminder at 30 minutes
    return attempts === 6;
  }

  /**
   * Send payment reminder to customer
   */
  async sendPaymentReminder(order) {
    try {
      // Fetch customer by customerId
      const customer = await Customer.findOne({ customerId: order.customerId });
      
      if (!customer || !customer.email) {
        console.error('Cannot send reminder - customer not found or email missing');
        return;
      }
      
      // Calculate time elapsed and urgency
      const hoursElapsed = Math.floor((order.v2PaymentCheckAttempts || 0) * this.checkInterval / 60);
      const hoursRemaining = Math.max(0, 4 - hoursElapsed);
      const isUrgent = hoursRemaining <= 1;
      
      console.log(`Sending payment reminder to ${customer.email} for order ${order._id} (${hoursElapsed} hours elapsed, ${hoursRemaining} hours remaining)`);
      
      // Generate fresh payment links (in case they expired or were lost)
      const paymentLinkService = require('../services/paymentLinkService');
      const { links, qrCodes, shortOrderId } = await paymentLinkService.generatePaymentLinks(
        order._id,
        order.v2PaymentAmount || order.actualTotal || order.estimatedTotal,
        customer.name || `${customer.firstName} ${customer.lastName}`
      );
      
      // Update order with fresh links
      order.v2PaymentLinks = links;
      order.v2PaymentQRCodes = qrCodes;
      await order.save();
      
      // Generate "already paid?" confirmation link
      const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';
      const confirmationLink = `${baseUrl}/payment-confirmation-embed.html?orderId=${shortOrderId}&token=${order._id}`;
      
      // Send reminder email with urgency and confirmation link
      await this.sendReminderEmail(order, customer, {
        hoursElapsed,
        hoursRemaining,
        isUrgent,
        confirmationLink
      });
      
    } catch (error) {
      console.error('Error sending payment reminder:', error);
    }
  }

  /**
   * Send reminder email to customer
   */
  async sendReminderEmail(order, customer, reminderInfo) {
    try {
      // Calculate reminder number based on attempts
      const reminderNumber = Math.floor((order.v2PaymentCheckAttempts - 6) / 12) + 1;
      
      // Update reminder tracking on order
      order.v2ReminderCount = reminderNumber;
      order.v2LastReminderSentAt = new Date();
      
      // Add to reminders array
      if (!order.v2PaymentReminders) {
        order.v2PaymentReminders = [];
      }
      order.v2PaymentReminders.push({
        sentAt: new Date(),
        reminderNumber: reminderNumber,
        method: 'email'
      });
      
      await order.save();
      
      // Send the reminder email
      await emailService.sendV2PaymentReminder({
        customer,
        order,
        reminderNumber,
        paymentAmount: order.v2PaymentAmount,
        paymentLinks: order.v2PaymentLinks,
        qrCodes: order.v2PaymentQRCodes
      });
      
      console.log(`Payment reminder #${reminderNumber} sent to ${customer.email} for order ${order.orderId}`);
    } catch (error) {
      console.error('Error sending reminder email:', error);
    }
  }

  /**
   * Send pickup ready notification to affiliate
   */
  async sendPickupNotification(order) {
    try {
      // Fetch affiliate and customer by their IDs
      const Affiliate = require('../models/Affiliate');
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      const customer = await Customer.findOne({ customerId: order.customerId });
      
      if (!affiliate || !affiliate.email) {
        console.error('Cannot send pickup notification - affiliate not found or email missing');
        return;
      }
      
      console.log(`Sending pickup notification to affiliate ${affiliate.email} for order ${order.orderId}`);
      
      // Send notification to affiliate that order is ready
      await emailService.sendAffiliateCommissionEmail(
        affiliate,
        order,
        customer
      );
      
      // Also notify customer that order is ready
      if (customer && customer.email) {
        await emailService.sendOrderStatusUpdateEmail(
          customer,
          order,
          'ready'
        );
      }
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
      
      // Get customer and affiliate information
      const Affiliate = require('../models/Affiliate');
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      
      // Get admin email from config or use default
      const adminEmail = await SystemConfig.getValue('admin_notification_email', 'admin@wavemax.promo');
      
      // Calculate time since payment requested
      const hoursSinceRequest = Math.round((Date.now() - order.v2PaymentRequestedAt.getTime()) / (1000 * 60 * 60));
      
      // Prepare escalation details
      const escalationDetails = {
        orderId: order.orderId,
        orderMongoId: order._id,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
        customerEmail: customer?.email || 'Unknown',
        customerPhone: customer?.phone || 'Unknown',
        affiliateName: affiliate ? `${affiliate.firstName} ${affiliate.lastName}` : 'Unknown',
        affiliateEmail: affiliate?.email || 'Unknown',
        paymentAmount: order.v2PaymentAmount || order.actualTotal || 'Unknown',
        hoursSinceRequest,
        paymentRequestedAt: order.v2PaymentRequestedAt,
        attemptsMade: order.v2PaymentCheckAttempts || 0
      };
      
      // Log escalation details
      console.log(`Admin escalation details:`, escalationDetails);
      
      // Send escalation email
      // await emailService.sendPaymentTimeoutEscalation(order, adminEmail, escalationDetails);
      
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
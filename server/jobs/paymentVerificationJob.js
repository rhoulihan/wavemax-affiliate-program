/**
 * Payment Verification Cron Job — retuned per the redesign spec §6.5.
 *
 * Two decoupled cadences:
 *  - DETECTION: every cron tick (payment_scan_interval_ms, default 2 min) the
 *    IMAP scanner looks for inbound payment emails. `paymentCheckAttempts`
 *    counts detection scans only.
 *  - REMINDERS: time-based, every payment_reminder_interval_minutes (default
 *    60), capped at payment_reminder_max_attempts (default 8).
 *    `paymentReminderCount` is the authoritative reminder counter.
 *
 * After the final reminder the order escalates: one "come to the store"
 * notice (sendV2ComeToStoreNotice, guarded by holdNoticeSentAt and the
 * payment_hold_notice_enabled master switch), paymentEscalated=true,
 * heldAtStore=true, admin-visibility hook (escalateToAdmin), audit event.
 * paymentStatus is NEVER set to 'failed' — the inbox keeps being scanned and
 * a late payment still verifies and promotes through applyReadyGate (Path B).
 *
 * Runs on the leader box only (RUN_BACKGROUND_JOBS gate in scheduler.js).
 */

const cron = require('node-cron');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const paymentEmailScanner = require('../services/paymentEmailScanner');
const orderReadyGateService = require('../services/orderReadyGateService');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');

class PaymentVerificationJob {
  constructor() {
    this.running = false;
    this.job = null;
    this.scanIntervalMs = 120000;       // payment_scan_interval_ms
    this.reminderIntervalMinutes = 60;  // payment_reminder_interval_minutes
    this.maxReminders = 8;              // payment_reminder_max_attempts
    this.holdNoticeEnabled = true;      // payment_hold_notice_enabled
  }

  /**
   * Initialize config from SystemConfig and start the cron schedule.
   */
  async start() {
    try {
      this.scanIntervalMs = await SystemConfig.getValue('payment_scan_interval_ms', 120000);
      this.reminderIntervalMinutes = await SystemConfig.getValue('payment_reminder_interval_minutes', 60);
      this.maxReminders = await SystemConfig.getValue('payment_reminder_max_attempts', 8);
      this.holdNoticeEnabled = await SystemConfig.getValue('payment_hold_notice_enabled', true);

      const intervalMinutes = Math.max(1, Math.round(this.scanIntervalMs / 60000));
      const cronPattern = `*/${intervalMinutes} * * * *`;

      logger.info(`Starting payment verification job - scan every ${intervalMinutes} min, reminders every ${this.reminderIntervalMinutes} min, cap ${this.maxReminders}`);

      this.job = cron.schedule(cronPattern, async () => {
        await this.runVerification();
      });

      // Run immediately on startup
      await this.runVerification();

      logger.info('Payment verification job started successfully');
    } catch (error) {
      logger.error('Error starting payment verification job:', error);
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Payment verification job stopped');
    }
  }

  /**
   * One tick: scan the inbox (detection), then walk pending orders
   * (per-order detection + reminder cadence).
   */
  async runVerification() {
    if (this.running) {
      logger.info('Payment verification already running, skipping...');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Inbox-wide scan first — this path has NO escalation filter, so a
      // post-escalation payment still verifies (spec §6.5).
      const scannedPayments = await paymentEmailScanner.scanForPayments();
      if (scannedPayments.length > 0) {
        logger.info(`Verified ${scannedPayments.length} payments from email scan`);
      }

      await this.checkPendingPayments();

      logger.info(`Payment verification completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Error in payment verification job:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Orders still on the reminder cadence. Escalated orders are excluded —
   * they only leave the held state via the scanner/manual verify paths.
   */
  async checkPendingPayments() {
    try {
      const pendingOrders = await Order.find({
        paymentStatus: { $in: ['awaiting', 'confirming'] },
        status: { $in: ['in_progress', 'processed'] },
        paymentEscalated: { $ne: true }
      });

      if (pendingOrders.length === 0) {
        return;
      }

      logger.info(`Found ${pendingOrders.length} orders awaiting payment`);

      for (const order of pendingOrders) {
        try {
          await this.processOrder(order);
        } catch (error) {
          logger.error(`Error processing order ${order._id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error checking pending payments:', error);
    }
  }

  /**
   * Per-order tick: one targeted IMAP detection check, then the time-based
   * reminder/escalation cadence. Never sets paymentStatus='failed'.
   */
  async processOrder(order) {
    try {
      if (order.paymentStatus === 'verified') {
        return;
      }

      const customer = await Customer.findOne({ customerId: order.customerId });
      if (!customer) {
        return;
      }

      // DETECTION — targeted check for this order's payment email.
      const verified = await paymentEmailScanner.checkOrderPayment(order._id);
      if (verified) {
        logger.info(`Payment verified for order ${order._id}`);
        // Path B: run the canonical gate on a fresh document (idempotent;
        // the scanner's verifyAndUpdateOrder also gates — double-gating is a
        // deliberate no-op by design).
        const fresh = await Order.findById(order._id);
        if (fresh) {
          await orderReadyGateService.applyReadyGate(fresh, { trigger: 'payment_verified' });
        }
        return;
      }

      order.paymentCheckAttempts = (order.paymentCheckAttempts || 0) + 1; // detection counter ONLY
      order.lastPaymentCheck = new Date();

      // REMINDERS — time-based cadence + escalation.
      await this.maybeSendReminderOrHold(order, customer);

      await order.save();
    } catch (error) {
      logger.error(`Error processing order ${order._id}:`, error);
    }
  }

  /**
   * Time-based reminder gate (spec §6.5):
   *  - never when escalated
   *  - never past the cap
   *  - due when the interval has elapsed since the last reminder
   *    (or since paymentRequestedAt when none was sent yet).
   */
  shouldSendReminder(order) {
    if (order.paymentEscalated) {
      return false;
    }
    if ((order.paymentReminderCount || 0) >= this.maxReminders) {
      return false;
    }
    const clockBase = order.paymentLastReminderAt || order.paymentRequestedAt;
    if (!clockBase) {
      return false;
    }
    const elapsedMs = Date.now() - new Date(clockBase).getTime();
    return elapsedMs >= this.reminderIntervalMinutes * 60 * 1000;
  }

  /**
   * Send a due reminder; when the count reaches the cap, escalate-and-hold
   * exactly once. Mutates `order`; the caller saves.
   */
  async maybeSendReminderOrHold(order, customer) {
    if (this.shouldSendReminder(order)) {
      await this.sendPaymentReminder(order, customer);
    }
    if ((order.paymentReminderCount || 0) >= this.maxReminders && !order.paymentEscalated) {
      await this.escalateAndHold(order, customer);
    }
  }

  /**
   * Send one reminder reusing the STORED paymentLinks/paymentQRCodes generated
   * once at intake — links are never regenerated (spec §6.4/§6.5).
   */
  async sendPaymentReminder(order, customer) {
    try {
      if (!customer || !customer.email) {
        logger.error('Cannot send reminder - customer not found or email missing');
        return;
      }

      const reminderNumber = (order.paymentReminderCount || 0) + 1;

      await emailService.sendV2PaymentReminder({
        customer,
        order,
        reminderNumber,
        paymentAmount: order.paymentAmount,
        paymentLinks: order.paymentLinks,
        qrCodes: order.paymentQRCodes,
        maxReminders: this.maxReminders
      });

      order.paymentReminderCount = reminderNumber;
      order.paymentLastReminderAt = new Date();
      order.paymentReminders.push({ sentAt: new Date(), reminderNumber, method: 'email' });

      logger.info(`Payment reminder #${reminderNumber}/${this.maxReminders} sent to ${customer.email} for order ${order.orderId}`);
    } catch (error) {
      logger.error('Error sending payment reminder:', error);
    }
  }

  /**
   * Escalate after the final reminder: one come-to-store notice (master
   * switch payment_hold_notice_enabled; double-send guarded by
   * holdNoticeSentAt), flags, audit, admin hook. Mutates `order`; caller saves.
   */
  async escalateAndHold(order, customer) {
    try {
      if (this.holdNoticeEnabled && !order.holdNoticeSentAt && customer && customer.email) {
        await emailService.sendV2ComeToStoreNotice({ customer, order });
        order.holdNoticeSentAt = new Date();
      }

      order.paymentEscalated = true;
      order.heldAtStore = true; // physically held until payment verifies

      logAuditEvent(AuditEvents.PAYMENT_ESCALATED, {
        orderId: order.orderId,
        paymentReminderCount: order.paymentReminderCount,
        holdNoticeSentAt: order.holdNoticeSentAt
      });

      await this.escalateToAdmin(order);

      logger.info(`Order ${order.orderId} escalated after ${order.paymentReminderCount} reminders - held at store, paymentStatus stays '${order.paymentStatus}'`);
    } catch (error) {
      logger.error('Error escalating order:', error);
    }
  }

  /**
   * Admin-visibility hook fired alongside the hold notice (spec §6.5).
   * No longer implies failure — paymentStatus is never set to 'failed'.
   */
  async escalateToAdmin(order) {
    try {
      const Affiliate = require('../models/Affiliate');
      const customer = await Customer.findOne({ customerId: order.customerId });
      const affiliate = await Affiliate.findOne({ affiliateId: order.affiliateId });
      const adminEmail = await SystemConfig.getValue('admin_notification_email', 'admin@wavemax.promo');

      const hoursSinceRequest = order.paymentRequestedAt
        ? Math.round((Date.now() - order.paymentRequestedAt.getTime()) / (1000 * 60 * 60))
        : 0;

      const escalationDetails = {
        orderId: order.orderId,
        orderMongoId: order._id,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
        customerEmail: customer?.email || 'Unknown',
        customerPhone: customer?.phone || 'Unknown',
        affiliateName: affiliate ? `${affiliate.firstName} ${affiliate.lastName}` : 'Unknown',
        affiliateEmail: affiliate?.email || 'Unknown',
        paymentAmount: order.paymentAmount || order.actualTotal || 'Unknown',
        hoursSinceRequest,
        paymentRequestedAt: order.paymentRequestedAt,
        attemptsMade: order.paymentReminderCount || 0
      };

      await emailService.sendV2PaymentTimeoutEscalation(order, adminEmail, escalationDetails);
      logger.info(`Admin escalation sent to ${adminEmail} for order ${order.orderId}`);
    } catch (error) {
      logger.error('Error escalating to admin:', error);
    }
  }

  getStatus() {
    return {
      running: this.running,
      scheduled: this.job !== null,
      scanIntervalMs: this.scanIntervalMs,
      reminderIntervalMinutes: this.reminderIntervalMinutes,
      maxReminders: this.maxReminders
    };
  }

  /**
   * Manually trigger verification (admin/testing).
   */
  async triggerManual() {
    logger.info('Manual payment verification triggered');
    await this.runVerification();
  }
}

// Singleton
const paymentVerificationJob = new PaymentVerificationJob();

module.exports = paymentVerificationJob;

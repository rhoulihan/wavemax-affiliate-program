// Post-weigh payment email dispatchers.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
// ============================================
// V2 Payment System Email Methods
// ============================================

/**
 * Send V2 payment request email after laundry is weighed
 */
exports.sendV2PaymentRequest = async ({ customer, order, paymentAmount, paymentLinks, qrCodes }) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('v2/payment-request', language);

    // If template doesn't exist, load from v2 folder (correct path with emails directory)
    let finalTemplate = template;
    if (template.includes('[EMAIL_CONTENT]')) {
      const v2TemplatePath = path.join(__dirname, '../templates/emails/v2/payment-request.html');
      finalTemplate = await readFile(v2TemplatePath, 'utf8');
    }

    // Calculate breakdown amounts
    const wdfAmount = order.actualWeight * (order.baseRate || 1.25);
    const addOnsAmount = order.addOnTotal || 0;
    const deliveryFee = order.feeBreakdown?.totalFee || 0;
    const totalAmount = paymentAmount || order.paymentAmount || (wdfAmount + addOnsAmount + deliveryFee);

    // Replace template variables (using {{}} syntax for V2 templates)
    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD', ''),
      amount: totalAmount.toFixed(2),
      actualWeight: order.actualWeight,
      numberOfBags: 1, // one bag = one order (redesign)
      pickupDate: new Date(order.intakeAt || order.createdAt || Date.now()).toLocaleDateString(),
      // Breakdown amounts
      wdfAmount: wdfAmount.toFixed(2),
      wdfRate: (order.baseRate || 1.25).toFixed(2),
      addOnsAmount: addOnsAmount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      hasAddOns: addOnsAmount > 0,
      hasDeliveryFee: deliveryFee > 0,
      // Payment links and QR codes
      dashboardLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard&affid=${order.affiliateId}`,
      customerLoginLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-login&affid=${order.affiliateId}`,
      venmoLink: paymentLinks.venmo,
      paypalLink: paymentLinks.paypal,
      cashappLink: paymentLinks.cashapp,
      venmoQR: qrCodes.venmo,
      paypalQR: qrCodes.paypal,
      cashappQR: qrCodes.cashapp
    };

    // Handle conditional sections first
    let html = finalTemplate;

    // Remove or keep add-ons section based on hasAddOns
    if (!emailData.hasAddOns) {
      html = html.replace(/{{#if hasAddOns}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasAddOns}}/g, '').replace(/{{\/if}}/g, '');
    }

    // Remove or keep delivery fee section based on hasDeliveryFee
    if (!emailData.hasDeliveryFee) {
      html = html.replace(/{{#if hasDeliveryFee}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasDeliveryFee}}/g, '').replace(/{{\/if}}/g, '');
    }

    // Replace both {{}} and [] style placeholders
    Object.keys(emailData).forEach(key => {
      const regex = new RegExp(`{{${key}}}|\\[${key}\\]`, 'g');
      html = html.replace(regex, emailData[key]);
    });

    const subject = `Payment Request - Order #${emailData.shortOrderId} - $${emailData.amount}`;

    await sendEmail(customer.email, subject, html);
    logger.info(`V2 payment request sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending V2 payment request email:', error);
    throw error;
  }
};

/**
 * Send V2 payment reminder email
 */
exports.sendV2PaymentReminder = async ({ customer, order, reminderNumber, paymentAmount, paymentLinks, qrCodes, maxReminders }) => {
  try {
    const SystemConfig = require('../../../models/SystemConfig');
    const language = customer.languagePreference || 'en';

    // v2/ templates are language-agnostic; loadTemplate falls back to
    // templates/emails/v2/payment-reminder.html for every language.
    let template = await loadTemplate('v2/payment-reminder', language);

    // Reminder cap comes from SystemConfig (spec §8) unless the caller
    // (paymentVerificationJob) already resolved it.
    const reminderCap = maxReminders || await SystemConfig.getValue('payment_reminder_max_attempts', 8);

    // Calculate breakdown amounts (same as payment request)
    const wdfAmount = order.actualWeight * (order.baseRate || 1.25);
    const addOnsAmount = order.addOnTotal || 0;
    const deliveryFee = order.feeBreakdown?.totalFee || 0;
    const totalAmount = paymentAmount || order.paymentAmount || order.actualTotal || (wdfAmount + addOnsAmount + deliveryFee);

    // Elapsed time only — there is no 24h deadline. The end of the road is
    // the come-to-store notice after the final reminder (spec §6.5).
    const paymentRequestedAt = order.paymentRequestedAt ? new Date(order.paymentRequestedAt) : new Date();
    const now = new Date();
    const hoursElapsed = Math.floor((now - paymentRequestedAt) / (1000 * 60 * 60));

    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD-', '').replace('ORD', ''),
      amount: totalAmount.toFixed(2),
      actualWeight: order.actualWeight,
      numberOfBags: 1, // one bag = one order (redesign)
      // Breakdown amounts
      wdfAmount: wdfAmount.toFixed(2),
      wdfRate: (order.baseRate || 1.25).toFixed(2),
      addOnsAmount: addOnsAmount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      hasAddOns: addOnsAmount > 0,
      hasDeliveryFee: deliveryFee > 0,
      // Reminder specific
      reminderNumber: reminderNumber || 1,
      paymentRequestedTime: paymentRequestedAt.toLocaleString(),
      hoursElapsed: hoursElapsed,
      confirmationLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard&affid=${order.affiliateId}&confirmPayment=${order.orderId}`,
      dashboardLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard&affid=${order.affiliateId}`,
      customerLoginLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-login&affid=${order.affiliateId}`,
      venmoLink: paymentLinks?.venmo || order.paymentLinks?.venmo || '#',
      paypalLink: paymentLinks?.paypal || order.paymentLinks?.paypal || '#',
      cashappLink: paymentLinks?.cashapp || order.paymentLinks?.cashapp || '#',
      venmoQR: qrCodes?.venmo || order.paymentQRCodes?.venmo || '',
      paypalQR: qrCodes?.paypal || order.paymentQRCodes?.paypal || '',
      cashappQR: qrCodes?.cashapp || order.paymentQRCodes?.cashapp || '',
      isUrgent: (reminderNumber || 1) >= reminderCap - 1, // last two reminders are urgent
      maxReminders: reminderCap
    };

    // Handle conditional sections for urgency
    if (emailData.isUrgent) {
      template = template.replace(/{{#if isUrgent}}(.*?){{\/if}}/gs, '$1');
      template = template.replace(/{{#if isUrgent}}(.*?){{else}}(.*?){{\/if}}/gs, '$1');
    } else {
      template = template.replace(/{{#if isUrgent}}(.*?){{\/if}}/gs, '');
      template = template.replace(/{{#if isUrgent}}(.*?){{else}}(.*?){{\/if}}/gs, '$2');
    }

    // Handle conditional sections for add-ons and delivery fee (same as payment request)
    let html = template;

    // Remove or keep add-ons section based on hasAddOns
    if (!emailData.hasAddOns) {
      html = html.replace(/{{#if hasAddOns}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasAddOns}}/g, '').replace(/{{\/if}}/g, '');
    }

    // Remove or keep delivery fee section based on hasDeliveryFee
    if (!emailData.hasDeliveryFee) {
      html = html.replace(/{{#if hasDeliveryFee}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasDeliveryFee}}/g, '').replace(/{{\/if}}/g, '');
    }

    // Replace template variables
    Object.keys(emailData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, emailData[key]);
    });

    const urgencyPrefix = emailData.isUrgent ? 'URGENT: ' : '';
    const subject = `${urgencyPrefix}Payment Reminder - Order #${emailData.shortOrderId} - $${emailData.amount}`;

    await sendEmail(customer.email, subject, html);
    logger.info(`V2 payment reminder sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending V2 payment reminder email:', error);
    throw error;
  }
};

// sendV2PaymentVerified was deleted in PR 9 — dead code: no production call
// site existed (verify paths notify via the ready gate, not a payment email).

/**
 * Send V2 payment timeout escalation to admin
 */
exports.sendV2PaymentTimeoutEscalation = async (order, adminEmail, escalationDetails) => {
  try {
    const subject = `ESCALATION: Payment Timeout - Order #${escalationDetails.orderMongoId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); color: white; padding: 20px; text-align: center;">
          <h1>Payment Timeout Escalation</h1>
          <p>Immediate attention required</p>
        </div>
        <div style="padding: 20px; background: white;">
          <div style="background: #fee2e2; border: 2px solid #fca5a5; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
            <strong>⚠️ URGENT: Payment has not been received after ${escalationDetails.hoursSinceRequest} hours</strong>
          </div>
          
          <h3>Order Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Order ID:</strong></td><td>${escalationDetails.orderId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Customer:</strong></td><td>${escalationDetails.customerName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td>${escalationDetails.customerEmail}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td>${escalationDetails.customerPhone}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Due:</strong></td><td>$${escalationDetails.paymentAmount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payment Requested:</strong></td><td>${new Date(escalationDetails.paymentRequestedAt).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check Attempts:</strong></td><td>${escalationDetails.attemptsMade}</td></tr>
          </table>
          
          <h3>Affiliate Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td>${escalationDetails.affiliateName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td>${escalationDetails.affiliateEmail}</td></tr>
          </table>
          
          <div style="background: #fef2e8; padding: 15px; margin-top: 20px; border-radius: 8px;">
            <strong>Recommended Actions:</strong>
            <ul>
              <li>Contact customer directly at ${escalationDetails.customerPhone}</li>
              <li>Check payment provider accounts for pending transactions</li>
              <li>Consider manual payment verification if customer confirms payment</li>
              <li>Coordinate with affiliate regarding order status</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    await sendEmail(adminEmail, subject, html);
    logger.info(`Payment timeout escalation sent to ${adminEmail} for order ${escalationDetails.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending payment timeout escalation:', error);
    throw error;
  }
};

/**
 * Send V2 pickup ready notification (only after payment verified)
 */
exports.sendV2PickupReadyNotification = async (order, customer, affiliate) => {
  try {
    const subject = `Your Clean Laundry is Ready! - Order #${order.orderId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 20px; text-align: center;">
          <h1>Your Laundry is Ready!</h1>
          <p>Payment verified - Ready for delivery</p>
        </div>
        <div style="padding: 20px; background: white;">
          <p>Hi ${customer.name || customer.firstName},</p>
          
          <p>Great news! Your clean laundry is ready and will be delivered to you soon.</p>
          
          <div style="background: #f0fdf4; border: 2px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <strong>✅ Payment Verified</strong><br>
            <strong>✅ Laundry Processed</strong><br>
            <strong>✅ Ready for Delivery</strong>
          </div>
          
          <h3>Order Details:</h3>
          <ul>
            <li>Order ID: #${order.orderId}</li>
            <li>Number of Bags: ${order.numberOfBags}</li>
            <li>Total Weight: ${order.actualWeight} lbs</li>
            <li>Amount Paid: $${(order.paymentAmount || order.actualTotal).toFixed(2)}</li>
          </ul>
          
          <p>Your affiliate ${affiliate.firstName} ${affiliate.lastName} will deliver your clean laundry to your address soon.</p>
          
          <p>Thank you for using WaveMAX Laundry!</p>
        </div>
      </div>
    `;

    await sendEmail(customer.email, subject, html);
    logger.info(`V2 pickup ready notification sent to ${customer.email} for order ${order.orderId}`);

    // Also notify the affiliate
    const affiliateSubject = `Order Ready for Delivery - #${order.orderId}`;
    const affiliateHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Order Ready for Delivery</h1>
        </div>
        <div style="padding: 20px; background: white;">
          <p>Hi ${affiliate.firstName},</p>
          
          <p>Order #${order.orderId} has been processed and payment has been verified. It's ready for delivery to the customer.</p>
          
          <h3>Delivery Details:</h3>
          <ul>
            <li>Customer: ${customer.name || `${customer.firstName} ${customer.lastName}`}</li>
            <li>Phone: ${customer.phone}</li>
            <li>Address: ${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}</li>
            <li>Number of Bags: ${order.numberOfBags}</li>
          </ul>
          
          <p>Please deliver the clean laundry at your earliest convenience.</p>
        </div>
      </div>
    `;

    await sendEmail(affiliate.email, affiliateSubject, affiliateHtml);

    return true;
  } catch (error) {
    logger.error('Error sending V2 pickup ready notification:', error);
    throw error;
  }
};
/**
 * Send the V2 "come to the store" hold notice (spec §6.5).
 *
 * Fired exactly once, after the final payment reminder. Reuses the stored
 * order state — never regenerates payment links. The template lives in the
 * language-agnostic v2/ directory; loadTemplate() falls back to it for every
 * languagePreference (same convention as v2/payment-request).
 *
 * @param {Object} opts
 * @param {Object} opts.customer - Customer doc (email, names, languagePreference)
 * @param {Object} opts.order    - Order doc (orderId, paymentAmount, actualWeight)
 * @returns {Promise<boolean>} true on send
 */
exports.sendV2ComeToStoreNotice = async ({ customer, order }) => {
  try {
    const SystemConfig = require('../../../models/SystemConfig');
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('v2/come-to-store', language);

    const storeAddress = await SystemConfig.getValue('store_pickup_address', '');
    const amount = (order.paymentAmount || order.actualTotal || 0).toFixed(2);

    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD-', '').replace('ORD', ''),
      amount,
      actualWeight: order.actualWeight,
      storeAddress
    };

    let html = template;
    Object.keys(emailData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, emailData[key]);
    });

    const subject = `Action Needed: Pick Up Your Laundry In Store - Order #${emailData.shortOrderId}`;

    await sendEmail(customer.email, subject, html);
    logger.info(`V2 come-to-store notice sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending V2 come-to-store notice:', error);
    throw error;
  }
};

module.exports = exports;

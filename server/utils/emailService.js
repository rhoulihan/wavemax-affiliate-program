// Email Service for WaveMAX Laundry Affiliate Program
// Handles all email notifications to affiliates and customers

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const AWS = require('aws-sdk');

// Create email transport
const createTransport = () => {
  // Check if using Amazon SES
  if (process.env.EMAIL_PROVIDER === 'ses') {
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    
    // Create SES transporter
    return nodemailer.createTransport({
      SES: new AWS.SES({ apiVersion: '2010-12-01' })
    });
  } else {
    // Use standard SMTP transport for non-SES configuration
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
};

// Load email template
const loadTemplate = async (templateName) => {
  try {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
    const template = await readFile(templatePath, 'utf8');
    return template;
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    // Return a basic template as fallback
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>WaveMAX Laundry</h1>
          </div>
          <div class="content">
            [EMAIL_CONTENT]
          </div>
          <div class="footer">
            &copy; 2025 WaveMAX Laundry. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

// Fill template with data
const fillTemplate = (template, data) => {
  // Use a regex to find all placeholders and replace them in one operation
  return template.replace(/\[([A-Z_]+)\]/g, (match, placeholder) => {
    // First try the exact placeholder (uppercase), then try lowercase
    const upperKey = placeholder;
    const lowerKey = placeholder.toLowerCase();
    
    if (data[upperKey] !== undefined) {
      return data[upperKey];
    } else if (data[lowerKey] !== undefined) {
      return data[lowerKey];
    } else {
      // If not found, return empty string for cleaner emails
      console.warn(`Email template placeholder [${placeholder}] not found in data`);
      return '';
    }
  });
};

// Send email
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransport();
    
    const from = process.env.EMAIL_PROVIDER === 'ses' 
      ? process.env.SES_FROM_EMAIL
      : `"WaveMAX Laundry" <${process.env.EMAIL_USER}>`;
    
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html
    });
    
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// =============================================================================
// Affiliate Emails
// =============================================================================

/**
 * Send welcome email to a new affiliate
 */
exports.sendAffiliateWelcomeEmail = async (affiliate) => {
  try {
    const template = await loadTemplate('affiliate-welcome');
    const registrationUrl = `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/customer-register.html?affiliate=${affiliate.affiliateId}`;
    
    const data = {
      first_name: affiliate.firstName,
      last_name: affiliate.lastName,
      affiliate_id: affiliate.affiliateId,
      registration_url: registrationUrl,
      login_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-login.html`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'Welcome to WaveMAX Laundry Affiliate Program',
      html
    );
  } catch (error) {
    console.error('Error sending affiliate welcome email:', error);
  }
};

/**
 * Send new customer notification to affiliate
 */
exports.sendAffiliateNewCustomerEmail = async (affiliate, customer, bagBarcode) => {
  try {
    const template = await loadTemplate('affiliate-new-customer');
    
    const data = {
      affiliate_first_name: affiliate.firstName,
      customer_first_name: customer.firstName,
      customer_last_name: customer.lastName,
      customer_id: customer.customerId,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      bag_barcode: bagBarcode,
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-dashboard.html?id=${affiliate.affiliateId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'New Customer Registration',
      html
    );
  } catch (error) {
    console.error('Error sending new customer notification email:', error);
  }
};

/**
 * Send new order notification to affiliate
 */
exports.sendAffiliateNewOrderEmail = async (affiliate, customer, order) => {
  try {
    const template = await loadTemplate('affiliate-new-order');
    
    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_phone: customer.phone,
      customer_address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      estimated_size: formatSize(order.estimatedSize),
      special_instructions: order.specialPickupInstructions || 'None',
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-dashboard.html?id=${affiliate.affiliateId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'New Laundry Pickup Order',
      html
    );
  } catch (error) {
    console.error('Error sending new order notification email:', error);
  }
};

/**
 * Send commission notification to affiliate
 */
exports.sendAffiliateCommissionEmail = async (affiliate, order, customer) => {
  try {
    const template = await loadTemplate('affiliate-commission');
    
    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      order_total: order.actualTotal ? `$${order.actualTotal.toFixed(2)}` : 'N/A',
      commission_amount: order.affiliateCommission ? `$${order.affiliateCommission.toFixed(2)}` : 'N/A',
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-dashboard.html?id=${affiliate.affiliateId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'Commission Earned: Order Delivered',
      html
    );
  } catch (error) {
    console.error('Error sending commission notification email:', error);
  }
};

/**
 * Send lost bag notification to affiliate
 */
exports.sendAffiliateLostBagEmail = async (affiliate, customer, bagBarcode) => {
  try {
    const template = await loadTemplate('affiliate-lost-bag');
    
    const data = {
      affiliate_first_name: affiliate.firstName,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_id: customer.customerId,
      customer_email: customer.email,
      customer_phone: customer.phone,
      bag_barcode: bagBarcode,
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-dashboard.html?id=${affiliate.affiliateId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'Customer Reported Lost Laundry Bag',
      html
    );
  } catch (error) {
    console.error('Error sending lost bag notification email:', error);
  }
};

/**
 * Send order cancellation notification to affiliate
 */
exports.sendAffiliateOrderCancellationEmail = async (affiliate, order, customer) => {
  try {
    const template = await loadTemplate('affiliate-order-cancelled');
    
    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      cancellation_time: new Date().toLocaleTimeString(),
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/affiliate-dashboard.html?id=${affiliate.affiliateId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      affiliate.email,
      'Order Cancelled',
      html
    );
  } catch (error) {
    console.error('Error sending order cancellation email:', error);
  }
};

// =============================================================================
// Customer Emails
// =============================================================================

/**
 * Send welcome email to a new customer
 */
exports.sendCustomerWelcomeEmail = async (customer, bagBarcode, affiliate) => {
  try {
    const template = await loadTemplate('customer-welcome');
    
    const data = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      customer_id: customer.customerId,
      affiliate_name: `${affiliate.firstName} ${affiliate.lastName}`,
      affiliate_phone: affiliate.phone,
      affiliate_email: affiliate.email,
      bag_barcode: bagBarcode,
      login_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/customer-login.html`,
      schedule_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/schedule-pickup.html?affiliate=${affiliate.affiliateId}&customer=${customer.customerId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      customer.email,
      'Welcome to WaveMAX Laundry Service',
      html
    );
  } catch (error) {
    console.error('Error sending customer welcome email:', error);
  }
};

/**
 * Send order confirmation email to customer
 */
exports.sendCustomerOrderConfirmationEmail = async (customer, order, affiliate) => {
  try {
    const template = await loadTemplate('customer-order-confirmation');
    
    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      delivery_date: new Date(order.deliveryDate).toLocaleDateString(),
      delivery_time: formatTimeSlot(order.deliveryTime),
      estimated_total: `$${order.estimatedTotal.toFixed(2)}`,
      affiliate_name: `${affiliate.firstName} ${affiliate.lastName}`,
      affiliate_phone: affiliate.phone,
      affiliate_email: affiliate.email,
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/customer-dashboard.html?id=${customer.customerId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      customer.email,
      'Your Laundry Pickup Confirmation',
      html
    );
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

/**
 * Send order status update email to customer
 */
exports.sendOrderStatusUpdateEmail = async (customer, order, status) => {
  try {
    const template = await loadTemplate('customer-order-status');
    
    const statusMessages = {
      picked_up: 'Your laundry has been picked up',
      processing: 'Your laundry is being processed',
      ready_for_delivery: 'Your laundry is ready for delivery',
      delivered: 'Your laundry has been delivered'
    };
    
    const statusTitles = {
      picked_up: 'Laundry Picked Up',
      processing: 'Laundry Processing',
      ready_for_delivery: 'Ready for Delivery',
      delivered: 'Laundry Delivered'
    };
    
    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      status_message: statusMessages[status],
      weight_info: order.actualWeight ? `Your laundry weighs ${order.actualWeight} lbs.` : '',
      total_info: order.actualTotal ? `Final total: $${order.actualTotal.toFixed(2)}` : '',
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/customer-dashboard.html?id=${customer.customerId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      customer.email,
      `Order Update: ${statusTitles[status]}`,
      html
    );
  } catch (error) {
    console.error('Error sending order status update email:', error);
  }
};

/**
 * Send order cancellation email to customer
 */
exports.sendOrderCancellationEmail = async (customer, order) => {
  try {
    const template = await loadTemplate('customer-order-cancelled');
    
    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      cancellation_time: new Date().toLocaleTimeString(),
      dashboard_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/customer-dashboard.html?id=${customer.customerId}`,
      schedule_url: `${process.env.FRONTEND_URL || 'https://wavemaxlaundry.com'}/schedule-pickup.html?customer=${customer.customerId}`,
      current_year: new Date().getFullYear()
    };
    
    const html = fillTemplate(template, data);
    
    await sendEmail(
      customer.email,
      'Your Order Has Been Cancelled',
      html
    );
  } catch (error) {
    console.error('Error sending order cancellation email:', error);
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format time slot for display in emails
 */
const formatTimeSlot = (timeSlot) => {
  switch (timeSlot) {
    case 'morning':
      return 'Morning (8am - 12pm)';
    case 'afternoon':
      return 'Afternoon (12pm - 5pm)';
    case 'evening':
      return 'Evening (5pm - 8pm)';
    default:
      return timeSlot;
  }
};

/**
 * Format size for display in emails
 */
const formatSize = (size) => {
  switch (size) {
    case 'small':
      return 'Small (10-15 lbs)';
    case 'medium':
      return 'Medium (16-30 lbs)';
    case 'large':
      return 'Large (31+ lbs)';
    default:
      return size;
  }
};

module.exports = exports;
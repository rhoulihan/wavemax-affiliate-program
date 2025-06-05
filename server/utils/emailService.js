// Email Service for WaveMAX Laundry Affiliate Program
// Handles all email notifications to affiliates and customers

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const { SESClient } = require('@aws-sdk/client-ses');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');

// Create email transport
const createTransport = () => {
  // Check if using console (for development/testing)
  if (process.env.EMAIL_PROVIDER === 'console') {
    // Return a mock transport that logs to console
    return {
      sendMail: async (mailOptions) => {
        console.log('=== EMAIL CONSOLE LOG ===');
        console.log('From:', mailOptions.from);
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('HTML Preview: [HTML content logged to console]');
        console.log('========================');
        return { messageId: `console-${Date.now()}` };
      }
    };
  }
  // Check if using Amazon SES
  else if (process.env.EMAIL_PROVIDER === 'ses') {
    // Create SES client with v3 SDK
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: defaultProvider()
    });

    // Create SES transporter
    return nodemailer.createTransport({
      SES: { ses: sesClient, aws: require('@aws-sdk/client-ses') }
    });
  }
  // Check if using MS Exchange Server
  else if (process.env.EMAIL_PROVIDER === 'exchange') {
    return nodemailer.createTransport({
      host: process.env.EXCHANGE_HOST,
      port: parseInt(process.env.EXCHANGE_PORT) || 587,
      secure: process.env.EXCHANGE_PORT === '465',
      auth: {
        user: process.env.EXCHANGE_USER,
        pass: process.env.EXCHANGE_PASS
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: process.env.EXCHANGE_REJECT_UNAUTHORIZED !== 'false'
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
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
            &copy; 2025 CRHS Enterprises, LLC. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

// Fill template with data
const fillTemplate = (template, data) => {
  // Add BASE_URL to all template data
  const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';
  data.BASE_URL = baseUrl;
  
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
      : process.env.EMAIL_PROVIDER === 'console'
        ? process.env.EMAIL_FROM || 'noreply@wavemax.promo'
        : process.env.EMAIL_PROVIDER === 'exchange'
          ? process.env.EXCHANGE_FROM_EMAIL || process.env.EXCHANGE_USER
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
    const registrationUrl = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliate.affiliateId}`;
    const landingPageUrl = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-landing&code=${affiliate.affiliateId}`;

    const data = {
      first_name: affiliate.firstName,
      last_name: affiliate.lastName,
      affiliate_id: affiliate.affiliateId,
      registration_url: registrationUrl,
      landing_page_url: landingPageUrl,
      login_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate`,
      dashboard_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate`,
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
exports.sendAffiliateNewCustomerEmail = async (affiliate, customer, bagInfo = {}) => {
  try {
    const template = await loadTemplate('affiliate-new-customer');

    const numberOfBags = bagInfo.numberOfBags || 1;

    const data = {
      affiliate_first_name: affiliate.firstName,
      affiliate_name: affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`,
      customer_first_name: customer.firstName,
      customer_last_name: customer.lastName,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_id: customer.customerId,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      service_frequency: customer.serviceFrequency,
      number_of_bags: numberOfBags,
      dashboard_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate&customer=${customer.customerId}`,
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
      estimated_weight: order.estimatedWeight ? `${order.estimatedWeight} lbs` : 'To be determined',
      number_of_bags: order.numberOfBags || 1,
      special_instructions: order.specialPickupInstructions || 'None',
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
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
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
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
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
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

/**
 * Send password reset email to affiliate
 */
exports.sendAffiliatePasswordResetEmail = async (affiliate, resetUrl) => {
  try {
    const template = await loadTemplate('affiliate-password-reset');

    const data = {
      first_name: affiliate.firstName,
      affiliate_id: affiliate.affiliateId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      affiliate.email,
      'Password Reset Request - WaveMAX Affiliate Portal',
      html
    );
  } catch (error) {
    console.error('Error sending affiliate password reset email:', error);
  }
};

// =============================================================================
// Customer Emails
// =============================================================================

/**
 * Send welcome email to a new customer
 */
exports.sendCustomerWelcomeEmail = async (customer, affiliate, bagInfo = {}) => {
  try {
    // Validate inputs
    if (!customer || !affiliate) {
      console.error('Missing customer or affiliate data for welcome email');
      return;
    }

    const template = await loadTemplate('customer-welcome');

    // Build affiliate name with fallback
    const affiliateName = affiliate.businessName || 
      `${affiliate.firstName || ''} ${affiliate.lastName || ''}`.trim() || 
      'Your WaveMAX Partner';

    // Extract bag information with defaults
    const numberOfBags = bagInfo.numberOfBags || 1;
    const bagFee = bagInfo.bagFee || 10.00;
    const totalCredit = bagInfo.totalCredit || (numberOfBags * bagFee);

    const data = {
      first_name: customer.firstName || '',
      last_name: customer.lastName || '',
      customer_id: customer.customerId || '',
      affiliate_name: affiliateName,
      affiliate_phone: affiliate.phone || 'Contact for details',
      affiliate_email: affiliate.email || 'support@wavemax.promo',
      number_of_bags: numberOfBags,
      bag_fee: bagFee.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      login_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer`,
      schedule_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer&pickup=true`,
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      customer.email,
      'Welcome to WaveMAX Laundry Service',
      html
    );
    
    console.log('Customer welcome email sent successfully to:', customer.email);
  } catch (error) {
    console.error('Error sending customer welcome email:', error);
    throw error; // Re-throw to let the controller handle it
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
      login_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer`,
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
      dashboard_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer`,
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
      dashboard_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer`,
      schedule_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer&pickup=true`,
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

/**
 * Send password reset email to customer
 */
exports.sendCustomerPasswordResetEmail = async (customer, resetUrl) => {
  try {
    const template = await loadTemplate('customer-password-reset');

    const data = {
      first_name: customer.firstName,
      customer_id: customer.customerId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      customer.email,
      'Password Reset Request - WaveMAX Customer Portal',
      html
    );
  } catch (error) {
    console.error('Error sending customer password reset email:', error);
  }
};

// =============================================================================
// Administrator Emails
// =============================================================================

/**
 * Send welcome email to a new administrator
 */
exports.sendAdministratorWelcomeEmail = async (administrator) => {
  try {
    const template = await loadTemplate('administrator-welcome');

    const data = {
      FIRST_NAME: administrator.firstName,
      LAST_NAME: administrator.lastName,
      ADMIN_ID: administrator.adminId,
      EMAIL: administrator.email,
      LOGIN_URL: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app.html?login=admin`,
      PERMISSIONS: administrator.permissions.join(', '),
      CURRENT_YEAR: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      administrator.email,
      'Welcome to WaveMAX Administrator Portal',
      html
    );
  } catch (error) {
    console.error('Error sending administrator welcome email:', error);
  }
};

/**
 * Send password reset email to administrator
 */
exports.sendAdministratorPasswordResetEmail = async (administrator, resetUrl) => {
  try {
    const template = await loadTemplate('administrator-password-reset');

    const data = {
      first_name: administrator.firstName,
      admin_id: administrator.adminId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      administrator.email,
      'Password Reset Request - WaveMAX Administrator Portal',
      html
    );
  } catch (error) {
    console.error('Error sending administrator password reset email:', error);
  }
};

// =============================================================================
// Operator Emails
// =============================================================================

/**
 * Send welcome email to a new operator
 */
exports.sendOperatorWelcomeEmail = async (operator, temporaryPin) => {
  try {
    const template = await loadTemplate('operator-welcome');

    const data = {
      first_name: operator.firstName,
      last_name: operator.lastName,
      employee_id: operator.employeeId,
      email: operator.email,
      temporary_pin: temporaryPin,
      shift_hours: `${operator.shiftStart} - ${operator.shiftEnd}`,
      specializations: operator.specializations.join(', '),
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app.html?login=operator`,
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      operator.email,
      'Welcome to WaveMAX Operations Team',
      html
    );
  } catch (error) {
    console.error('Error sending operator welcome email:', error);
  }
};

/**
 * Send PIN reset email to operator
 */
exports.sendOperatorPinResetEmail = async (operator, newPin) => {
  try {
    const template = await loadTemplate('operator-pin-reset');

    const data = {
      first_name: operator.firstName,
      employee_id: operator.employeeId,
      new_pin: newPin,
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app.html?login=operator`,
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      operator.email,
      'Your PIN Has Been Reset',
      html
    );
  } catch (error) {
    console.error('Error sending operator PIN reset email:', error);
  }
};

/**
 * Send shift reminder email to operator
 */
exports.sendOperatorShiftReminderEmail = async (operator) => {
  try {
    const template = await loadTemplate('operator-shift-reminder');

    const data = {
      first_name: operator.firstName,
      employee_id: operator.employeeId,
      shift_start: operator.shiftStart,
      shift_end: operator.shiftEnd,
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app.html?login=operator`,
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      operator.email,
      'Shift Reminder - Starting Soon',
      html
    );
  } catch (error) {
    console.error('Error sending operator shift reminder email:', error);
  }
};

/**
 * Note: sendOperatorPasswordResetEmail is not needed since operators use PINs
 */
exports.sendOperatorPasswordResetEmail = async (operator, resetUrl) => {
  // Operators don't have passwords, they use PINs
  // This method is here for interface compatibility but should not be called
  console.error('Operators use PINs, not passwords. Use sendOperatorPinResetEmail instead.');
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
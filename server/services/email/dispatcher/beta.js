// Beta program + marketing email dispatchers + generic admin notifier.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
/**
 * Send notification to admin
 * @param {Object} options - Email options
 * @param {String} options.subject - Email subject
 * @param {String} options.html - HTML content
 * @param {String} options.priority - Email priority (high, normal, low)
 * @returns {Promise<Boolean>}
 */
exports.sendAdminNotification = async function(options) {
  try {
    const { subject, html, priority = 'normal' } = options;
    
    // Get admin email from SystemConfig or use default
    const SystemConfig = require('../models/SystemConfig');
    let adminEmail = await SystemConfig.getValue('admin_notification_email', null);
    
    if (!adminEmail) {
      // Fallback to environment variable or default
      adminEmail = process.env.ADMIN_EMAIL || 'admin@wavemaxlaundry.com';
    }
    
    // Add priority header if high priority
    const headers = priority === 'high' ? {
      'X-Priority': '1',
      'Importance': 'high'
    } : {};
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h3 { color: #34495e; margin-top: 20px; }
            ul { background: #f4f4f4; padding: 15px; border-radius: 5px; }
            li { margin: 5px 0; }
            .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .error { background: #f8d7da; border: 1px solid #dc3545; }
            hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    
    await sendEmail(adminEmail, subject, fullHtml, headers);
    
    logger.info(`Admin notification sent: ${subject}`);
    return true;
  } catch (error) {
    logger.error('Error sending admin notification:', error);
    throw error;
  }
};

/**
 * Send beta request notification to admin
 */
exports.sendBetaRequestNotification = async (betaRequest) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.DEFAULT_ADMIN_EMAIL || 'admin@wavemax.promo';
    
    const subject = 'New Affiliate Beta Request Received';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .info-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #1e3a8a; margin: 20px 0; }
          .field { margin: 10px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; margin-left: 10px; }
          .message-box { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; background: #1e3a8a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Beta Request</h1>
          </div>
          <div class="content">
            <p>A new affiliate has requested to join the beta program:</p>
            
            <div class="info-box">
              <h3>Contact Information</h3>
              <div class="field">
                <span class="label">Name:</span>
                <span class="value">${betaRequest.firstName} ${betaRequest.lastName}</span>
              </div>
              <div class="field">
                <span class="label">Email:</span>
                <span class="value">${betaRequest.email}</span>
              </div>
              <div class="field">
                <span class="label">Phone:</span>
                <span class="value">${betaRequest.phone}</span>
              </div>
              ${betaRequest.businessName ? `
              <div class="field">
                <span class="label">Business Name:</span>
                <span class="value">${betaRequest.businessName}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="info-box">
              <h3>Address</h3>
              <div class="field">
                <span class="value">${betaRequest.address}<br>
                ${betaRequest.city}, ${betaRequest.state} ${betaRequest.zipCode}</span>
              </div>
            </div>
            
            ${betaRequest.message ? `
            <div class="message-box">
              <h3>Their Message</h3>
              <p>${betaRequest.message}</p>
            </div>
            ` : ''}
            
            <p>Submitted on: ${new Date(betaRequest.createdAt).toLocaleString()}</p>
            
            <center>
              <a href="https://wavemax.promo/embed-app-v2.html?route=/administrator-dashboard&section=beta-requests" class="button">
                View in Admin Dashboard
              </a>
            </center>
          </div>
          <div class="footer">
            <p>This is an automated notification from the WaveMAX Affiliate Program</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(adminEmail, subject, html);
    logger.info('Beta request notification sent to admin:', adminEmail);
  } catch (error) {
    logger.error('Error sending beta request notification:', error);
    // Don't throw - we don't want to fail the request if email fails
  }
};

/**
 * Send beta invitation email
 */
exports.sendBetaInvitationEmail = async (betaRequest, registrationUrl) => {
  try {
    const subject = 'Welcome to WaveMAX Affiliate Beta Program!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #1e3a8a; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 16px; }
          .highlight { background: #f0f7ff; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Approved for Beta!</h1>
          </div>
          <div class="content">
            <p>Dear ${betaRequest.firstName},</p>
            
            <p>Congratulations! You've been selected to join the WaveMAX Affiliate Beta Program. We're excited to have you as one of our founding partners.</p>
            
            <div class="highlight">
              <h3>What's Next?</h3>
              <p>Click the button below to complete your affiliate registration. This exclusive link is just for you and will expire in 7 days.</p>
              
              <center>
                <a href="${registrationUrl}" class="button">Complete Your Registration</a>
              </center>
            </div>
            
            <h3>Beta Program Benefits:</h3>
            <ul>
              <li>Be among the first affiliates in your area</li>
              <li>10% commission on all customer orders</li>
              <li>Set your own delivery fees</li>
              <li>Full dashboard access to track earnings</li>
              <li>Direct support from our team</li>
            </ul>
            
            <p>If you have any questions, feel free to reply to this email. We're here to help you succeed!</p>
            
            <p>Welcome to the team!</p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
          </div>
          <div class="footer">
            <p>This invitation link is unique to you. Please do not share it with others.</p>
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(betaRequest.email, subject, html);
    logger.info('Beta invitation sent to:', betaRequest.email);
  } catch (error) {
    logger.error('Error sending beta invitation:', error);
    throw error;
  }
};

/**
 * Send welcome email to beta request
 */
exports.sendBetaWelcomeEmail = async (betaRequest) => {
  try {
    const registrationUrl = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-register';
    const subject = 'Welcome to WaveMAX Affiliate Program Beta!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 10px 10px 0 0; }
          .logo { max-width: 200px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.wavemaxlaundry.com/assets/WaveMax/images/logo-wavemax.png" alt="WaveMAX Laundry" class="logo">
            <h1>Welcome to Our Beta Program!</h1>
          </div>
          <div class="content">
            <p>Dear ${betaRequest.firstName},</p>
            
            <p>Thank you for your interest in becoming a WaveMAX affiliate! We're excited to welcome you to our exclusive beta program.</p>
            
            <div class="highlight">
              <h3>Ready to Get Started?</h3>
              <p>Click the button below to complete your affiliate registration and start earning:</p>
              
              <center>
                <a href="${registrationUrl}" class="button">Complete Registration</a>
              </center>
            </div>
            
            <h3>What You Can Expect:</h3>
            <ul>
              <li><strong>10% Commission</strong> on all customer orders</li>
              <li><strong>Set Your Own Delivery Fees</strong> to maximize earnings</li>
              <li><strong>Real-time Dashboard</strong> to track your performance</li>
              <li><strong>Direct Support</strong> from our team</li>
              <li><strong>No Hidden Fees</strong> - keep what you earn</li>
            </ul>
            
            <p>If you have any questions during registration or need assistance, please don't hesitate to reach out to us.</p>
            
            <p>We look forward to having you as part of the WaveMAX family!</p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Don't use attachments as they're blocked by the mail server policy
    await sendEmail(betaRequest.email, subject, html);
    logger.info('Beta welcome email sent to:', betaRequest.email);
  } catch (error) {
    logger.error('Error sending beta welcome email:', error);
    throw error;
  }
};

/**
 * Send reminder email to beta request user who hasn't registered
 */
exports.sendBetaReminderEmail = async (betaRequest) => {
  try {
    const registrationUrl = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-register';
    const subject = 'Don\'t Miss Out - Your WaveMAX Affiliate Opportunity Awaits!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 10px 10px 0 0; }
          .logo { max-width: 200px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 14px 35px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          .benefit-box { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .check-mark { color: #10b981; font-weight: bold; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.wavemaxlaundry.com/assets/WaveMax/images/logo-wavemax.png" alt="WaveMAX Laundry" class="logo">
            <h1>Your Business Opportunity is Still Waiting!</h1>
          </div>
          <div class="content">
            <p>Hi ${betaRequest.firstName},</p>
            
            <p>We noticed you haven't completed your WaveMAX Affiliate registration yet. Don't let this incredible opportunity pass you by!</p>
            
            <div class="benefit-box">
              <h3 style="color: #dc2626; margin-top: 0;">🚀 No Barriers to Entry!</h3>
              <p style="margin: 10px 0;"><span class="check-mark">✓</span> <strong>NO upfront costs</strong></p>
              <p style="margin: 10px 0;"><span class="check-mark">✓</span> <strong>NO subscription fees</strong></p>
              <p style="margin: 10px 0;"><span class="check-mark">✓</span> <strong>NO premium charges</strong></p>
              <p style="margin-bottom: 0;">Just pure opportunity to build YOUR business!</p>
            </div>
            
            <h3>Build a REAL Business, Not Just a Side Gig</h3>
            <p>Unlike driving for Uber or Lyft where you're just another contractor, as a WaveMAX Affiliate you're building YOUR own business. The fees that would normally go to gig economy platforms go directly to YOU!</p>
            
            <div class="highlight">
              <h3>Market to Multiple Revenue Streams:</h3>
              <ul style="margin: 10px 0;">
                <li><strong>Hotels & Hospitality</strong> - Become their go-to laundry service</li>
                <li><strong>Apartment Managers</strong> - Service entire communities</li>
                <li><strong>Senior Service Centers</strong> - Help those who need it most</li>
                <li><strong>Private Individuals</strong> - Build your personal client base</li>
              </ul>
            </div>
            
            <p><strong>The income opportunity is literally as large as you can make it!</strong> As a WaveMAX Affiliate you could earn as much as $5K per month or even more. The more customers you find, the more commissions and delivery fees you will earn. This is a real opportunity to build sustainable, recurring income.</p>
            
            <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2e7d32; margin-top: 0;">📊 Income Calculator: Path to $5,000/Month</h3>
              <p style="font-weight: bold; color: #1b5e20;">Here's how achievable $5K per month really is:</p>
              
              <table style="width: 100%; background: white; border-collapse: collapse; border-radius: 4px; overflow: hidden;">
                <tr style="background: #4caf50; color: white;">
                  <th style="padding: 10px; text-align: left;">Weekly Service Details</th>
                  <th style="padding: 10px; text-align: right;">Per Customer</th>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">Average order (30 lbs @ $1.25/lb)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">$37.50</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">Your 10% commission</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; color: #4caf50; font-weight: bold;">$3.75</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">Your delivery fee (100% yours!)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; color: #4caf50; font-weight: bold;">$20.00</td>
                </tr>
                <tr style="background: #f5f5f5;">
                  <td style="padding: 10px; font-weight: bold;">Weekly earnings per customer</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold; color: #2e7d32;">$23.75</td>
                </tr>
              </table>
              
              <table style="width: 100%; background: white; border-collapse: collapse; border-radius: 4px; overflow: hidden; margin-top: 15px;">
                <tr style="background: #ff9800; color: white;">
                  <th colspan="2" style="padding: 10px; text-align: center;">Monthly Earnings Breakdown</th>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">Per customer per month (4.3 weeks)</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">$102.13</td>
                </tr>
                <tr style="background: #fff3e0;">
                  <td style="padding: 10px; font-weight: bold; color: #e65100;">Customers needed for $5,000/month:</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 1.2em; color: #e65100;">49 customers</td>
                </tr>
              </table>
              
              <p style="margin-top: 15px; padding: 10px; background: #fffde7; border-left: 4px solid #ffc107; margin-bottom: 0;">
                <strong>💡 Think about it:</strong> Just 49 weekly customers = $5,000/month<br>
                • That's less than 2 new customers per business day for a month<br>
                • One apartment complex could have 20+ customers<br>
                • One senior center could provide 15+ customers<br>
                • The earning potential is unlimited - 100 customers = $10,000+/month!
              </p>
            </div>
            
            <h3>Why WaveMAX?</h3>
            <ul>
              <li>Professional laundry processing handled for you</li>
              <li>Real-time tracking and customer management tools</li>
              <li>10% commission on every order</li>
              <li>Set your own delivery fees (keep 100%!)</li>
              <li>Full training and support provided</li>
            </ul>
            
            <center>
              <a href="${registrationUrl}" class="button">Complete Your Registration Now →</a>
            </center>
            
            <p style="text-align: center; color: #6b7280; font-style: italic;">
              Don't let someone else claim your territory. Secure your spot today!
            </p>
            
            <p>Questions? We're here to help! Simply reply to this email or complete your registration and we'll guide you every step of the way.</p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              P.S. - Remember, there's absolutely no financial risk. WaveMAX provides everything you need to be successful.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
            <p>You received this email because you expressed interest in the WaveMAX Affiliate Program.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(betaRequest.email, subject, html);
    logger.info('Beta reminder email sent to:', betaRequest.email);
  } catch (error) {
    logger.error('Error sending beta reminder email:', error);
    throw error;
  }
};

/**
 * Send marketing email
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} recipientName - Recipient's name
 * @param {string} templateType - Type of marketing email (e.g., 'healthcare-catering-outreach')
 */
exports.sendMarketingEmail = async (recipientEmail, recipientName, templateType = 'healthcare-catering-outreach') => {
  try {
    logger.info(`[sendMarketingEmail] Sending ${templateType} email to:`, recipientEmail);

    if (!recipientEmail) {
      throw new Error('Recipient email address is required');
    }

    if (!recipientName) {
      throw new Error('Recipient name is required');
    }

    // Load the marketing email template
    const templatePath = path.join(__dirname, '../templates/emails/marketing', `${templateType}.html`);
    let template;

    try {
      template = await fs.promises.readFile(templatePath, 'utf8');
    } catch (error) {
      logger.error(`Error loading marketing template ${templateType}:`, error);
      throw new Error(`Marketing template '${templateType}' not found`);
    }

    // Fill in template variables
    const data = {
      recipientName: recipientName
    };

    const html = fillTemplate(template, data);

    // Subject line based on template type
    const subjects = {
      'healthcare-catering-outreach': 'Hospital-Quality Laundry Service for Your Business - WaveMAX Laundry'
    };

    const subject = subjects[templateType] || 'WaveMAX Laundry Services';

    // Send the email
    await sendEmail(recipientEmail, subject, html);

    logger.info(`Marketing email (${templateType}) sent successfully to:`, recipientEmail);
    return {
      success: true,
      recipient: recipientEmail,
      templateType: templateType
    };
  } catch (error) {
    logger.error('Error sending marketing email:', error);
    throw error;
  }
};

module.exports = exports;

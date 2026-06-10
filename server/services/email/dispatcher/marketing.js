// Marketing email dispatcher. Extracted from dispatcher/beta.js when the
// beta program was removed (PR 2) — marketing outreach is not a beta concern.

const { fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

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
    const templatePath = path.join(__dirname, '../../../templates/emails/marketing', `${templateType}.html`);
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

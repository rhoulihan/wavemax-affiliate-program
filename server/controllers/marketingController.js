/**
 * Marketing Email Controller
 * Handles sending marketing emails to potential customers
 */

const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

// Available marketing email templates
const MARKETING_TEMPLATES = [
  {
    id: 'healthcare-catering-outreach',
    name: 'Healthcare & Catering Outreach',
    description: 'Professional outreach for healthcare facilities, nursing homes, caregivers, and catering businesses. Emphasizes hospital-quality sanitation with Omni LUX UV water purification and convenient pickup/delivery service.',
    targetAudience: ['Healthcare facilities', 'Nursing homes', 'Caregivers', 'Caterers', 'Food service businesses']
  }
];

/**
 * Get list of available marketing email templates
 */
exports.getTemplates = async (req, res) => {
  try {
    res.json({
      success: true,
      templates: MARKETING_TEMPLATES
    });
  } catch (error) {
    logger.error('Error fetching marketing templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketing templates'
    });
  }
};

/**
 * Send marketing email
 */
exports.sendMarketingEmail = async (req, res) => {
  try {
    const { recipientEmail, recipientName, templateType } = req.body;

    // Validation
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'recipientEmail is required'
      });
    }

    if (!recipientName) {
      return res.status(400).json({
        success: false,
        error: 'recipientName is required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Template validation
    const template = templateType || 'healthcare-catering-outreach';
    const templateExists = MARKETING_TEMPLATES.some(t => t.id === template);

    if (!templateExists) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template type. Please choose from available templates.'
      });
    }

    // Log admin action
    logger.info(`Admin ${req.user?.email} sending marketing email to ${recipientEmail} using template ${template}`);

    // Send the email
    const result = await emailService.sendMarketingEmail(
      recipientEmail,
      recipientName,
      template
    );

    res.json({
      success: true,
      message: 'Marketing email sent successfully',
      recipient: result.recipient,
      templateType: result.templateType
    });

  } catch (error) {
    logger.error('Error sending marketing email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send marketing email. Please try again.'
    });
  }
};

// Export template constants for use in other modules
exports.MARKETING_TEMPLATES = MARKETING_TEMPLATES;

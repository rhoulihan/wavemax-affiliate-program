// Email transport
//
// Mailcow SMTP adapter, with a console transport for development/testing.
// Extracted from utils/emailService.js in Phase 2.

const nodemailer = require('nodemailer');

/**
 * Create the underlying mailer. Returns either a console-logging stub
 * (EMAIL_PROVIDER=console) or a configured nodemailer transport.
 */
function createTransport() {
  if (process.env.EMAIL_PROVIDER === 'console') {
    return {
      sendMail: async (mailOptions) => {
        console.log('=== EMAIL CONSOLE LOG ===');
        console.log('From:', mailOptions.from);
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('HTML:', mailOptions.html);
        console.log('=========================');
        return { messageId: 'console-message-id' };
      }
    };
  }

  const transportConfig = {
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  };

  // When connecting by IP, still tell TLS which hostname to validate against
  if (process.env.EMAIL_HOST && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(process.env.EMAIL_HOST)) {
    transportConfig.tls.servername = 'mail.wavemax.promo';
  }

  return nodemailer.createTransport(transportConfig);
}

/**
 * Send an HTML email to `to`.
 * Attachments are not supported — upstream mail policy blocks them; images
 * must be referenced by URL.
 */
async function sendEmail(to, subject, html) {
  if (!to) {
    throw new Error('No recipient email address provided');
  }

  console.log('[sendEmail] Sending email to:', to);
  const transporter = createTransport();

  const from = `"WaveMAX Laundry" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@wavemax.promo'}>`;
  const mailOptions = { from, to, subject, html };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = { createTransport, sendEmail };

#!/usr/bin/env node

/**
 * Test script for Brevo email integration
 * Usage: node scripts/test-brevo-email.js [recipient-email]
 */

require('dotenv').config();

// Temporarily set EMAIL_PROVIDER to brevo for this test
const originalProvider = process.env.EMAIL_PROVIDER;
process.env.EMAIL_PROVIDER = 'brevo';

const emailService = require('../server/utils/emailService');

async function testBrevoEmail() {
  const recipientEmail = process.argv[2] || 'test@example.com';

  console.log('Testing Brevo Email Integration...');
  console.log('================================');
  console.log('Provider:', process.env.EMAIL_PROVIDER);
  console.log('API Key:', process.env.BREVO_API_KEY ? '✓ Configured' : '✗ Not configured');
  console.log('From Email:', process.env.BREVO_FROM_EMAIL || 'Not set');
  console.log('From Name:', process.env.BREVO_FROM_NAME || 'Not set');
  console.log('Recipient:', recipientEmail);
  console.log('================================\n');

  if (!process.env.BREVO_API_KEY) {
    console.error('Error: BREVO_API_KEY not configured in .env file');
    console.log('\nTo use Brevo, add the following to your .env file:');
    console.log('EMAIL_PROVIDER=brevo');
    console.log('BREVO_API_KEY=your-api-key-here');
    console.log('BREVO_FROM_EMAIL=noreply@yourdomain.com');
    console.log('BREVO_FROM_NAME=Your Company Name');
    process.exit(1);
  }

  try {
    // Test affiliate object
    const testAffiliate = {
      firstName: 'Test',
      lastName: 'User',
      email: recipientEmail,
      affiliateId: 'TEST123',
      phone: '555-1234',
      languagePreference: 'en'
    };

    console.log('Sending test email via Brevo...');
    const result = await emailService.sendAffiliateWelcomeEmail(testAffiliate);

    console.log('\n✓ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\nCheck the recipient\'s inbox to verify delivery.');

  } catch (error) {
    console.error('\n✗ Error sending email:');
    console.error(error.message);

    if (error.response) {
      console.error('\nBrevo API Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    console.log('\nTroubleshooting tips:');
    console.log('1. Verify your Brevo API key is correct');
    console.log('2. Ensure the sender email is verified in Brevo');
    console.log('3. Check that the API key has "Send emails" permission');
    console.log('4. Visit https://app.brevo.com to check your account status');
  } finally {
    // Restore original provider
    process.env.EMAIL_PROVIDER = originalProvider;
  }
}

// Run the test
testBrevoEmail().catch(console.error);
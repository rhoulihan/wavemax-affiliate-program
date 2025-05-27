#!/usr/bin/env node
require('dotenv').config();
const emailService = require('./server/utils/emailService');

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('Email Provider:', process.env.EMAIL_PROVIDER);
  
  if (process.env.EMAIL_PROVIDER === 'exchange') {
    console.log('Exchange Host:', process.env.EXCHANGE_HOST);
    console.log('Exchange Port:', process.env.EXCHANGE_PORT);
    console.log('Exchange User:', process.env.EXCHANGE_USER);
    console.log('Exchange From:', process.env.EXCHANGE_FROM_EMAIL);
  }
  
  try {
    // Test with a simple email
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const result = await emailService.sendEmail(
      testEmail,
      'Test Email from WaveMAX',
      '<h1>Test Email</h1><p>This is a test email to verify the email configuration is working correctly.</p>'
    );
    
    console.log('Email sent successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

testEmail();
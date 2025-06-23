#!/usr/bin/env node

// Test email script
require('dotenv').config();
const emailService = require('../server/utils/emailService');

async function sendTestEmail() {
  console.log('Sending test email...\n');
  
  const testEmail = {
    to: 'rickh@wavemaxlaundry.com',
    subject: 'Test Email - WaveMAX Monitoring System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">WaveMAX System Test Email</h2>
        </div>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 0 0 8px 8px; padding: 20px;">
          <h3>Email Service Test Successful</h3>
          
          <p>This is a test email from the WaveMAX Affiliate Program system to verify that the email service is working correctly.</p>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>✅ Email Configuration:</strong></p>
            <ul style="margin: 10px 0 0 20px;">
              <li>Provider: ${process.env.EMAIL_PROVIDER || 'Not configured'}</li>
              <li>Host: ${process.env.EMAIL_HOST || 'Not configured'}</li>
              <li>From: ${process.env.EMAIL_FROM || 'Not configured'}</li>
              <li>Timestamp: ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          
          <h4>Monitoring System Status:</h4>
          <p>The connectivity monitoring system has been successfully implemented with the following features:</p>
          <ul>
            <li>Real-time monitoring of all external services</li>
            <li>Web dashboard at: <a href="https://wavemax.promo/monitoring-dashboard.html">https://wavemax.promo/monitoring-dashboard.html</a></li>
            <li>Automatic email alerts for critical service failures</li>
            <li>Historical tracking and availability metrics</li>
          </ul>
          
          <p style="margin-top: 20px;">
            <a href="https://wavemax.promo/monitoring-dashboard.html" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Monitoring Dashboard</a>
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            This is an automated test email sent on ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `,
    text: `
WaveMAX System Test Email

Email Service Test Successful

This is a test email from the WaveMAX Affiliate Program system to verify that the email service is working correctly.

Email Configuration:
- Provider: ${process.env.EMAIL_PROVIDER || 'Not configured'}
- Host: ${process.env.EMAIL_HOST || 'Not configured'}
- From: ${process.env.EMAIL_FROM || 'Not configured'}
- Timestamp: ${new Date().toLocaleString()}

Monitoring System Status:
The connectivity monitoring system has been successfully implemented with the following features:
- Real-time monitoring of all external services
- Web dashboard at: https://wavemax.promo/monitoring-dashboard.html
- Automatic email alerts for critical service failures
- Historical tracking and availability metrics

View Monitoring Dashboard: https://wavemax.promo/monitoring-dashboard.html

This is an automated test email sent on ${new Date().toISOString()}
    `
  };

  try {
    // Use the sendEmail function
    const result = await emailService.sendEmail(testEmail.to, testEmail.subject, testEmail.html);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId || 'Not available');
    console.log('\nEmail details:');
    console.log('- To:', testEmail.to);
    console.log('- Subject:', testEmail.subject);
    console.log('- Provider:', process.env.EMAIL_PROVIDER);
    console.log('- From:', process.env.EMAIL_FROM);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    console.error('\nError details:', error);
    
    // Check email configuration
    console.log('\nCurrent email configuration:');
    console.log('- EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'Not set');
    console.log('- EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
    console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
    console.log('- EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
    console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
  }
}

// Run the test
sendTestEmail();
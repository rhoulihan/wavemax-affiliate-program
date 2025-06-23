#!/usr/bin/env node

// Test script for Mailcow email configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConfiguration() {
  console.log('Testing Mailcow email configuration...\n');
  
  // Display current configuration
  console.log('Current Email Configuration:');
  console.log(`- Provider: ${process.env.EMAIL_PROVIDER}`);
  console.log(`- Host: ${process.env.EMAIL_HOST}`);
  console.log(`- Port: ${process.env.EMAIL_PORT}`);
  console.log(`- User: ${process.env.EMAIL_USER}`);
  console.log(`- From: ${process.env.EMAIL_FROM}\n`);
  
  try {
    // Create transport directly to test configuration
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    // Send a test email
    const testEmail = 'admin@wavemax.promo'; // Change this to your test email
    
    console.log(`Sending test email to: ${testEmail}`);
    
    const mailOptions = {
      from: `"WaveMAX Laundry" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Test Email from WaveMAX - Mailcow Configuration',
      html: `
        <h2>Test Email Successful!</h2>
        <p>This email confirms that your Mailcow mail server is properly configured with the WaveMAX application.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Mail Server: ${process.env.EMAIL_HOST}</li>
          <li>Port: ${process.env.EMAIL_PORT}</li>
          <li>From Address: ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
        </ul>
        <p>Time sent: ${new Date().toLocaleString()}</p>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log('\n✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    console.log('Accepted:', result.accepted);
    
  } catch (error) {
    console.error('\n❌ Email send failed!');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nConnection refused. Please check:');
      console.error('1. Mailcow is running (docker ps)');
      console.error('2. Mail server hostname is correct');
      console.error('3. Port 587 is accessible');
    } else if (error.code === 'EAUTH') {
      console.error('\nAuthentication failed. Please check:');
      console.error('1. Email username and password are correct');
      console.error('2. The mailbox exists in Mailcow');
    } else if (error.code === 'ESOCKET') {
      console.error('\nSocket error. Please check:');
      console.error('1. DNS resolution for mail.wavemax.promo');
      console.error('2. Firewall rules allow connection');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testEmailConfiguration();
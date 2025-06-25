#!/usr/bin/env node

// Test email sending with current configuration
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('Testing email configuration...\n');
  
  // Show current configuration (hiding password)
  console.log('Current configuration:');
  console.log(`  Host: ${process.env.EMAIL_HOST}`);
  console.log(`  Port: ${process.env.EMAIL_PORT}`);
  console.log(`  User: ${process.env.EMAIL_USER}`);
  console.log(`  Pass: ${process.env.EMAIL_PASS ? '***hidden***' : 'NOT SET'}`);
  console.log(`  From: ${process.env.EMAIL_FROM}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'test@example.com', // Change this to your test email
      subject: 'WaveMAX Email Test',
      text: 'This is a test email from WaveMAX Affiliate Program.',
      html: '<p>This is a <strong>test email</strong> from WaveMAX Affiliate Program.</p>'
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Accepted: ${info.accepted.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Email test failed!');
    console.error(`   Error: ${error.message}`);
    
    if (error.responseCode === 535) {
      console.error('\n🔐 Authentication failed!');
      console.error('   The password in .env does not match the mailcow password.');
      console.error('   Please update the mailbox password in mailcow to match .env');
    }
  }
}

testEmail().catch(console.error);
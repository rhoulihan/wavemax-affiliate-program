#!/usr/bin/env node

/**
 * Test script for payment link generation
 * Run: node scripts/test-payment-links.js
 */

const mongoose = require('mongoose');
const paymentLinkService = require('../server/services/paymentLinkService');
require('dotenv').config();

async function testPaymentLinks() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Test order ID (simulating a real MongoDB ObjectId)
    const testOrderId = '507f1f77bcf86cd799439011';
    const testAmount = 45.67;
    const testCustomerName = 'John Doe';

    console.log('Testing Payment Link Generation');
    console.log('================================');
    console.log(`Order ID: ${testOrderId}`);
    console.log(`Amount: $${testAmount}`);
    console.log(`Customer: ${testCustomerName}\n`);

    // Generate payment links
    const result = await paymentLinkService.generatePaymentLinks(
      testOrderId,
      testAmount,
      testCustomerName
    );

    console.log('Generated Payment Links:');
    console.log('------------------------');
    console.log(`Short Order ID: ${result.shortOrderId}`);
    console.log(`Payment Note: ${result.note}`);
    console.log(`Amount: $${result.amount}\n`);

    console.log('Payment URLs:');
    console.log('-------------');
    console.log('Venmo:', result.links.venmo);
    console.log('PayPal:', result.links.paypal);
    console.log('CashApp:', result.links.cashapp);
    console.log('');

    console.log('QR Codes Generated:');
    console.log('------------------');
    console.log('Venmo QR:', result.qrCodes.venmo ? '✅ Generated' : '❌ Failed');
    console.log('PayPal QR:', result.qrCodes.paypal ? '✅ Generated' : '❌ Failed');
    console.log('CashApp QR:', result.qrCodes.cashapp ? '✅ Generated' : '❌ Failed');
    console.log('');

    // Test HTML generation
    const buttonsHTML = paymentLinkService.generatePaymentButtonsHTML(result.links, result.amount);
    console.log('Payment Buttons HTML:', buttonsHTML.length > 0 ? '✅ Generated' : '❌ Failed');

    const qrHTML = paymentLinkService.generateQRCodesHTML(result.qrCodes, result.note);
    console.log('QR Codes HTML:', qrHTML.length > 0 ? '✅ Generated' : '❌ Failed');

    console.log('\n✅ Payment link generation test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the test
testPaymentLinks();
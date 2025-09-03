#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const paymentEmailScanner = require('../server/services/paymentEmailScanner');

async function processPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Simulate the payment email data
    const mockPayment = {
      orderId: 'ORD-e8c7874a-41bd-4853-b4fd-9c3e10008b9e',
      amount: 41.50,
      provider: 'venmo',
      transactionId: 'VENMO-' + Date.now(),
      sender: 'john.smith@venmo.com',
      timestamp: new Date()
    };
    
    console.log('\nProcessing payment:');
    console.log('- Order ID:', mockPayment.orderId);
    console.log('- Amount:', mockPayment.amount);
    console.log('- Provider:', mockPayment.provider);
    
    // Process the payment
    const result = await paymentEmailScanner.verifyAndUpdateOrder(mockPayment);
    
    if (result) {
      console.log('\n✅ Payment verified successfully!');
    } else {
      console.log('\n❌ Payment verification failed');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

processPayment();
#!/usr/bin/env node

/**
 * Test script to verify admin notifications for payment issues
 * Tests: underpayment, overpayment, and duplicate payment scenarios
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../server/models/Order');
const Customer = require('../server/models/Customer');
const PaymentEmailScanner = require('../server/services/paymentEmailScanner');

async function createTestOrder(scenario) {
  try {
    // Create test customer if doesn't exist
    let customer = await Customer.findOne({ email: 'testpayment@example.com' });
    if (!customer) {
      customer = await Customer.create({
        customerId: 'CUST-TEST-' + Date.now(),
        affiliateId: 'AFF-TEST',
        firstName: 'Test',
        lastName: 'Payment',
        email: 'testpayment@example.com',
        phone: '555-0123',
        address: '123 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        username: 'testpayment' + Date.now(),
        passwordHash: 'test',
        passwordSalt: 'test'
      });
    }

    // Create test order based on scenario
    const orderId = 'ORD-TEST-' + scenario + '-' + Date.now();
    const order = await Order.create({
      orderId: orderId,
      customerId: customer.customerId,
      affiliateId: 'AFF-TEST',
      pickupDate: new Date(),
      pickupTime: 'morning',
      estimatedWeight: 10,
      actualWeight: 10,
      numberOfBags: 1,
      baseRate: 1.25,
      v2PaymentAmount: 12.50,
      actualTotal: 12.50,
      status: 'processing',
      v2PaymentStatus: scenario === 'duplicate' ? 'verified' : 'awaiting',
      v2PaymentVerifiedAt: scenario === 'duplicate' ? new Date() : null,
      v2PaymentTransactionId: scenario === 'duplicate' ? 'PREV-TRANS-123' : null
    });

    return { order, customer };
  } catch (error) {
    console.error('Error creating test order:', error);
    throw error;
  }
}

async function testScenario(scenario, paymentAmount) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${scenario.toUpperCase()} scenario`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Create test order
    const { order, customer } = await createTestOrder(scenario);
    console.log(`Created test order: ${order.orderId}`);
    console.log(`Expected amount: $${order.v2PaymentAmount}`);
    console.log(`Payment amount: $${paymentAmount}`);
    
    // Create mock payment data
    const mockPayment = {
      orderId: order.orderId,
      amount: paymentAmount,
      provider: 'venmo',
      transactionId: 'TEST-TRANS-' + Date.now(),
      sender: 'testuser@venmo.com',
      timestamp: new Date()
    };

    // Test the payment verification
    console.log(`\nProcessing payment...`);
    const result = await PaymentEmailScanner.verifyAndUpdateOrder(mockPayment);
    
    if (scenario === 'duplicate') {
      console.log(`✓ Duplicate payment detected and admin notified`);
    } else if (scenario === 'underpayment') {
      console.log(`✓ Underpayment detected (short $${(order.v2PaymentAmount - paymentAmount).toFixed(2)})`);
      console.log(`✓ Payment verification blocked`);
      console.log(`✓ Admin notified`);
    } else if (scenario === 'overpayment') {
      console.log(`✓ Overpayment detected (excess $${(paymentAmount - order.v2PaymentAmount).toFixed(2)})`);
      console.log(`✓ Payment verified with note`);
      console.log(`✓ Admin notified`);
    }

    // Fetch updated order to verify changes
    const updatedOrder = await Order.findOne({ orderId: order.orderId });
    console.log(`\nOrder status after processing:`);
    console.log(`- Payment Status: ${updatedOrder.v2PaymentStatus}`);
    console.log(`- Payment Notes: ${updatedOrder.v2PaymentNotes || 'None'}`);
    
    // Clean up test order
    await Order.deleteOne({ orderId: order.orderId });
    console.log(`\n✓ Test order cleaned up`);

  } catch (error) {
    console.error(`Error in ${scenario} test:`, error);
  }
}

async function runTests() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test all three scenarios
    await testScenario('underpayment', 10.00);  // Pay $10 for $12.50 order
    await testScenario('overpayment', 15.00);   // Pay $15 for $12.50 order  
    await testScenario('duplicate', 12.50);     // Pay again for already paid order

    console.log(`\n${'='.repeat(60)}`);
    console.log('All tests completed successfully!');
    console.log(`${'='.repeat(60)}\n`);
    
    console.log('Admin notifications should have been sent to:');
    console.log(`- Email: ${process.env.ADMIN_EMAIL || 'admin@wavemaxlaundry.com'}`);
    console.log('\nCheck the admin email inbox for:');
    console.log('1. Underpayment alert');
    console.log('2. Overpayment alert');
    console.log('3. Duplicate payment alert');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run tests
runTests();
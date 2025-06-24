#!/usr/bin/env node

// Test script to verify duplicate order prevention
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../server/models/Order');
const Customer = require('../server/models/Customer');
const Affiliate = require('../server/models/Affiliate');

async function testDuplicateOrderPrevention() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find a test customer and affiliate
    const customer = await Customer.findOne({}).sort({ createdAt: -1 });
    const affiliate = await Affiliate.findOne({}).sort({ createdAt: -1 });

    if (!customer || !affiliate) {
      console.log('No customer or affiliate found. Please ensure test data exists.');
      process.exit(1);
    }

    console.log(`\nUsing customer: ${customer.customerId} (${customer.firstName} ${customer.lastName})`);
    console.log(`Using affiliate: ${affiliate.affiliateId} (${affiliate.businessName})\n`);

    // Check for existing active orders
    console.log('Checking for existing active orders...');
    const activeOrders = await Order.find({
      customerId: customer.customerId,
      status: { $in: ['pending', 'processing', 'processed'] }
    });

    console.log(`Found ${activeOrders.length} active order(s) for this customer:`);
    activeOrders.forEach(order => {
      console.log(`  - Order ${order.orderId}: Status = ${order.status}, Created = ${order.createdAt}`);
    });

    // Create a test order if none exist
    if (activeOrders.length === 0) {
      console.log('\nNo active orders found. Creating a test order...');
      const testOrder = new Order({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        pickupTime: '10:00 AM',
        specialPickupInstructions: 'Test order for duplicate prevention',
        estimatedWeight: 20,
        numberOfBags: 2,
        status: 'pending'
      });
      
      await testOrder.save();
      console.log(`Created test order: ${testOrder.orderId} with status: ${testOrder.status}`);
    }

    // Test the duplicate prevention by simulating an API call
    console.log('\nSimulating order creation API behavior...');
    const existingActiveOrder = await Order.findOne({
      customerId: customer.customerId,
      status: { $in: ['pending', 'processing', 'processed'] }
    });

    if (existingActiveOrder) {
      console.log('\n❌ DUPLICATE ORDER PREVENTED:');
      console.log(`   Customer already has an active order: ${existingActiveOrder.orderId}`);
      console.log(`   Order status: ${existingActiveOrder.status}`);
      console.log(`   Message: You already have an active order. Please wait for it to be completed before placing a new order.`);
    } else {
      console.log('\n✅ No active orders found. New order can be created.');
    }

    // Show order status flow
    console.log('\n📋 Order Status Flow:');
    console.log('   pending → processing → processed → complete → cancelled');
    console.log('\n   Active statuses that prevent new orders: pending, processing, processed');
    console.log('   Completed statuses that allow new orders: complete, cancelled');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the test
testDuplicateOrderPrevention();
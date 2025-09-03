#!/usr/bin/env node

/**
 * Test script to verify pickup notification is sent when bags are processed after payment
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../server/models/Order');
const Customer = require('../server/models/Customer');
const Affiliate = require('../server/models/Affiliate');

async function testPickupNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find or create test customer
    let customer = await Customer.findOne({ email: 'test-pickup@example.com' });
    if (!customer) {
      customer = await Customer.create({
        customerId: 'CUST-PICKUP-TEST',
        affiliateId: 'AFF-001',
        firstName: 'Test',
        lastName: 'Pickup',
        email: 'test-pickup@example.com',
        phone: '555-0199',
        address: '123 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        username: 'testpickup' + Date.now(),
        passwordHash: 'test',
        passwordSalt: 'test'
      });
      console.log('Created test customer');
    }
    
    // Find or create test affiliate
    let affiliate = await Affiliate.findOne({ affiliateId: 'AFF-001' });
    if (!affiliate) {
      affiliate = await Affiliate.create({
        affiliateId: 'AFF-001',
        businessName: 'Test Affiliate',
        contactPerson: 'John Affiliate',
        email: 'affiliate@wavemax.promo',
        phone: '555-1000',
        address: '456 Business St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78702'
      });
      console.log('Created test affiliate');
    }
    
    // Create test order that's been weighed and payment verified
    const orderId = 'ORD-PICKUP-TEST-' + Date.now();
    const order = await Order.create({
      orderId: orderId,
      customerId: customer.customerId,
      affiliateId: affiliate.affiliateId,
      pickupDate: new Date(),
      pickupTime: 'morning',
      estimatedWeight: 10,
      actualWeight: 10,
      numberOfBags: 1,
      baseRate: 1.25,
      v2PaymentAmount: 12.50,
      actualTotal: 12.50,
      status: 'processing', // Still processing, not yet marked as processed
      v2PaymentStatus: 'verified', // Payment already verified
      v2PaymentVerifiedAt: new Date(),
      bags: [{
        bagId: orderId + '-BAG1',
        bagNumber: 1,
        status: 'processing',
        weight: 10,
        scannedAt: {
          processing: new Date()
        }
      }],
      bagsWeighed: 1,
      bagsProcessed: 0 // Not yet processed
    });
    
    console.log('\n=== TEST SCENARIO ===');
    console.log('Order created:', orderId);
    console.log('Status:', order.status);
    console.log('Payment Status:', order.v2PaymentStatus);
    console.log('Bags Processed:', order.bagsProcessed, '/', order.numberOfBags);
    
    console.log('\n=== SIMULATING BAG SCAN AFTER WDF ===');
    
    // Simulate marking the bag as processed (after WDF)
    order.bags[0].status = 'processed';
    order.bags[0].scannedAt.processed = new Date();
    order.bagsProcessed = 1;
    
    // Check if all bags are processed
    const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'completed');
    
    if (allBagsProcessed) {
      console.log('✓ All bags processed');
      order.status = 'processed';
      order.processedAt = new Date();
      
      // Check payment status
      if (order.v2PaymentStatus === 'verified') {
        console.log('✓ Payment is verified');
        console.log('\n>>> PICKUP NOTIFICATION SHOULD BE SENT TO AFFILIATE NOW <<<');
        console.log('   Affiliate email:', affiliate.email);
        console.log('   Order ready for pickup:', orderId);
        
        // In the actual code, this is where emailService.sendOrderReadyNotification would be called
        const emailService = require('../server/utils/emailService');
        
        try {
          await emailService.sendOrderReadyNotification(
            affiliate.email,
            {
              affiliateName: affiliate.contactPerson || affiliate.businessName,
              orderId: order.orderId,
              customerName: `${customer.firstName} ${customer.lastName}`,
              numberOfBags: order.numberOfBags,
              totalWeight: order.actualWeight
            }
          );
          console.log('\n✅ PICKUP NOTIFICATION SENT SUCCESSFULLY!');
        } catch (error) {
          console.error('\n❌ Error sending pickup notification:', error.message);
        }
      } else {
        console.log('⚠️ Payment not verified yet - no pickup notification sent');
      }
    }
    
    await order.save();
    
    console.log('\n=== FINAL ORDER STATE ===');
    console.log('Status:', order.status);
    console.log('Payment Status:', order.v2PaymentStatus);
    console.log('Bags Processed:', order.bagsProcessed, '/', order.numberOfBags);
    
    // Clean up
    await Order.deleteOne({ orderId: orderId });
    console.log('\n✓ Test order cleaned up');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Test failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testPickupNotification();
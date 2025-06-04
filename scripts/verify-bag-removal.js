/**
 * Verification script to ensure bag tracking has been completely removed
 * This script will check:
 * 1. Bags collection no longer exists
 * 2. No orders have bagIDs field
 * 3. Customer accounts are intact
 * 4. System is functioning properly
 */

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const verifyBagRemoval = async () => {
  console.log('Verifying bag tracking removal...\n');
  const issues = [];

  try {
    // 1. Check if bags collection exists
    console.log('1. Checking for bags collection...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const bagsCollection = collections.find(col => col.name === 'bags');
    
    if (bagsCollection) {
      issues.push('Bags collection still exists');
      console.log('   ❌ Bags collection found');
    } else {
      console.log('   ✓ Bags collection does not exist');
    }

    // 2. Check orders for bagIDs field
    console.log('\n2. Checking orders for bagIDs field...');
    const Order = require('../server/models/Order');
    const ordersWithBags = await Order.findOne({ bagIDs: { $exists: true } });
    
    if (ordersWithBags) {
      issues.push('Some orders still have bagIDs field');
      console.log('   ❌ Found orders with bagIDs field');
    } else {
      console.log('   ✓ No orders have bagIDs field');
    }

    // 3. Verify customer data
    console.log('\n3. Verifying customer data...');
    const Customer = require('../server/models/Customer');
    const customerCount = await Customer.countDocuments();
    console.log(`   ✓ ${customerCount} customers found`);

    // 4. Check affiliate data
    console.log('\n4. Verifying affiliate data...');
    const Affiliate = require('../server/models/Affiliate');
    const affiliateCount = await Affiliate.countDocuments();
    console.log(`   ✓ ${affiliateCount} affiliates found`);

    // 5. Test order creation (without bags)
    console.log('\n5. Testing order creation...');
    try {
      // Find a test customer
      const testCustomer = await Customer.findOne();
      const testAffiliate = await Affiliate.findOne();
      
      if (testCustomer && testAffiliate) {
        const testOrder = new Order({
          customerId: testCustomer.customerId,
          affiliateId: testAffiliate.affiliateId,
          pickupDate: new Date(),
          pickupTime: '9am-12pm',
          deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          deliveryTime: '9am-12pm',
          estimatedSize: 'medium',
          status: 'scheduled'
        });
        
        // Validate without saving
        await testOrder.validate();
        console.log('   ✓ Order validation successful (without bags)');
      } else {
        console.log('   ℹ No test data available for order validation');
      }
    } catch (error) {
      issues.push(`Order creation test failed: ${error.message}`);
      console.log('   ❌ Order creation test failed');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (issues.length === 0) {
      console.log('✅ All verification checks passed!');
      console.log('Bag tracking has been successfully removed.');
    } else {
      console.log('❌ Verification found issues:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  }
};

// Run verification
(async () => {
  await connectDB();
  
  try {
    await verifyBagRemoval();
  } catch (error) {
    console.error('Verification error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
})();
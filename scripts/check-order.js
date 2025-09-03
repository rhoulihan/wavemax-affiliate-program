#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../server/models/Order');

async function checkOrder() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const orderId = 'ORD-e8c7874a-41bd-4853-b4fd-9c3e10008b9e';
    
    // Check if order exists
    const order = await Order.findOne({ orderId });
    
    if (order) {
      console.log('\n✅ Order found:');
      console.log('- Order ID:', order.orderId);
      console.log('- Customer ID:', order.customerId);
      console.log('- Status:', order.status);
      console.log('- V2 Payment Status:', order.v2PaymentStatus);
      console.log('- V2 Payment Amount:', order.v2PaymentAmount);
      console.log('- Actual Total:', order.actualTotal);
      console.log('- Estimated Total:', order.estimatedTotal);
      console.log('- Created At:', order.createdAt);
      console.log('- Is Test Order:', order.isTestOrder);
    } else {
      console.log('\n❌ Order NOT found with ID:', orderId);
      
      // Try to find similar orders
      const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderId createdAt status v2PaymentStatus');
        
      console.log('\nMost recent orders:');
      recentOrders.forEach(o => {
        console.log(`- ${o.orderId} (${o.status}, V2: ${o.v2PaymentStatus}) - Created: ${o.createdAt}`);
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrder();
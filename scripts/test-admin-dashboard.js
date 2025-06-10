#!/usr/bin/env node

// Test Administrator Dashboard Data Script
// This script tests the dashboard endpoint to verify data structure

require('dotenv').config();
const mongoose = require('mongoose');
const Administrator = require('../server/models/Administrator');
const Order = require('../server/models/Order');
const Operator = require('../server/models/Operator');
const jwt = require('jsonwebtoken');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    
    // Find the default admin
    const defaultAdmin = await Administrator.findOne({ 
      email: process.env.DEFAULT_ADMIN_EMAIL || 'rickh@wavemaxlaundry.com' 
    });
    
    if (!defaultAdmin) {
      console.log('❌ Default administrator not found');
      return;
    }
    
    console.log('✓ Found administrator:', defaultAdmin.adminId);
    
    // Generate a test token
    const token = jwt.sign({
      id: defaultAdmin._id,
      adminId: defaultAdmin.adminId,
      role: 'administrator',
      permissions: defaultAdmin.permissions
    }, process.env.JWT_SECRET || 'your-secret-key');
    
    console.log('\n🔍 Testing dashboard endpoint...');
    
    // Import the controller
    const adminController = require('../server/controllers/administratorController');
    
    // Create mock request and response
    const mockReq = {
      user: {
        id: defaultAdmin._id,
        role: 'administrator'
      },
      query: {}
    };
    
    const mockRes = {
      json: (data) => {
        console.log('\n✓ Dashboard response received:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success && data.dashboard) {
          console.log('\n📊 Dashboard Statistics:');
          console.log('  Orders Today:', data.dashboard.orderStats?.today || 0);
          console.log('  Orders This Week:', data.dashboard.orderStats?.thisWeek || 0);
          console.log('  Active Operators:', data.dashboard.systemHealth?.activeOperators || 0);
          console.log('  On Shift:', data.dashboard.systemHealth?.onShiftOperators || 0);
          console.log('  Pending Orders:', data.dashboard.systemHealth?.pendingOrders || 0);
        }
      },
      status: (code) => ({
        json: (data) => {
          console.error('❌ Error response:', code, data);
        }
      })
    };
    
    // Call the dashboard endpoint
    await adminController.getDashboard(mockReq, mockRes);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

main();
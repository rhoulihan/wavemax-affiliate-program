#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Administrator = require('../server/models/Administrator');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const admin = new Administrator({
      adminId: 'ADM001',
      firstName: 'John',
      lastName: 'Houlihan',
      email: 'rickh@wavemaxlaundry.com',
      password: 'R8der50!',
      permissions: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'],
      isActive: true,
      createdBy: 'system'
    });

    await admin.save();
    console.log('✓ Administrator created successfully!');
    console.log(`  Admin ID: ${admin.adminId}`);
    console.log(`  Email: ${admin.email}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

main();
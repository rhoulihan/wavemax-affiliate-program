#!/usr/bin/env node

/**
 * Automated migration script for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Administrator = require('../server/models/Administrator');
const SystemConfig = require('../server/models/SystemConfig');
const Operator = require('../server/models/Operator');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createSuperAdmin() {
  try {
    // Check if super admin already exists
    const existingAdmin = await Administrator.findOne({ adminId: 'ADM001' });
    if (existingAdmin) {
      console.log('✓ Super administrator already exists');
      return existingAdmin;
    }

    console.log('\n=== Creating Super Administrator ===');
    
    const superAdmin = new Administrator({
      adminId: 'ADM001',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'Admin123!',
      permissions: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'],
      isActive: true,
      createdBy: 'system'
    });

    await superAdmin.save();
    console.log('✓ Super administrator created successfully');
    console.log(`  Admin ID: ${superAdmin.adminId}`);
    console.log(`  Email: ${superAdmin.email}`);
    
    return superAdmin;
  } catch (error) {
    console.error('✗ Error creating super administrator:', error.message);
    throw error;
  }
}

async function initializeSystemConfig() {
  try {
    console.log('\n=== Initializing System Configuration ===');
    
    const configs = [
      {
        key: 'order_processing_hours',
        value: { start: '06:00', end: '22:00' },
        category: 'operations',
        description: 'Operating hours for order processing',
        dataType: 'object'
      },
      {
        key: 'max_concurrent_orders_per_operator',
        value: 3,
        category: 'operations',
        description: 'Maximum number of orders an operator can process simultaneously',
        dataType: 'number'
      },
      {
        key: 'quality_check_required_percentage',
        value: 20,
        category: 'quality',
        description: 'Percentage of orders requiring quality check',
        dataType: 'number'
      },
      {
        key: 'operator_shift_duration_hours',
        value: 8,
        category: 'operations',
        description: 'Standard shift duration in hours',
        dataType: 'number'
      },
      {
        key: 'workstation_types',
        value: ['washing', 'drying', 'folding'],
        category: 'operations',
        description: 'Available workstation types',
        dataType: 'array'
      },
      {
        key: 'order_priority_levels',
        value: ['standard', 'express', 'urgent'],
        category: 'operations',
        description: 'Available order priority levels',
        dataType: 'array'
      },
      {
        key: 'operator_performance_threshold',
        value: { ordersPerHour: 5, qualityScore: 85 },
        category: 'performance',
        description: 'Minimum performance thresholds for operators',
        dataType: 'object'
      },
      {
        key: 'email_notifications_enabled',
        value: true,
        category: 'notification',
        description: 'Enable email notifications for order updates',
        dataType: 'boolean'
      },
      {
        key: 'auto_assign_orders',
        value: false,
        category: 'operations',
        description: 'Automatically assign orders to available operators',
        dataType: 'boolean'
      },
      {
        key: 'order_processing_time_targets',
        value: {
          standard: 180, // 3 hours
          express: 120,  // 2 hours
          urgent: 60     // 1 hour
        },
        category: 'operations',
        description: 'Target processing time in minutes by priority level',
        dataType: 'object'
      }
    ];

    for (const config of configs) {
      const existing = await SystemConfig.findOne({ key: config.key });
      if (!existing) {
        await SystemConfig.create(config);
        console.log(`✓ Created config: ${config.key}`);
      } else {
        console.log(`  Config already exists: ${config.key}`);
      }
    }
    
    console.log('✓ System configuration initialized');
    
  } catch (error) {
    console.error('✗ Error initializing system configuration:', error.message);
    throw error;
  }
}

async function createDemoData(admin) {
  try {
    console.log('\n=== Creating Demo Operator ===');
    
    const existing = await Operator.findOne({ operatorId: 'OPR001' });
    if (existing) {
      console.log('  Demo operator already exists');
      return;
    }
    
    const demoOperator = new Operator({
      operatorId: 'OPR001',
      firstName: 'Demo',
      lastName: 'Operator',
      email: 'operator@example.com',
      password: 'Operator123!',
      shiftStart: '08:00',
      shiftEnd: '16:00',
      workStation: null,
      isActive: true,
      createdBy: admin._id
    });

    await demoOperator.save();
    console.log('✓ Demo operator created');
    console.log(`  Operator ID: ${demoOperator.operatorId}`);
    console.log(`  Email: ${demoOperator.email}`);
    console.log(`  Password: Operator123!`);
    console.log(`  Shift: ${demoOperator.shiftStart} - ${demoOperator.shiftEnd}`);
    
  } catch (error) {
    console.error('✗ Error creating demo operator:', error.message);
  }
}

async function main() {
  try {
    console.log('WaveMAX Administrator & Operator System Migration\n');
    
    await connectDB();
    const admin = await createSuperAdmin();
    await initializeSystemConfig();
    await createDemoData(admin);
    
    console.log('\n✓ Migration completed successfully!');
    console.log('\n=== Access Information ===');
    console.log('\n1. Administrator Portal:');
    console.log('   URL: https://wavemax.promo/administrator-login-embed.html');
    console.log('   Email: admin@example.com');
    console.log('   Password: Admin123!');
    console.log('\n2. Operator Portal:');
    console.log('   URL: https://wavemax.promo/operator-login-embed.html');
    console.log('   Email: operator@example.com');
    console.log('   Password: Operator123!');
    console.log('\n3. Embedded Application:');
    console.log('   URL: https://wavemax.promo/embed-app.html');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run migration
main();
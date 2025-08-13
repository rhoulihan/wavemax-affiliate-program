#!/usr/bin/env node

const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');
require('dotenv').config();

async function addFreeFirstBagConfig() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Add free first bag setting
    const existing = await SystemConfig.findOne({ key: 'free_first_bag_enabled' });
    if (!existing) {
      await SystemConfig.create({
        key: 'free_first_bag_enabled',
        value: true,
        defaultValue: true,
        description: 'Enable free first bag policy - customers get their first bag free',
        category: 'payment',
        dataType: 'boolean'
      });
      console.log('✓ Added free_first_bag_enabled setting');
    } else {
      console.log('✓ free_first_bag_enabled already exists:', existing.value);
    }
    
    mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addFreeFirstBagConfig();
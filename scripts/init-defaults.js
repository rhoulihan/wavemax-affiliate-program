#!/usr/bin/env node

// Standalone script to initialize default admin and operator accounts
// Usage: node scripts/init-defaults.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { initializeDefaults } = require('../init-defaults');
const logger = require('../server/utils/logger');

// MongoDB connection options
const mongoOptions = {
  tls: true,
  tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
};

async function run() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    logger.info('Connected to MongoDB');

    // Initialize defaults
    await initializeDefaults();

    logger.info('Default initialization complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during initialization:', { error: error.message });
    process.exit(1);
  }
}

// Run the script
run();
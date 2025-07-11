#!/usr/bin/env node

/**
 * Reset Rate Limiting Counters
 * This script clears all rate limit records from MongoDB
 * 
 * Usage:
 *   node scripts/reset-rate-limits.js
 *   node scripts/reset-rate-limits.js --type auth
 *   node scripts/reset-rate-limits.js --ip 192.168.1.1
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Parse command line arguments
const args = process.argv.slice(2);
const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const ipFilter = args.includes('--ip') ? args[args.indexOf('--ip') + 1] : null;

// MongoDB connection options
const mongoOptions = {
  tls: true,
  tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
};

async function resetRateLimits() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('Connected to MongoDB');

    // Get the rate_limits collection
    const db = mongoose.connection.db;
    const collection = db.collection('rate_limits');

    // Build filter
    let filter = {};
    
    if (typeFilter) {
      // Filter by type (auth, registration, etc.)
      filter.key = new RegExp(typeFilter, 'i');
      console.log(`Filtering by type: ${typeFilter}`);
    }
    
    if (ipFilter) {
      // Filter by IP address
      filter.key = new RegExp(ipFilter.replace(/\./g, '\\.'));
      console.log(`Filtering by IP: ${ipFilter}`);
    }

    // Count records before deletion
    const countBefore = await collection.countDocuments(filter);
    console.log(`Found ${countBefore} rate limit records matching filter`);

    if (countBefore === 0) {
      console.log('No rate limit records to delete');
      await mongoose.disconnect();
      return;
    }

    // Show sample of records to be deleted
    const samples = await collection.find(filter).limit(5).toArray();
    console.log('\nSample records to be deleted:');
    samples.forEach(doc => {
      console.log(`  - Key: ${doc.key || doc._id}`);
    });

    // Ask for confirmation
    console.log(`\nThis will delete ${countBefore} rate limit records.`);
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete records
    const result = await collection.deleteMany(filter);
    console.log(`\nDeleted ${result.deletedCount} rate limit records`);

    // Verify deletion
    const countAfter = await collection.countDocuments(filter);
    console.log(`Remaining records matching filter: ${countAfter}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    console.log('\nRate limits reset successfully!');

  } catch (error) {
    console.error('Error resetting rate limits:', error);
    process.exit(1);
  }
}

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Rate Limit Reset Script

Usage:
  node scripts/reset-rate-limits.js [options]

Options:
  --type <type>   Filter by rate limit type (auth, registration, password-reset, api)
  --ip <address>  Filter by IP address
  --help, -h      Show this help message

Examples:
  # Reset all rate limits
  node scripts/reset-rate-limits.js

  # Reset only authentication rate limits
  node scripts/reset-rate-limits.js --type auth

  # Reset rate limits for specific IP
  node scripts/reset-rate-limits.js --ip 192.168.1.100

  # Reset registration limits for specific IP
  node scripts/reset-rate-limits.js --type registration --ip 192.168.1.100
`);
  process.exit(0);
}

// Run the script
resetRateLimits();
#!/usr/bin/env node

/**
 * Test script for callback pool system
 * Tests callback URL acquisition, locking, and release
 */

require('dotenv').config();
const mongoose = require('mongoose');
const CallbackPool = require('../server/models/CallbackPool');
const callbackPoolManager = require('../server/services/callbackPoolManager');
const logger = require('../server/utils/logger');

async function testCallbackPool() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Initialize pool
    console.log('\n1. Initializing callback pool...');
    await callbackPoolManager.initializePool();

    // Get pool status
    console.log('\n2. Current pool status:');
    let status = await callbackPoolManager.getPoolStatus();
    console.log(`Total callbacks: ${status.total}`);
    console.log(`Available: ${status.available}`);
    console.log(`Locked: ${status.locked}`);

    // Test acquiring callbacks
    console.log('\n3. Testing callback acquisition...');
    const tokens = [];
    const callbacks = [];

    // Acquire 3 callbacks
    for (let i = 0; i < 3; i++) {
      const token = `test-token-${Date.now()}-${i}`;
      tokens.push(token);

      console.log(`\nAcquiring callback for token: ${token}`);
      const callback = await callbackPoolManager.acquireCallback(token);
      callbacks.push(callback);

      console.log('Acquired callback:', {
        formId: callback.formId,
        callbackPath: callback.callbackPath,
        callbackUrl: callback.callbackUrl
      });
    }

    // Check pool status after acquisition
    console.log('\n4. Pool status after acquiring 3 callbacks:');
    status = await callbackPoolManager.getPoolStatus();
    console.log(`Available: ${status.available}`);
    console.log(`Locked: ${status.locked}`);

    // Release one callback
    console.log('\n5. Releasing first callback...');
    await callbackPoolManager.releaseCallback(tokens[0]);
    console.log(`Released callback for token: ${tokens[0]}`);

    // Check status after release
    console.log('\n6. Pool status after releasing 1 callback:');
    status = await callbackPoolManager.getPoolStatus();
    console.log(`Available: ${status.available}`);
    console.log(`Locked: ${status.locked}`);

    // Show detailed status
    console.log('\n7. Detailed callback status:');
    status.handlers.forEach(handler => {
      console.log(`${handler.path}:`, {
        locked: handler.isLocked,
        lockedBy: handler.lockedBy || 'none',
        usageCount: handler.usageCount
      });
    });

    // Test concurrent acquisition
    console.log('\n8. Testing concurrent acquisition...');
    const concurrentTokens = Array(5).fill().map((_, i) => `concurrent-${i}`);
    const concurrentPromises = concurrentTokens.map(token =>
      callbackPoolManager.acquireCallback(token)
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    console.log(`Successfully acquired ${concurrentResults.length} callbacks concurrently`);

    // Cleanup - release all test callbacks
    console.log('\n9. Cleaning up test callbacks...');
    for (const token of [...tokens, ...concurrentTokens]) {
      await callbackPoolManager.releaseCallback(token);
    }

    console.log('\n10. Final pool status:');
    status = await callbackPoolManager.getPoolStatus();
    console.log(`Available: ${status.available}`);
    console.log(`Locked: ${status.locked}`);

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testCallbackPool();
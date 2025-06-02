// Test Lock System for Sequential Execution
// Ensures only one passport config test runs at a time to prevent Jest mock isolation issues

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK_FILE = path.join(os.tmpdir(), 'passport-config-test.lock');
const LOCK_TIMEOUT = 30000; // 30 seconds max wait
const POLL_INTERVAL = 100; // Check every 100ms for faster execution

class TestLock {
  constructor(testName) {
    this.testName = testName;
    this.processId = process.pid;
    this.lockData = {
      testName: this.testName,
      processId: this.processId,
      timestamp: Date.now()
    };
  }

  async acquireLock() {
    const startTime = Date.now();
    
    while (Date.now() - startTime < LOCK_TIMEOUT) {
      try {
        // Try to read existing lock
        if (fs.existsSync(LOCK_FILE)) {
          const existingLock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
          
          // Check if lock is stale (older than 30 seconds)
          if (Date.now() - existingLock.timestamp > LOCK_TIMEOUT) {
            console.log(`[${this.testName}] Removing stale lock from ${existingLock.testName}`);
            fs.unlinkSync(LOCK_FILE);
          } else {
            // Lock is active, wait
            await this.sleep(POLL_INTERVAL);
            continue;
          }
        }

        // Try to acquire lock atomically
        fs.writeFileSync(LOCK_FILE, JSON.stringify(this.lockData), { flag: 'wx' });
        console.log(`[${this.testName}] Lock acquired successfully`);
        return true;

      } catch (error) {
        if (error.code === 'EEXIST') {
          // Another process beat us to it, wait and retry
          await this.sleep(POLL_INTERVAL);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`[${this.testName}] Failed to acquire lock within ${LOCK_TIMEOUT}ms`);
  }

  releaseLock() {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const existingLock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        
        // Only remove lock if we own it
        if (existingLock.processId === this.processId && existingLock.testName === this.testName) {
          fs.unlinkSync(LOCK_FILE);
          console.log(`[${this.testName}] Lock released successfully`);
        } else {
          console.log(`[${this.testName}] Cannot release lock - owned by ${existingLock.testName}`);
        }
      }
    } catch (error) {
      console.error(`[${this.testName}] Error releasing lock:`, error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Helper function to run a test with lock protection
async function runWithLock(testName, testFunction) {
  const lock = new TestLock(testName);
  
  try {
    await lock.acquireLock();
    return await testFunction();
  } finally {
    lock.releaseLock();
  }
}

module.exports = { TestLock, runWithLock };
#!/usr/bin/env node

// Encryption Key Migration Script for WaveMAX Laundry Affiliate Program
// This script migrates encrypted data from old encryption key to new encryption key
// It tracks progress and can be resumed if interrupted

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Models
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');

// Migration state file
const STATE_FILE = path.join(__dirname, '../backup/migration-state.json');
const BACKUP_DIR = path.join(__dirname, '../backup');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions for colored output
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  progress: (msg) => console.log(`${colors.cyan}[PROGRESS]${colors.reset} ${msg}`)
};

// Encryption utilities with old and new keys
class MigrationEncryption {
  constructor(oldKey, newKey) {
    this.oldKey = oldKey;
    this.newKey = newKey;
    this.algorithm = 'aes-256-gcm';
  }

  decrypt(encryptedData, key) {
    try {
      if (!encryptedData || typeof encryptedData !== 'object') {
        return encryptedData;
      }

      // Handle both old and new field names
      const { iv, authTag, encrypted, encryptedData: encData } = encryptedData;
      const cipherText = encrypted || encData;
      
      if (!iv || !authTag || !cipherText) {
        throw new Error('Invalid encrypted data format');
      }

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(cipherText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  encrypt(text, key) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(key, 'hex'),
        iv
      );

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptedData: encrypted  // Use the same field name as the main encryption util
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  migrateField(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return encryptedData;
    }

    // Decrypt with old key
    const decrypted = this.decrypt(encryptedData, this.oldKey);
    
    // Re-encrypt with new key
    return this.encrypt(decrypted, this.newKey);
  }
}

// Migration state management
class MigrationState {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      }
    } catch (error) {
      log.warning(`Could not load previous state: ${error.message}`);
    }
    
    return {
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      phase: 'not_started',
      affiliates: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        lastProcessedId: null,
        failures: []
      },
      customers: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        lastProcessedId: null,
        failures: []
      },
      completed: false
    };
  }

  saveState() {
    this.state.lastUpdate = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  updateProgress(model, success, docId, error = null) {
    const modelState = this.state[model];
    modelState.processed++;
    modelState.lastProcessedId = docId;
    
    if (success) {
      modelState.successful++;
    } else {
      modelState.failed++;
      modelState.failures.push({
        id: docId,
        error: error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
    this.saveState();
  }

  setPhase(phase) {
    this.state.phase = phase;
    this.saveState();
  }

  setTotals(affiliatesTotal, customersTotal) {
    this.state.affiliates.total = affiliatesTotal;
    this.state.customers.total = customersTotal;
    this.saveState();
  }

  markCompleted() {
    this.state.completed = true;
    this.state.completedTime = new Date().toISOString();
    this.saveState();
  }
}

// Main migration class
class EncryptionKeyMigration {
  constructor() {
    this.state = new MigrationState();
    this.migrationEncryption = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async validateKeys(oldKey, newKey) {
    // Validate key format (should be 64 hex characters for aes-256)
    const keyRegex = /^[0-9a-fA-F]{64}$/;
    
    if (!keyRegex.test(oldKey)) {
      throw new Error('Old encryption key must be 64 hexadecimal characters');
    }
    
    if (!keyRegex.test(newKey)) {
      throw new Error('New encryption key must be 64 hexadecimal characters');
    }
    
    if (oldKey === newKey) {
      throw new Error('Old and new keys cannot be the same');
    }
  }

  async connectDatabase() {
    log.info('Connecting to MongoDB...');
    
    const mongoOptions = {
      tls: true,
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
    };
    
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    log.success('Connected to MongoDB');
  }

  async backupData() {
    log.info('Creating backup of encrypted data...');
    
    const backupFile = path.join(BACKUP_DIR, `encrypted-data-backup-${Date.now()}.json`);
    const backup = {
      timestamp: new Date().toISOString(),
      affiliates: [],
      customers: []
    };
    
    // Backup affiliate encrypted fields
    const affiliates = await Affiliate.find({
      $or: [
        { accountNumber: { $exists: true, $ne: null } },
        { routingNumber: { $exists: true, $ne: null } },
        { paypalEmail: { $exists: true, $ne: null } }
      ]
    }).select('_id affiliateId accountNumber routingNumber paypalEmail paymentMethod');
    
    for (const affiliate of affiliates) {
      backup.affiliates.push({
        _id: affiliate._id,
        affiliateId: affiliate.affiliateId,
        paymentMethod: affiliate.paymentMethod,
        hasAccountNumber: !!affiliate.accountNumber,
        hasRoutingNumber: !!affiliate.routingNumber,
        hasPaypalEmail: !!affiliate.paypalEmail
      });
    }
    
    // Backup customer encrypted fields
    const customers = await Customer.find({
      $or: [
        { cardholderName: { $exists: true, $ne: null } },
        { expiryDate: { $exists: true, $ne: null } }
      ]
    }).select('_id customerId cardholderName expiryDate');
    
    for (const customer of customers) {
      backup.customers.push({
        _id: customer._id,
        customerId: customer.customerId,
        hasCardholderName: !!customer.cardholderName,
        hasExpiryDate: !!customer.expiryDate
      });
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    log.success(`Backup created: ${backupFile}`);
    
    return backup;
  }

  async migrateAffiliates() {
    log.info('Starting affiliate data migration...');
    this.state.setPhase('affiliates');
    
    // Get query for resuming
    const query = this.state.state.affiliates.lastProcessedId
      ? { _id: { $gt: this.state.state.affiliates.lastProcessedId } }
      : {};
    
    // Add filter for documents with encrypted data
    query.$or = [
      { accountNumber: { $exists: true, $ne: null, $type: 'object' } },
      { routingNumber: { $exists: true, $ne: null, $type: 'object' } },
      { paypalEmail: { $exists: true, $ne: null, $type: 'object' } }
    ];
    
    const cursor = Affiliate.find(query).sort({ _id: 1 }).cursor();
    
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      try {
        let updated = false;
        const updateData = {};
        
        // Migrate accountNumber
        if (doc.accountNumber && typeof doc.accountNumber === 'object') {
          try {
            updateData.accountNumber = this.migrationEncryption.migrateField(doc.accountNumber);
            updated = true;
          } catch (error) {
            log.error(`Failed to migrate accountNumber for affiliate ${doc.affiliateId}: ${error.message}`);
          }
        }
        
        // Migrate routingNumber
        if (doc.routingNumber && typeof doc.routingNumber === 'object') {
          try {
            updateData.routingNumber = this.migrationEncryption.migrateField(doc.routingNumber);
            updated = true;
          } catch (error) {
            log.error(`Failed to migrate routingNumber for affiliate ${doc.affiliateId}: ${error.message}`);
          }
        }
        
        // Migrate paypalEmail
        if (doc.paypalEmail && typeof doc.paypalEmail === 'object') {
          try {
            updateData.paypalEmail = this.migrationEncryption.migrateField(doc.paypalEmail);
            updated = true;
          } catch (error) {
            log.error(`Failed to migrate paypalEmail for affiliate ${doc.affiliateId}: ${error.message}`);
          }
        }
        
        // Save if any fields were migrated
        if (updated) {
          await Affiliate.updateOne({ _id: doc._id }, { $set: updateData });
          log.progress(`Migrated affiliate ${doc.affiliateId} (${doc._id})`);
        }
        
        this.state.updateProgress('affiliates', true, doc._id);
        
      } catch (error) {
        log.error(`Failed to process affiliate ${doc._id}: ${error.message}`);
        this.state.updateProgress('affiliates', false, doc._id, error);
      }
    }
    
    log.success('Affiliate migration completed');
  }

  async removeCustomerPaymentData() {
    log.info('Removing deprecated customer payment data...');
    this.state.setPhase('customers');
    
    // Get query for resuming
    const query = this.state.state.customers.lastProcessedId
      ? { _id: { $gt: this.state.state.customers.lastProcessedId } }
      : {};
    
    // Add filter for documents with payment data
    query.$or = [
      { cardholderName: { $exists: true } },
      { expiryDate: { $exists: true } },
      { cardNumber: { $exists: true } },
      { billingZip: { $exists: true } }
    ];
    
    const cursor = Customer.find(query).sort({ _id: 1 }).cursor();
    
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      try {
        // Remove all payment-related fields
        await Customer.updateOne(
          { _id: doc._id },
          {
            $unset: {
              cardholderName: '',
              expiryDate: '',
              cardNumber: '',
              billingZip: ''
            }
          }
        );
        
        log.progress(`Removed payment data from customer ${doc.customerId} (${doc._id})`);
        this.state.updateProgress('customers', true, doc._id);
        
      } catch (error) {
        log.error(`Failed to process customer ${doc._id}: ${error.message}`);
        this.state.updateProgress('customers', false, doc._id, error);
      }
    }
    
    log.success('Customer payment data removal completed');
  }

  async generateReport() {
    const state = this.state.state;
    const duration = new Date() - new Date(state.startTime);
    const durationMinutes = Math.floor(duration / 60000);
    
    const report = `
${colors.bright}=== Encryption Key Migration Report ===${colors.reset}

Start Time: ${state.startTime}
End Time: ${state.completedTime || 'Not completed'}
Duration: ${durationMinutes} minutes

${colors.cyan}Affiliates:${colors.reset}
  Total: ${state.affiliates.total}
  Processed: ${state.affiliates.processed}
  Successful: ${state.affiliates.successful}
  Failed: ${state.affiliates.failed}

${colors.cyan}Customers:${colors.reset}
  Total: ${state.customers.total}
  Processed: ${state.customers.processed}
  Successful: ${state.customers.successful}
  Failed: ${state.customers.failed}

${colors.yellow}Failures:${colors.reset}
`;

    console.log(report);
    
    if (state.affiliates.failures.length > 0) {
      console.log('Affiliate Failures:');
      state.affiliates.failures.forEach(f => {
        console.log(`  - ${f.id}: ${f.error} (${f.timestamp})`);
      });
    }
    
    if (state.customers.failures.length > 0) {
      console.log('\nCustomer Failures:');
      state.customers.failures.forEach(f => {
        console.log(`  - ${f.id}: ${f.error} (${f.timestamp})`);
      });
    }
    
    // Save report to file
    const reportFile = path.join(BACKUP_DIR, `migration-report-${Date.now()}.txt`);
    fs.writeFileSync(reportFile, report);
    log.success(`Report saved to: ${reportFile}`);
  }

  async run() {
    try {
      console.log(`${colors.bright}=== WaveMAX Encryption Key Migration Tool ===${colors.reset}\n`);
      
      // Check if migration is already completed
      if (this.state.state.completed) {
        log.warning('Migration has already been completed.');
        const resume = await this.prompt('Do you want to run it again? (yes/no): ');
        if (resume.toLowerCase() !== 'yes') {
          this.rl.close();
          return;
        }
        // Reset state
        this.state = new MigrationState();
      }
      
      // Check if resuming
      if (this.state.state.phase !== 'not_started') {
        log.info(`Resuming migration from phase: ${this.state.state.phase}`);
        log.info(`Affiliates: ${this.state.state.affiliates.processed}/${this.state.state.affiliates.total}`);
        log.info(`Customers: ${this.state.state.customers.processed}/${this.state.state.customers.total}`);
        
        const resume = await this.prompt('\nContinue with previous migration? (yes/no): ');
        if (resume.toLowerCase() !== 'yes') {
          const restart = await this.prompt('Start fresh migration? (yes/no): ');
          if (restart.toLowerCase() === 'yes') {
            this.state = new MigrationState();
          } else {
            this.rl.close();
            return;
          }
        }
      }
      
      // Get encryption keys
      let oldKey, newKey;
      
      // Check for keys in environment or command line
      if (process.argv[2] && process.argv[3]) {
        oldKey = process.argv[2];
        newKey = process.argv[3];
        log.info('Using keys from command line arguments');
      } else {
        console.log('\nPlease provide the encryption keys:');
        console.log('(Keys should be 64 hexadecimal characters)');
        
        oldKey = await this.prompt('Old ENCRYPTION_KEY: ');
        newKey = await this.prompt('New ENCRYPTION_KEY: ');
      }
      
      // Validate keys
      await this.validateKeys(oldKey, newKey);
      this.migrationEncryption = new MigrationEncryption(oldKey, newKey);
      
      // Connect to database
      await this.connectDatabase();
      
      // Get totals if not already set
      if (this.state.state.affiliates.total === 0) {
        const affiliateCount = await Affiliate.countDocuments({
          $or: [
            { accountNumber: { $exists: true, $ne: null } },
            { routingNumber: { $exists: true, $ne: null } },
            { paypalEmail: { $exists: true, $ne: null } }
          ]
        });
        
        const customerCount = await Customer.countDocuments({
          $or: [
            { cardholderName: { $exists: true } },
            { expiryDate: { $exists: true } },
            { cardNumber: { $exists: true } },
            { billingZip: { $exists: true } }
          ]
        });
        
        this.state.setTotals(affiliateCount, customerCount);
        log.info(`Found ${affiliateCount} affiliates and ${customerCount} customers to process`);
      }
      
      // Create backup if starting fresh
      if (this.state.state.phase === 'not_started') {
        await this.backupData();
      }
      
      // Run migrations based on phase
      if (this.state.state.phase === 'not_started' || this.state.state.phase === 'affiliates') {
        await this.migrateAffiliates();
      }
      
      if (this.state.state.phase === 'affiliates' || this.state.state.phase === 'customers') {
        await this.removeCustomerPaymentData();
      }
      
      // Mark as completed
      this.state.markCompleted();
      
      // Generate report
      await this.generateReport();
      
      log.success('Migration completed successfully!');
      
    } catch (error) {
      log.error(`Migration failed: ${error.message}`);
      console.error(error);
    } finally {
      // Close database connection
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      this.rl.close();
    }
  }
}

// Run migration
const migration = new EncryptionKeyMigration();
migration.run();
// Initialize Default Accounts
// This module is called during database initialization to create default admin and operator accounts

const Administrator = require('./server/models/Administrator');
const Operator = require('./server/models/Operator');
const logger = require('./server/utils/logger');

async function initializeDefaultAdmin() {
  try {
    // Check if any administrator exists
    const existingAdminCount = await Administrator.countDocuments();

    if (existingAdminCount > 0) {
      logger.info('Administrator accounts already exist, skipping default admin creation');
      return;
    }

    // Create default administrator account
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@wavemaxlaundry.com';
    const defaultAdmin = new Administrator({
      firstName: 'System',
      lastName: 'Administrator',
      email: adminEmail,
      password: 'WaveMAX!2024',
      permissions: ['all'], // Super admin with all permissions
      isActive: true,
      requirePasswordChange: true // Force password change on first login
    });

    await defaultAdmin.save();

    logger.info('Default administrator account created successfully');
    logger.info(`Email: ${adminEmail}`);
    logger.info('Default Password: WaveMAX!2024 (must be changed on first login)');

    return defaultAdmin;
  } catch (error) {
    logger.error('Failed to create default administrator:', { error: error.message });
    throw error;
  }
}

async function initializeDefaultOperator() {
  try {
    // Check if any operator exists
    const existingOperatorCount = await Operator.countDocuments();

    if (existingOperatorCount > 0) {
      logger.info('Operator accounts already exist, skipping default operator creation');
      return;
    }

    // Create default operator account with 24-hour shift
    const defaultOperator = new Operator({
      firstName: 'Default',
      lastName: 'Operator',
      email: 'operator@wavemaxlaundry.com',
      username: 'operator1',
      password: 'Operator!2024',
      operatorId: 'OP001',
      shiftStart: '00:00', // Start of 24-hour shift
      shiftEnd: '23:59',   // End of 24-hour shift
      workStation: 'W1',    // Default to workstation 1
      isActive: true,
      totalOrdersProcessed: 0,
      averageProcessingTime: 0,
      qualityScore: 100     // Start with perfect quality score
    });

    await defaultOperator.save();

    logger.info('Default operator account created successfully');
    logger.info('Operator ID: OP001');
    logger.info('Username: operator1');
    logger.info('Default Password: Operator!2024');
    logger.info('Shift: 24 hours (00:00 - 23:59)');
    logger.info('Workstation: W1');

    return defaultOperator;
  } catch (error) {
    logger.error('Failed to create default operator:', { error: error.message });
    throw error;
  }
}

async function initializeDefaults() {
  try {
    // Initialize default administrator
    await initializeDefaultAdmin();
    
    // Initialize default operator
    await initializeDefaultOperator();
    
    logger.info('Default accounts initialization complete');
  } catch (error) {
    logger.error('Error during default accounts initialization:', { error: error.message });
    throw error;
  }
}

// Export functions
module.exports = { 
  initializeDefaultAdmin,
  initializeDefaultOperator,
  initializeDefaults
};

// Allow running as standalone script
if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');

  // MongoDB connection options
  const mongoOptions = {
    tls: true,
    tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
  };

  mongoose.connect(process.env.MONGODB_URI, mongoOptions)
    .then(() => {
      logger.info('Connected to MongoDB');
      return initializeDefaults();
    })
    .then(() => {
      logger.info('Default initialization complete');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Error during initialization:', { error: err.message });
      process.exit(1);
    });
}
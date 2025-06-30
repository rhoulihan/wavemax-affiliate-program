// Basic test setup
const mongoose = require('mongoose');
require('dotenv').config();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET = 'test-session-secret';

// Configure to use console transport for tests to avoid sending real emails
// but still test the email service functionality
process.env.EMAIL_PROVIDER = 'console';
process.env.EMAIL_FROM = 'test@wavemax.promo';
process.env.BASE_URL = 'https://wavemax.promo';

// Get MongoDB URI and append test database name
const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax_affiliate';
const testUri = baseUri.includes('?')
  ? baseUri.replace(/\/[^/\?]+\?/, '/wavemax_test?')
  : baseUri.replace(/\/[^/]+$/, '/wavemax_test');

// Global connection promise to prevent multiple connections
let connectionPromise = null;

// Set up MongoDB connection before tests
beforeAll(async () => {
  try {
    // Only connect if not already connected or connecting
    if (mongoose.connection.readyState === 0) {
      if (!connectionPromise) {
        connectionPromise = mongoose.connect(testUri, {
          serverSelectionTimeoutMS: 30000, // 30 second timeout
          socketTimeoutMS: 45000,
          connectTimeoutMS: 30000,
          maxPoolSize: 10,
          minPoolSize: 5
        });
      }
      await connectionPromise;
      console.log('Connected to test database:', testUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    } else if (mongoose.connection.readyState === 2) {
      // Connecting - wait for it
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
    }
    
    // Create necessary directories for file uploads
    const fs = require('fs').promises;
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads/w9');
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up after tests
afterAll(async () => {
  // Clean all collections instead of dropping database (permission issue)
  if (mongoose.connection.db) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  await mongoose.disconnect();
});

// Reset database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Also clear any indexes that might have been created
  for (const key in collections) {
    try {
      await collections[key].dropIndexes();
    } catch (error) {
      // Ignore errors from dropping indexes on _id field
    }
  }
});
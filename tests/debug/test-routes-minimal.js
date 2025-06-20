// Minimal test to debug route loading issues
const path = require('path');

console.log('Starting minimal route test...');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Test 1: Can we require express?
try {
  const express = require('express');
  console.log('✓ Express loaded successfully');
} catch (e) {
  console.log('✗ Failed to load express:', e.message);
}

// Test 2: Can we mock the payment controller?
try {
  jest.mock('../../server/controllers/paymentController', () => ({
    getConfig: jest.fn((req, res) => res.json({ success: true }))
  }));
  console.log('✓ Payment controller mocked successfully');
} catch (e) {
  console.log('✗ Failed to mock payment controller:', e.message);
}

// Test 3: Can we require the payment routes?
try {
  process.env.NODE_ENV = 'test'; // Ensure test environment
  const paymentRoutes = require('../../server/routes/paymentRoutes');
  console.log('✓ Payment routes loaded successfully');
} catch (e) {
  console.log('✗ Failed to load payment routes:', e.message);
  console.log('Stack:', e.stack);
}

console.log('Test completed.');
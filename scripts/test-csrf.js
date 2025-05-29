#!/usr/bin/env node

/**
 * CSRF Protection Test Script
 * Tests that critical endpoints require CSRF tokens
 */

const axios = require('axios');

const BASE_URL = 'https://wavemax.promo';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

async function testEndpoint(method, path, description, shouldRequireCsrf = true) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data: method !== 'GET' ? { test: true } : undefined,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });

    const requiresCsrf = response.status === 403 && 
                        response.data.code === 'CSRF_VALIDATION_FAILED';
    
    const passed = shouldRequireCsrf ? requiresCsrf : !requiresCsrf;
    
    console.log(
      `${passed ? colors.green + '✓' : colors.red + '✗'} ${method} ${path} - ${description}`,
      `(${response.status}${requiresCsrf ? ' - CSRF Required' : ''})${colors.reset}`
    );
    
    return passed;
  } catch (error) {
    console.log(
      `${colors.red}✗ ${method} ${path} - ${description} (Network Error)${colors.reset}`
    );
    return false;
  }
}

async function runTests() {
  console.log(`\\n${colors.yellow}Testing CSRF Protection on Critical Endpoints${colors.reset}\\n`);
  
  let passed = 0;
  let total = 0;
  
  // Test critical endpoints that should require CSRF
  const criticalTests = [
    ['POST', '/api/v1/orders', 'Order creation'],
    ['PUT', '/api/v1/orders/123/status', 'Order status update'],
    ['POST', '/api/v1/orders/123/cancel', 'Order cancellation'],
    ['PUT', '/api/v1/customers/123/password', 'Password change'],
    ['DELETE', '/api/v1/affiliates/123/delete-all-data', 'Data deletion'],
    ['POST', '/api/v1/administrators/operators', 'Admin operations'],
    ['POST', '/api/v1/operators/orders/123/claim', 'Operator claim'],
    ['POST', '/api/v1/auth/logout', 'Logout']
  ];
  
  console.log(`${colors.yellow}Critical Endpoints (Should Require CSRF):${colors.reset}`);
  for (const [method, path, desc] of criticalTests) {
    total++;
    if (await testEndpoint(method, path, desc, true)) passed++;
  }
  
  console.log(`\\n${colors.yellow}Excluded Endpoints (Should NOT Require CSRF):${colors.reset}`);
  
  // Test excluded endpoints
  const excludedTests = [
    ['POST', '/api/v1/auth/customer/login', 'Login endpoint'],
    ['POST', '/api/v1/customers/register', 'Registration endpoint'],
    ['GET', '/api/v1/customers/123/dashboard', 'Read-only endpoint'],
    ['GET', '/api/v1/affiliates/123/public', 'Public endpoint']
  ];
  
  for (const [method, path, desc] of excludedTests) {
    total++;
    if (await testEndpoint(method, path, desc, false)) passed++;
  }
  
  // Summary
  console.log(`\\n${colors.yellow}Test Summary:${colors.reset}`);
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`Failed: ${colors.red}${total - passed}${colors.reset}`);
  
  if (passed === total) {
    console.log(`\\n${colors.green}✓ All CSRF protection tests passed!${colors.reset}\\n`);
  } else {
    console.log(`\\n${colors.red}✗ Some CSRF protection tests failed!${colors.reset}\\n`);
  }
}

// Run tests
runTests().catch(console.error);
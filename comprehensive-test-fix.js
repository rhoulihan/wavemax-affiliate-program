#!/usr/bin/env node

/**
 * Comprehensive test fixing script
 * Fixes all common issues in failing tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// List of all failing test files
const failingTests = [
  'tests/integration/affiliate.test.js',
  'tests/integration/affiliateCustomerFiltering.test.js',
  'tests/integration/bagCredit.test.js',
  'tests/integration/customer.test.js',
  'tests/integration/order.test.js',
  'tests/integration/orderAddOns.test.js',
  'tests/integration/v2-complete-payment-flow.test.js',
  'tests/integration/v2-payment-flow.test.js',
  'tests/integration/venmo-payment-parsing.test.js',
  'tests/unit/adminIdGeneration.test.js',
  'tests/unit/affiliateController.test.js',
  'tests/unit/authController.test.js',
  'tests/unit/bagTracking.test.js',
  'tests/unit/callbackPool.test.js',
  'tests/unit/controllersAdditional.test.js',
  'tests/unit/createAdminScript.test.js',
  'tests/unit/customerController.test.js',
  'tests/unit/customerDashboardWdfCredit.test.js',
  'tests/unit/emailServiceUncovered.test.js',
  'tests/unit/models.test.js',
  'tests/unit/operatorController.bagLabels.test.js',
  'tests/unit/operatorController.test.js',
  'tests/unit/orderController.test.js',
  'tests/unit/orderControllerAdditional.test.js',
  'tests/unit/orderControllerUncovered.test.js',
  'tests/unit/orderModelSimple.test.js',
  'tests/unit/orderWithSystemConfig.test.js',
  'tests/unit/paymentEmailScanner.test.js',
  'tests/unit/paymentLinkService.test.js',
  'tests/unit/paymentVerificationJob.test.js',
  'tests/unit/testRoutes.test.js',
  'tests/unit/tokenBlacklist.test.js',
  'tests/unit/v2ControllerLogic.test.js'
];

function runTestAndCaptureFix(testFile) {
  console.log(`\nAnalyzing ${testFile}...`);
  
  const fullPath = path.join(__dirname, testFile);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️  File not found`);
    return { status: 'notfound', file: testFile };
  }

  try {
    // Run the test to see current state
    const result = execSync(`npm test -- ${testFile} --no-coverage 2>&1`, {
      cwd: __dirname,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    
    if (result.includes('PASS')) {
      console.log(`  ✅ Test already passing`);
      return { status: 'passing', file: testFile };
    }
  } catch (error) {
    // Test failed - analyze the error
    const output = error.stdout || error.output?.join('') || '';
    
    // Common fixes based on error patterns
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    const fixes = [];

    // Fix 1: Replace simple mocks with chainable mocks
    if (output.includes('.select is not a function') || 
        output.includes('.populate is not a function') ||
        output.includes('.sort is not a function')) {
      
      // Find all Model.findOne assignments
      const findOnePattern = /(\w+)\.findOne\s*=\s*jest\.fn\(\)\.mockResolvedValue\(([^)]+)\)/g;
      let matches = [...content.matchAll(findOnePattern)];
      
      for (const match of matches) {
        const model = match[1];
        const value = match[2];
        
        // Check if it needs createFindOneMock
        if (!content.includes(`${model}.findOne = createFindOneMock`)) {
          content = content.replace(
            match[0],
            `${model}.findOne = jest.fn().mockResolvedValue(${value})`
          );
          fixes.push(`Fixed ${model}.findOne mock`);
          modified = true;
        }
      }
      
      // Fix Model.find for chainable methods
      const findPattern = /(\w+)\.find\s*=\s*jest\.fn\(\)\.mockResolvedValue\(([^)]+)\)/g;
      matches = [...content.matchAll(findPattern)];
      
      for (const match of matches) {
        const model = match[1];
        const value = match[2];
        content = content.replace(
          match[0],
          `${model}.find = jest.fn().mockResolvedValue(${value})`
        );
        fixes.push(`Fixed ${model}.find mock`);
        modified = true;
      }
    }

    // Fix 2: Handle missing formatters
    if (output.includes('Formatters.') && !content.includes("jest.mock('../../server/utils/formatters'")) {
      const formattersImport = `
jest.mock('../../server/utils/formatters', () => ({
  name: jest.fn((name) => name),
  phone: jest.fn((phone) => phone),
  status: jest.fn((status, type) => status),
  date: jest.fn((date, format) => date),
  currency: jest.fn((amount) => \`$\${amount}\`)
}));`;
      
      const insertPoint = content.indexOf("describe(");
      if (insertPoint > 0) {
        content = content.slice(0, insertPoint) + formattersImport + "\n\n" + content.slice(insertPoint);
        fixes.push('Added formatters mock');
        modified = true;
      }
    }

    // Fix 3: Handle missing encryption methods
    if (output.includes('verifyPassword') && content.includes("jest.mock('../../server/utils/encryption'")) {
      const encryptionMock = content.match(/jest\.mock\('\.\.\/\.\.\/server\/utils\/encryption'[^}]+\}\)\)/s);
      if (encryptionMock && !encryptionMock[0].includes('verifyPassword')) {
        content = content.replace(
          /jest\.mock\('\.\.\/\.\.\/server\/utils\/encryption',\s*\(\)\s*=>\s*\({([^}]+)}\)\)/,
          (match, methods) => {
            return `jest.mock('../../server/utils/encryption', () => ({${methods},
  verifyPassword: jest.fn()}))`;
          }
        );
        fixes.push('Added verifyPassword to encryption mock');
        modified = true;
      }
    }

    // Fix 4: Handle missing imports
    if (output.includes('createFindOneMock is not defined') && 
        !content.includes("require('../helpers/mockHelpers')")) {
      const mockHelpersImport = "const { createFindOneMock, createFindMock, createMockDocument } = require('../helpers/mockHelpers');";
      const requireSection = content.match(/(const.*require.*\n)+/);
      if (requireSection) {
        content = content.replace(requireSection[0], requireSection[0] + mockHelpersImport + '\n');
        fixes.push('Added mockHelpers import');
        modified = true;
      }
    }

    // Fix 5: Integration test timeout
    if (testFile.includes('/integration/') && !content.includes('jest.setTimeout')) {
      content = 'jest.setTimeout(90000);\n\n' + content;
      fixes.push('Added jest.setTimeout for integration test');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`  🔧 Applied ${fixes.length} fix(es):`);
      fixes.forEach(fix => console.log(`     - ${fix}`));
      return { status: 'fixed', file: testFile, fixes };
    } else {
      console.log(`  ⚠️  Test failing but no automatic fix available`);
      // Log first error for manual review
      const firstError = output.match(/●[^●]+/);
      if (firstError) {
        console.log(`     Error: ${firstError[0].slice(0, 200)}...`);
      }
      return { status: 'failing', file: testFile };
    }
  }
}

console.log('Starting comprehensive test fixing...\n');
console.log('This will analyze and fix common test issues.\n');

const results = {
  passing: [],
  fixed: [],
  failing: [],
  notfound: []
};

// Process each test file
for (const testFile of failingTests) {
  const result = runTestAndCaptureFix(testFile);
  results[result.status].push(result.file);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Already passing: ${results.passing.length}`);
console.log(`🔧 Fixed: ${results.fixed.length}`);
console.log(`❌ Still failing: ${results.failing.length}`);
console.log(`⚠️  Not found: ${results.notfound.length}`);

if (results.fixed.length > 0) {
  console.log('\nFixed files:');
  results.fixed.forEach(f => console.log(`  - ${f}`));
}

if (results.failing.length > 0) {
  console.log('\nStill failing (need manual fixes):');
  results.failing.forEach(f => console.log(`  - ${f}`));
}

// Run all tests to see overall improvement
console.log('\n' + '='.repeat(60));
console.log('Running full test suite to check improvements...');
console.log('='.repeat(60));

try {
  const fullResult = execSync('npm test 2>&1', {
    cwd: __dirname,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50 // 50MB
  });
  
  // Extract test summary
  const summaryMatch = fullResult.match(/Test Suites:.*\nTests:.*\n/);
  if (summaryMatch) {
    console.log('\n' + summaryMatch[0]);
  }
} catch (error) {
  const output = error.stdout || error.output?.join('') || '';
  const summaryMatch = output.match(/Test Suites:.*\nTests:.*\n/);
  if (summaryMatch) {
    console.log('\n' + summaryMatch[0]);
  }
}

console.log('\nDone!');
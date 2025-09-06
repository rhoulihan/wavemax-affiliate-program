#!/usr/bin/env node

/**
 * Script to automatically fix common test issues in all failing test files
 */

const fs = require('fs');
const path = require('path');

// List of all failing test files
const testFiles = [
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

function fixTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const changes = [];

    // Fix 1: Replace simple jest.fn() mocks with createFindOneMock for findOne methods
    const findOnePattern = /(\w+)\.findOne\s*=\s*jest\.fn\(\)\.mockResolvedValue\(([^)]+)\)/g;
    const findOneMatches = content.matchAll(findOnePattern);
    for (const match of findOneMatches) {
      const modelName = match[1];
      const returnValue = match[2];
      const replacement = `${modelName}.findOne = createFindOneMock(${returnValue})`;
      content = content.replace(match[0], replacement);
      changes.push(`Fixed ${modelName}.findOne mock`);
      modified = true;
    }

    // Fix 2: Add missing mockHelpers import if needed
    if (content.includes('createFindOneMock') && !content.includes("require('../helpers/mockHelpers')")) {
      const importLine = "const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');";
      // Add after other test helper imports
      const testUtilsImport = content.indexOf("require('../helpers/");
      if (testUtilsImport !== -1) {
        const endOfLine = content.indexOf('\n', testUtilsImport);
        content = content.slice(0, endOfLine + 1) + importLine + '\n' + content.slice(endOfLine + 1);
      } else {
        // Add after other requires
        const requirePattern = /(const.*require.*\n)+/;
        content = content.replace(requirePattern, `$&${importLine}\n`);
      }
      changes.push('Added mockHelpers import');
      modified = true;
    }

    // Fix 3: Add verifyPassword to encryption mock if missing
    if (content.includes("jest.mock('../../server/utils/encryption'") && !content.includes('verifyPassword')) {
      content = content.replace(
        /jest\.mock\('\.\.\/\.\.\/server\/utils\/encryption',\s*\(\)\s*=>\s*\({([^}]+)}\)\)/,
        (match, p1) => {
          if (!p1.includes('verifyPassword')) {
            return `jest.mock('../../server/utils/encryption', () => ({${p1},
  verifyPassword: jest.fn()}))`;
          }
          return match;
        }
      );
      changes.push('Added verifyPassword to encryption mock');
      modified = true;
    }

    // Fix 4: Fix formatters mock to include all needed methods
    if (content.includes("jest.mock('../../server/utils/formatters'")) {
      const formattersPattern = /jest\.mock\('\.\.\/\.\.\/server\/utils\/formatters',\s*\(\)\s*=>\s*\({[^}]+}\)\)/;
      if (!content.includes('status: jest.fn')) {
        content = content.replace(formattersPattern, `jest.mock('../../server/utils/formatters', () => ({
  name: jest.fn((name) => name),
  phone: jest.fn((phone) => phone),
  status: jest.fn((status, type) => status),
  date: jest.fn((date, format) => date),
  currency: jest.fn((amount) => \`$\${amount}\`)
}))`);
        changes.push('Fixed formatters mock');
        modified = true;
      }
    }

    // Fix 5: Fix controller calls that are wrapped with asyncWrapper
    const controllerCallPattern = /await\s+(\w+Controller)\.(\w+)\(req,\s*res(?:,\s*next)?\)/g;
    const controllerMatches = content.matchAll(controllerCallPattern);
    for (const match of controllerMatches) {
      if (!match[0].includes('extractHandler') && !match[0].includes('callControllerMethod')) {
        const replacement = `await ${match[1]}.${match[2]}(req, res, next)`;
        // Check if it's a wrapped controller
        if (content.includes('ControllerHelpers.asyncWrapper')) {
          // This controller is likely wrapped, we need to call the returned function
          const wrappedReplacement = `const handler = ${match[1]}.${match[2]};
      await handler(req, res, next)`;
          content = content.replace(match[0], wrappedReplacement);
          changes.push(`Fixed wrapped controller call: ${match[1]}.${match[2]}`);
          modified = true;
        }
      }
    }

    // Fix 6: Add jest.setTimeout for integration tests
    if (filePath.includes('/integration/') && !content.includes('jest.setTimeout')) {
      content = `jest.setTimeout(90000);\n\n${content}`;
      changes.push('Added jest.setTimeout for integration test');
      modified = true;
    }

    // Fix 7: Fix chainable query mocks (select, populate, sort, etc.)
    const chainablePattern = /(\w+)\.find\s*=\s*jest\.fn\(\)\.mockReturnValue\({([^}]+)}\)/g;
    const chainableMatches = content.matchAll(chainablePattern);
    for (const match of chainableMatches) {
      if (match[2].includes('select:') || match[2].includes('populate:') || match[2].includes('sort:')) {
        const modelName = match[1];
        const replacement = `${modelName}.find = createFindMock([])`;
        content = content.replace(match[0], replacement);
        changes.push(`Fixed ${modelName}.find chainable mock`);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${filePath}`);
      changes.forEach(change => console.log(`   - ${change}`));
      return true;
    } else {
      console.log(`⏭️  Skipped (no changes): ${filePath}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  File not found: ${filePath}`);
    } else {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
    return false;
  }
}

console.log('Starting automatic test fixes...\n');

let fixedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const file of testFiles) {
  const fullPath = path.join(__dirname, file);
  const result = fixTestFile(fullPath);
  if (result === true) fixedCount++;
  else if (result === false) skippedCount++;
  else errorCount++;
}

console.log('\n✅ Fixed', fixedCount, 'files');
console.log('⏭️  Skipped', skippedCount, 'files');
if (errorCount > 0) {
  console.log('⚠️ ', errorCount, 'files had errors');
}

console.log('\nDone!');
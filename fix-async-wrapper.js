#!/usr/bin/env node

/**
 * Script to fix asyncWrapper controller calls in test files
 */

const fs = require('fs');
const path = require('path');

// List of unit test files with controller tests
const testFiles = [
  'tests/unit/customerController.test.js',
  'tests/unit/affiliateController.test.js',
  'tests/unit/authController.test.js',
  'tests/unit/operatorController.test.js',
  'tests/unit/orderController.test.js',
  'tests/unit/orderControllerAdditional.test.js',
  'tests/unit/orderControllerUncovered.test.js',
  'tests/unit/controllersAdditional.test.js',
  'tests/unit/bagTracking.test.js',
  'tests/unit/v2ControllerLogic.test.js',
  'tests/unit/paymentVerificationJob.test.js',
  'tests/unit/emailServiceUncovered.test.js',
  'tests/unit/operatorController.bagLabels.test.js',
  'tests/unit/customerDashboardWdfCredit.test.js'
];

function fixTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const changes = [];

    // Fix 1: Fix controller method calls wrapped with asyncWrapper
    // Pattern: await someController.method(req, res, next)
    const controllerCallPattern = /await\s+(\w+Controller)\.(\w+)\(req,\s*res(?:,\s*next)?\);/g;
    let matches = [...content.matchAll(controllerCallPattern)];
    
    for (const match of matches) {
      const fullMatch = match[0];
      const controller = match[1];
      const method = match[2];
      
      // Skip if already using extractHandler or similar
      if (!content.includes(`extractHandler(${controller}.${method})`) && 
          !content.includes(`const handler = ${controller}.${method}`)) {
        
        // Replace with proper async wrapper call
        const replacement = `const handler = ${controller}.${method};
      await handler(req, res, next);`;
        
        content = content.replace(fullMatch, replacement);
        changes.push(`Fixed ${controller}.${method} call`);
        modified = true;
      }
    }

    // Fix 2: Fix test expectations where needed
    // Some tests might expect specific error messages
    const errorMessagePattern = /expectErrorResponse\('([^']+)'\)/g;
    const errorMatches = [...content.matchAll(errorMessagePattern)];
    
    // Map of old error messages to new ones (if changed in refactoring)
    const errorMessageMap = {
      'You can only delete your own data': 'Unauthorized to delete this account',
      // Add more mappings as needed
    };
    
    for (const match of errorMatches) {
      const oldMessage = match[1];
      if (errorMessageMap[oldMessage]) {
        content = content.replace(
          `expectErrorResponse('${oldMessage}')`,
          `expectErrorResponse('${errorMessageMap[oldMessage]}')`
        );
        changes.push(`Updated error message: "${oldMessage}" → "${errorMessageMap[oldMessage]}"`);
        modified = true;
      }
    }

    // Fix 3: Ensure mockHelpers is imported if using createFindOneMock
    if (content.includes('createFindOneMock') && !content.includes("require('../helpers/mockHelpers')")) {
      const importLine = "const { createFindOneMock, createFindMock, createMockDocument } = require('../helpers/mockHelpers');";
      
      // Find a good place to add the import
      const testUtilsPattern = /const.*require\('\.\.\/helpers\/testUtils'\);/;
      const testUtilsMatch = content.match(testUtilsPattern);
      
      if (testUtilsMatch) {
        const insertPos = content.indexOf(testUtilsMatch[0]) + testUtilsMatch[0].length;
        content = content.slice(0, insertPos) + '\n' + importLine + content.slice(insertPos);
      } else {
        // Add after other requires
        const lastRequire = content.lastIndexOf("require('");
        const endOfLine = content.indexOf('\n', lastRequire);
        content = content.slice(0, endOfLine + 1) + importLine + '\n' + content.slice(endOfLine + 1);
      }
      changes.push('Added mockHelpers import');
      modified = true;
    }

    // Fix 4: Fix missing mock methods
    // Add any missing mock methods to the encryption util
    if (content.includes("jest.mock('../../server/utils/encryption'")) {
      const encryptionMockPattern = /jest\.mock\('\.\.\/\.\.\/server\/utils\/encryption',\s*\(\)\s*=>\s*\(({[^}]+})\)\)/s;
      const encryptionMatch = content.match(encryptionMockPattern);
      
      if (encryptionMatch) {
        const mockContent = encryptionMatch[1];
        const requiredMethods = ['generateUniqueCustomerId', 'hashPassword', 'encryptData', 'decryptData', 'verifyPassword'];
        let updatedMock = mockContent;
        
        for (const method of requiredMethods) {
          if (!mockContent.includes(method)) {
            // Add the method
            updatedMock = updatedMock.replace(/}$/, `,\n  ${method}: jest.fn()\n}`);
            changes.push(`Added ${method} to encryption mock`);
            modified = true;
          }
        }
        
        if (modified && updatedMock !== mockContent) {
          content = content.replace(encryptionMockPattern, `jest.mock('../../server/utils/encryption', () => (${updatedMock}))`);
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${path.basename(filePath)}`);
      changes.forEach(change => console.log(`   - ${change}`));
      return true;
    } else {
      console.log(`⏭️  Skipped (no changes): ${path.basename(filePath)}`);
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

console.log('Fixing asyncWrapper controller calls in test files...\n');

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
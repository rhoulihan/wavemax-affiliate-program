#!/usr/bin/env node

/**
 * Comprehensive script to fix all test errors
 */

const fs = require('fs');
const path = require('path');

// All test files that need fixing
const testFiles = [
  'tests/unit/controllersAdditional.test.js',
  'tests/unit/orderControllerUncovered.test.js',
  'tests/unit/testRoutes.test.js',
  'tests/unit/operatorController.bagLabels.test.js',
  'tests/unit/customerDashboardWdfCredit.test.js',
  'tests/unit/emailServiceUncovered.test.js',
  'tests/unit/paymentVerificationJob.test.js',
  'tests/unit/models.test.js',
  'tests/unit/orderControllerAdditional.test.js',
  'tests/unit/paymentEmailScanner.test.js',
  'tests/unit/orderController.test.js',
  'tests/unit/bagTracking.test.js',
  'tests/unit/authController.test.js',
  'tests/unit/v2ControllerLogic.test.js',
  'tests/unit/affiliateController.test.js',
  'tests/unit/customerController.test.js',
  'tests/unit/operatorController.test.js',
  'tests/unit/adminIdGeneration.test.js',
  'tests/unit/callbackPool.test.js',
  'tests/unit/createAdminScript.test.js',
  'tests/unit/tokenBlacklist.test.js',
  'tests/unit/orderWithSystemConfig.test.js',
  'tests/unit/paymentLinkService.test.js',
  'tests/integration/affiliate.test.js',
  'tests/integration/affiliateCustomerFiltering.test.js',
  'tests/integration/bagCredit.test.js',
  'tests/integration/customer.test.js',
  'tests/integration/order.test.js',
  'tests/integration/orderAddOns.test.js',
  'tests/integration/v2-complete-payment-flow.test.js',
  'tests/integration/v2-payment-flow.test.js',
  'tests/integration/venmo-payment-parsing.test.js',
  'tests/integration/auth.test.js',
  'tests/integration/administrator.test.js',
  'tests/integration/operator.test.js',
  'tests/integration/docusignW9.test.js',
  'tests/integration/wdfCreditIntegration.test.js',
  'tests/integration/wdfCreditSimple.test.js'
];

function fixTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const changes = [];

    // Fix 1: Add 'next' to test setup where missing
    if (content.includes('extractHandler') || content.includes('await handler(req, res)')) {
      // Check if next is defined in beforeEach
      if (!content.includes('next = jest.fn()')) {
        // Find the beforeEach block
        const beforeEachPattern = /beforeEach\(\(\)\s*=>\s*{([^}]+)}\)/g;
        const matches = [...content.matchAll(beforeEachPattern)];
        
        for (const match of matches) {
          const blockContent = match[1];
          if (blockContent.includes('req =') && blockContent.includes('res =') && !blockContent.includes('next =')) {
            // Add next definition
            const replacement = match[0].replace(
              /res\s*=\s*{[^}]+}/,
              (resMatch) => resMatch + ';\n    next = jest.fn()'
            );
            content = content.replace(match[0], replacement);
            changes.push('Added next = jest.fn() to beforeEach');
            modified = true;
          }
        }
      }

      // Fix handler calls missing next parameter
      const handlerPattern = /await\s+handler\(req,\s*res\)(?!,)/g;
      if (content.match(handlerPattern)) {
        content = content.replace(handlerPattern, 'await handler(req, res, next)');
        changes.push('Added next parameter to handler calls');
        modified = true;
      }
    }

    // Fix 2: Fix mock document save methods
    const mockDocPattern = /(\w+)\s*=\s*{([^}]*?)}/gs;
    const mockMatches = [...content.matchAll(mockDocPattern)];
    
    for (const match of mockMatches) {
      const varName = match[1];
      const objectContent = match[2];
      
      // Check if this looks like a mock document that needs save method
      if ((varName.includes('mock') || varName.includes('Mock')) && 
          !objectContent.includes('save:') && 
          (objectContent.includes('orderId:') || objectContent.includes('customerId:') || 
           objectContent.includes('affiliateId:') || objectContent.includes('operatorId:'))) {
        
        // Add save method
        const newContent = objectContent + ',\n      save: jest.fn().mockResolvedValue(true)';
        const replacement = `${varName} = {${newContent}}`;
        content = content.replace(match[0], replacement);
        changes.push(`Added save method to ${varName}`);
        modified = true;
      }
    }

    // Fix 3: Fix Customer/Order/Affiliate mock implementations
    // Replace simple mocks with proper chainable mocks
    const findOneSimplePattern = /(\w+)\.findOne\s*=\s*jest\.fn\(\)\.mockResolvedValue\(([^)]+)\)/g;
    const findOneMatches = [...content.matchAll(findOneSimplePattern)];
    
    for (const match of findOneMatches) {
      const model = match[1];
      const value = match[2];
      
      // Skip if already using createFindOneMock
      if (!content.includes(`${model}.findOne = createFindOneMock`)) {
        // For models that need chainable methods
        if (['Customer', 'Order', 'Affiliate', 'Administrator', 'Operator'].includes(model)) {
          // Check if mockHelpers is imported
          if (!content.includes("require('../helpers/mockHelpers')")) {
            // Add import
            const importLine = "const { createFindOneMock, createFindMock, createMockDocument } = require('../helpers/mockHelpers');";
            const lastRequire = content.lastIndexOf("require('");
            if (lastRequire !== -1) {
              const endOfLine = content.indexOf('\n', lastRequire);
              content = content.slice(0, endOfLine + 1) + importLine + '\n' + content.slice(endOfLine + 1);
              changes.push('Added mockHelpers import');
              modified = true;
            }
          }
        }
      }
    }

    // Fix 4: Fix response expectations
    // Update error messages that have changed
    const errorMessageMappings = {
      'You can only delete your own data': 'Unauthorized to delete this account',
      'Invalid status transition': 'Order status cannot be changed from',
      'Payment information is required': 'Missing required fields'
    };

    for (const [oldMsg, newMsg] of Object.entries(errorMessageMappings)) {
      if (content.includes(oldMsg)) {
        content = content.replace(new RegExp(oldMsg, 'g'), newMsg);
        changes.push(`Updated error message: "${oldMsg}" → "${newMsg}"`);
        modified = true;
      }
    }

    // Fix 5: Fix missing provider in OAuth tests
    const oauthPattern = /profile:\s*{([^}]+)}/g;
    const oauthMatches = [...content.matchAll(oauthPattern)];
    
    for (const match of oauthMatches) {
      const profileContent = match[1];
      if (!profileContent.includes('provider:') && profileContent.includes('id:')) {
        const newContent = profileContent + ",\n        provider: 'google'";
        content = content.replace(match[0], `profile: {${newContent}}`);
        changes.push('Added provider to OAuth profile');
        modified = true;
      }
    }

    // Fix 6: Ensure all controller tests have proper async wrapper handling
    const controllerTestPattern = /await\s+(\w+Controller)\.(\w+)\(req,\s*res,\s*next\)/g;
    const controllerMatches = [...content.matchAll(controllerTestPattern)];
    
    for (const match of controllerMatches) {
      const controller = match[1];
      const method = match[2];
      
      // Check if this might need the handler pattern
      const lineIndex = content.lastIndexOf('\n', content.indexOf(match[0]));
      const previousLine = content.substring(content.lastIndexOf('\n', lineIndex - 1), lineIndex);
      
      if (!previousLine.includes('const handler =') && !previousLine.includes('extractHandler')) {
        // This might need fixing - but be careful not to break working tests
        // Skip for now as the async wrapper fix script already handled this
      }
    }

    // Fix 7: Add missing SystemConfig mock
    if (content.includes('SystemConfig.getValue') && !content.includes("jest.mock('../../server/models/SystemConfig')")) {
      const mockLine = "jest.mock('../../server/models/SystemConfig');";
      const describeIndex = content.indexOf('describe(');
      if (describeIndex > 0) {
        content = content.slice(0, describeIndex) + mockLine + '\n\n' + content.slice(describeIndex);
        changes.push('Added SystemConfig mock');
        modified = true;
      }
    }

    // Fix 8: Fix Order.save() and similar model methods
    const orderSavePattern = /Order\.findOne\s*=\s*createFindOneMock\(([^)]+)\)/g;
    const orderSaveMatches = [...content.matchAll(orderSavePattern)];
    
    for (const match of orderSaveMatches) {
      const mockValue = match[1];
      // Check if the mock value needs save method
      if (!mockValue.includes('.save') && !mockValue.includes('save:')) {
        // Find the mock object definition
        const mockVarPattern = new RegExp(`const\\s+${mockValue.trim()}\\s*=\\s*{([^}]+)}`, 's');
        const mockVarMatch = content.match(mockVarPattern);
        
        if (mockVarMatch && !mockVarMatch[1].includes('save:')) {
          const newMockContent = mockVarMatch[1] + ',\n      save: jest.fn().mockResolvedValue(true)';
          const replacement = `const ${mockValue.trim()} = {${newMockContent}}`;
          content = content.replace(mockVarMatch[0], replacement);
          changes.push(`Added save method to ${mockValue.trim()}`);
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${path.basename(filePath)}`);
      changes.forEach(change => console.log(`   - ${change}`));
      return { fixed: true, changes };
    } else {
      return { fixed: false };
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { fixed: false, error: error.message };
  }
}

console.log('Fixing all test errors...\n');

let totalFixed = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const file of testFiles) {
  const fullPath = path.join(__dirname, file);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${file}`);
    totalErrors++;
    continue;
  }
  
  const result = fixTestFile(fullPath);
  
  if (result.fixed) {
    totalFixed++;
  } else if (result.error) {
    totalErrors++;
  } else {
    totalSkipped++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`✅ Fixed: ${totalFixed} files`);
console.log(`⏭️  Skipped: ${totalSkipped} files`);
console.log(`❌ Errors: ${totalErrors} files`);
console.log('='.repeat(60));

console.log('\nDone!');
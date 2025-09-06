#!/usr/bin/env node

/**
 * Script to automatically fix common test issues
 */

const fs = require('fs');
const path = require('path');

// List of test files that need fixing
const testFiles = [
  'tests/unit/orderControllerUncovered.test.js',
  'tests/unit/controllersAdditional.test.js',
  'tests/unit/customerDashboardWdfCredit.test.js',
  'tests/unit/testRoutes.test.js',
  'tests/unit/operatorController.bagLabels.test.js',
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
  'tests/unit/administrator.test.js',
  'tests/integration/bagCredit.test.js',
  'tests/integration/venmo-payment-parsing.test.js',
  'tests/integration/affiliateCustomerFiltering.test.js',
  'tests/integration/docusignW9.test.js',
  'tests/integration/customer.test.js',
  'tests/integration/wdfCreditIntegration.test.js',
  'tests/integration/v2-complete-payment-flow.test.js',
  'tests/integration/wdfCreditSimple.test.js'
];

function fixTestFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Add missing imports if not present
    if (!content.includes('extractHandler') && content.includes('Controller')) {
      const importLine = "const { extractHandler } = require('../helpers/testUtils');";
      if (!content.includes(importLine)) {
        // Add after other requires
        content = content.replace(
          /(const.*require.*\n)+/,
          `$&${importLine}\n`
        );
        modified = true;
      }
    }

    if (!content.includes('expectSuccessResponse') && !content.includes('expectErrorResponse')) {
      const importLine = "const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');";
      if (!content.includes(importLine)) {
        content = content.replace(
          /(const.*require.*\n)+/,
          `$&${importLine}\n`
        );
        modified = true;
      }
    }

    if (!content.includes('createFindOneMock') && !content.includes('createMockDocument')) {
      const importLine = "const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');";
      if (!content.includes(importLine)) {
        content = content.replace(
          /(const.*require.*\n)+/,
          `$&${importLine}\n`
        );
        modified = true;
      }
    }

    // 2. Add jest.setTimeout for integration tests
    if (filePath.includes('/integration/') && !content.includes('jest.setTimeout')) {
      content = `jest.setTimeout(90000);\n\n${content}`;
      modified = true;
    }

    // 3. Fix common mock issues
    // Fix hashPassword mock
    content = content.replace(
      /encryptionUtil\.hashPassword\.mockReturnValue\('hashedPassword'\)/g,
      "encryptionUtil.hashPassword.mockReturnValue({ hash: 'hashedPassword', salt: 'salt' })"
    );
    
    // Fix Customer.findOne to use proper mock
    content = content.replace(
      /Customer\.findOne\.mockResolvedValue\(([^)]+)\)/g,
      (match, p1) => {
        if (!content.includes('Customer.findOne = createFindOneMock')) {
          return `Customer.findOne = createFindOneMock(${p1});\n      Customer.findOne.mockResolvedValue(${p1})`;
        }
        return match;
      }
    );

    // 4. Add next parameter to test setup if missing
    if (!content.includes('let req, res, next') && content.includes('let req, res')) {
      content = content.replace(/let req, res;/g, 'let req, res, next;');
      content = content.replace(
        /res = \{([^}]+)\};\s*jest\.clearAllMocks\(\);/g,
        'res = {$1};\n    next = jest.fn();\n    jest.clearAllMocks();'
      );
      modified = true;
    }

    // 5. Fix controller method calls that need extractHandler
    const controllerPatterns = [
      'getCustomerDashboardStats',
      'getCustomerProfile',
      'updateCustomerProfile',
      'getCustomerOrders',
      'deleteCustomerData',
      'updatePaymentInfo',
      'updateCustomerPassword',
      'getCustomersForAdmin'
    ];

    controllerPatterns.forEach(method => {
      const regex = new RegExp(`await ${method}\\(req, res\\)`, 'g');
      if (content.match(regex)) {
        content = content.replace(
          regex,
          `const handler = extractHandler(customerController.${method});\n      await handler(req, res, next)`
        );
        modified = true;
      }
    });

    // 6. Fix emailService method names
    content = content.replace(
      /emailService\.sendWelcomeEmail/g,
      'emailService.sendCustomerWelcomeEmail'
    );

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  Skipped (no changes): ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('Starting automatic test fixes...\n');
let fixedCount = 0;
let errorCount = 0;

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    if (fixTestFile(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`⚠️  File not found: ${file}`);
    errorCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log(`⚠️  ${errorCount} files not found`);
console.log('\nDone!');
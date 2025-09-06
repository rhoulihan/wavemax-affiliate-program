#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'tests/unit/orderController.test.js');
let content = fs.readFileSync(testFile, 'utf8');

// Find all test cases that use Customer.findOne and add Order.findOne mock
const testCases = [
  'should successfully create a new order',
  'should handle email sending failures gracefully'
];

testCases.forEach(testName => {
  // Find the test and add Order.findOne mock before Order.prototype.save
  const regex = new RegExp(
    `(it\\('${testName}'[\\s\\S]*?Affiliate\\.findOne\\.mockResolvedValue\\([^)]+\\);)\\s*(Order\\.prototype\\.save)`,
    'g'
  );
  
  content = content.replace(regex, `$1
      
      // Mock Order.findOne to return null (no active order)
      Order.findOne = jest.fn().mockResolvedValue(null);
      
      $2`);
});

// Also need to add Order constructor mock
content = content.replace(
  /Order\.prototype\.save = jest\.fn\(\)\.mockImplementation\(function\(\) {/g,
  `// Mock Order constructor
      Order.mockImplementation(() => mockOrder);
      
      Order.prototype.save = jest.fn().mockImplementation(function() {`
);

// Write the fixed content
fs.writeFileSync(testFile, content);
console.log('Fixed Order.findOne mocks in orderController.test.js');
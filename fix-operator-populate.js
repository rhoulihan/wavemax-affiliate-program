#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'tests/unit/operatorController.test.js');
let content = fs.readFileSync(testFile, 'utf8');

// Fix all populate mocks to return proper structure with toObject method
content = content.replace(
  /\/\/ Mock the populate method\s+mockOrder\.populate = jest\.fn\(\)\.mockResolvedValue\(mockOrder\);/g,
  `// Mock the populate method and toObject
      mockOrder.toObject = jest.fn().mockReturnValue(mockOrder);
      const populatedOrder = {
        ...mockOrder,
        toObject: jest.fn().mockReturnValue(mockOrder),
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '555-1234',
          toObject: jest.fn().mockReturnValue({
            firstName: 'John',
            lastName: 'Doe',
            phone: '555-1234'
          })
        }
      };
      mockOrder.populate = jest.fn().mockResolvedValue(populatedOrder);`
);

// Also fix simple populate mocks
content = content.replace(
  /mockOrder\.populate = jest\.fn\(\)\.mockResolvedValue\(mockOrder\);/g,
  `mockOrder.toObject = jest.fn().mockReturnValue(mockOrder);
      const populatedOrder = {
        ...mockOrder,
        toObject: jest.fn().mockReturnValue(mockOrder),
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '555-1234',
          toObject: jest.fn().mockReturnValue({
            firstName: 'John',
            lastName: 'Doe',
            phone: '555-1234'
          })
        }
      };
      mockOrder.populate = jest.fn().mockResolvedValue(populatedOrder);`
);

// Write the fixed content
fs.writeFileSync(testFile, content);
console.log('Fixed populate and toObject issues in operator controller tests');
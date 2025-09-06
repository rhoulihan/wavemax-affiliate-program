#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'tests/unit/operatorController.test.js');
let content = fs.readFileSync(testFile, 'utf8');

// Fix filters test for getMyOrders
content = content.replace(
  /expect\(res\.json\)\.toHaveBeenCalledWith\(\{\s+orders: mockOrders,\s+pagination: \{\s+total: 25,\s+page: 2,\s+pages: 3\s+\}\s+\}\)/,
  `expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: {
          total: 25,
          page: 2,
          pages: 3
        }
      })`
);

// Write the fixed content
fs.writeFileSync(testFile, content);
console.log('Fixed final operator controller test issues');
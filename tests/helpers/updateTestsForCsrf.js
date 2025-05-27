#!/usr/bin/env node

/**
 * This script helps identify all the request(app) calls in integration tests
 * that need to be updated to use agent and CSRF tokens
 */

const fs = require('fs');
const path = require('path');

const integrationTestsDir = path.join(__dirname, '..', 'integration');

// Read all test files
const testFiles = fs.readdirSync(integrationTestsDir)
  .filter(file => file.endsWith('.test.js'));

testFiles.forEach(file => {
  const filePath = path.join(integrationTestsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Find all lines with request(app)
  const lines = content.split('\n');
  const updates = [];

  lines.forEach((line, index) => {
    if (line.includes('request(app)') &&
        !line.includes('agent') &&
        !line.includes('// Create agent')) {

      // Check the next few lines to see the HTTP method
      for (let i = 1; i <= 5 && index + i < lines.length; i++) {
        const nextLine = lines[index + i];
        if (nextLine.match(/\.(post|put|patch|delete)\(/)) {
          updates.push({
            file,
            line: index + 1,
            method: nextLine.match(/\.(\w+)\(/)[1].toUpperCase(),
            needsCsrf: true
          });
          break;
        }
        if (nextLine.match(/\.(get|head)\(/)) {
          updates.push({
            file,
            line: index + 1,
            method: nextLine.match(/\.(\w+)\(/)[1].toUpperCase(),
            needsCsrf: false
          });
          break;
        }
      }
    }
  });

  if (updates.length > 0) {
    console.log(`\n${file}:`);
    updates.forEach(update => {
      console.log(`  Line ${update.line}: ${update.method} request ${update.needsCsrf ? 'NEEDS CSRF' : '(no CSRF needed)'}`);
    });
  }
});

console.log('\nTo update these tests:');
console.log('1. Replace request(app) with agent');
console.log('2. Add .set("X-CSRF-Token", csrfToken) for POST/PUT/PATCH/DELETE requests');
console.log('3. Make sure agent and csrfToken are initialized in beforeEach');
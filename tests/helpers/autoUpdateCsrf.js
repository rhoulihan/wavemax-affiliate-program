#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to update a test file
function updateTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Replace request(app) with agent
  const requestAppRegex = /await request\(app\)/g;
  if (requestAppRegex.test(content)) {
    content = content.replace(requestAppRegex, 'await agent');
    updated = true;
  }

  // Add CSRF token to POST/PUT/PATCH/DELETE requests
  // Look for patterns like .post( .put( etc followed by .send( or .set(
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    newLines.push(line);

    // Check if this line has a POST/PUT/PATCH/DELETE method
    if (line.match(/\.(post|put|patch|delete)\(/)) {
      // Check if CSRF token is already set in the next few lines
      let hasCsrf = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('X-CSRF-Token')) {
          hasCsrf = true;
          break;
        }
        // Stop if we hit .send( or the next test
        if (lines[j].match(/\.send\(|\.expect\(|test\(|it\(/)) {
          break;
        }
      }

      if (!hasCsrf) {
        // Find the right place to insert CSRF token
        let insertIndex = i + 1;
        while (insertIndex < lines.length &&
               lines[insertIndex].trim() &&
               !lines[insertIndex].match(/\.send\(|\.expect\(/)) {
          insertIndex++;
        }

        // Insert CSRF token line
        if (insertIndex > i + 1) {
          const indent = lines[i].match(/^(\s*)/)[1];
          const csrfLine = `${indent}      .set('X-CSRF-Token', csrfToken)`;
          newLines.splice(insertIndex - i, 0, csrfLine);
          updated = true;
          i = insertIndex; // Skip the lines we just processed
        }
      }
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`Updated: ${path.basename(filePath)}`);
  } else {
    console.log(`No updates needed: ${path.basename(filePath)}`);
  }
}

// Update all integration test files
const integrationDir = path.join(__dirname, '..', 'integration');
const testFiles = fs.readdirSync(integrationDir)
  .filter(file => file.endsWith('.test.js'));

testFiles.forEach(file => {
  const filePath = path.join(integrationDir, file);
  updateTestFile(filePath);
});

console.log('\nDone! Please review the changes and run the tests.');
const fs = require('fs');

// Read the test file
const content = fs.readFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/v2ControllerLogic.test.js', 'utf8');

// Split into lines
const lines = content.split('\n');

// Find all lines that have "const res = {" and add "const next = jest.fn();" after the closing brace
const newLines = [];
for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  
  // If we find a res definition
  if (lines[i].includes('const res = {')) {
    // Look for the closing brace (should be 3 lines down based on pattern)
    if (i + 3 < lines.length && lines[i + 3].includes('};')) {
      newLines.push(lines[i + 1]); // status line
      newLines.push(lines[i + 2]); // json line
      newLines.push(lines[i + 3]); // closing brace
      
      // Check if next line already has "const next"
      if (i + 4 < lines.length && !lines[i + 4].includes('const next')) {
        // Add const next = jest.fn(); after the closing brace
        newLines.push('      ');
        newLines.push('      const next = jest.fn();');
      }
      
      // Skip the lines we already added
      i += 3;
    }
  }
}

// Write back
fs.writeFileSync('/var/www/wavemax/wavemax-affiliate-program/tests/unit/v2ControllerLogic.test.js', newLines.join('\n'), 'utf8');

console.log('Fixed - added const next = jest.fn(); to all test cases');
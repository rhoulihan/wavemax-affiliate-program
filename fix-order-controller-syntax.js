#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'tests/unit/orderController.test.js');
let content = fs.readFileSync(testFile, 'utf8');

// Fix all lines that start with ", save: jest.fn()"
content = content.replace(/\n, save: jest\.fn/g, ',\n        save: jest.fn');

// Fix all lines that end with a property but start the next line with a comma
content = content.replace(/,\n,/g, ',');

// More comprehensive fix - look for patterns where comma is misplaced
const lines = content.split('\n');
const fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmedLine = line.trim();
  
  // If line starts with comma and contains save: jest.fn
  if (trimmedLine.startsWith(', save:')) {
    // Find the previous non-empty line and add the content there
    let j = fixedLines.length - 1;
    while (j >= 0 && fixedLines[j].trim() === '') {
      j--;
    }
    if (j >= 0) {
      // Remove trailing comma, brace or semicolon from previous line and add this content
      fixedLines[j] = fixedLines[j].replace(/[,};\s]*$/, '') + ',';
      fixedLines.push('        save: jest.fn().mockResolvedValue(true)' + (trimmedLine.endsWith('}') ? '}' : '') + (trimmedLine.endsWith(';') ? ';' : ''));
    } else {
      fixedLines.push(line);
    }
  } else {
    fixedLines.push(line);
  }
}

content = fixedLines.join('\n');

// Write the fixed content
fs.writeFileSync(testFile, content);
console.log('Fixed syntax errors in orderController.test.js');
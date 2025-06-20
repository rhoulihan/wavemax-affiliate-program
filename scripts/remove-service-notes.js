const fs = require('fs');
const path = require('path');

// List of test files to update
const testFiles = [
  'tests/integration/order.test.js',
  'tests/unit/orderController.test.js',
  'scripts/init-mongo.js'
];

// Function to remove serviceNotes from a file
function removeServiceNotes(filePath) {
  console.log(`Processing ${filePath}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Remove serviceNotes lines
  content = content.replace(/^\s*serviceNotes:\s*.*,?\s*$/gm, '');

  // Clean up any double commas that might result
  content = content.replace(/,\s*,/g, ',');

  // Clean up any trailing commas before closing braces
  content = content.replace(/,\s*}/g, '}');

  // Clean up any trailing commas before closing brackets
  content = content.replace(/,\s*]/g, ']');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${filePath}`);
  } else {
    console.log(`ℹ️  No changes needed in ${filePath}`);
  }
}

// Process all test files
testFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    removeServiceNotes(fullPath);
  } else {
    console.log(`⚠️  File not found: ${fullPath}`);
  }
});

console.log('\nDone processing files!');
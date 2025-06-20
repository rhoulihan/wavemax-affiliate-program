const fs = require('fs');
const path = require('path');

// List of test files to update
const testFiles = [
  'tests/integration/quickbooks.test.js',
  'tests/unit/orderRoutes.isolated.test.js',
  'tests/unit/orderRoutesSimple.test.js',
  'tests/unit/models.test.js',
  'tests/integration/payment.test.js',
  'tests/integration/order.test.js',
  'tests/unit/orderController.test.js',
  'tests/integration/affiliate.test.js',
  'tests/integration/customer.test.js',
  'tests/unit/orderWithSystemConfig.test.js',
  'tests/integration/systemConfig.test.js'
];

// Function to remove delivery fields from a file
function removeDeliveryFields(filePath) {
  console.log(`Processing ${filePath}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Remove deliveryDate lines
  content = content.replace(/^\s*deliveryDate:\s*.*,?\s*$/gm, '');

  // Remove deliveryTime lines
  content = content.replace(/^\s*deliveryTime:\s*.*,?\s*$/gm, '');

  // Remove specialDeliveryInstructions lines
  content = content.replace(/^\s*specialDeliveryInstructions:\s*.*,?\s*$/gm, '');

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
    removeDeliveryFields(fullPath);
  } else {
    console.log(`⚠️  File not found: ${fullPath}`);
  }
});

console.log('\nDone processing test files!');
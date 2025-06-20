#!/usr/bin/env node
/**
 * Fix DocuSign Private Key Format
 * Converts single-line private key to proper multi-line format
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== DocuSign Private Key Format Fixer ===\n');

// Read the current .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Find the DOCUSIGN_PRIVATE_KEY line
const lines = envContent.split('\n');
let keyLineIndex = -1;
let privateKeyLine = '';

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('DOCUSIGN_PRIVATE_KEY=')) {
    keyLineIndex = i;
    privateKeyLine = lines[i];
    break;
  }
}

if (keyLineIndex === -1) {
  console.log('❌ DOCUSIGN_PRIVATE_KEY not found in .env file');
  process.exit(1);
}

console.log('✅ Found DOCUSIGN_PRIVATE_KEY on line', keyLineIndex + 1);

// Extract the key value
let keyValue = privateKeyLine.substring('DOCUSIGN_PRIVATE_KEY='.length);

// Remove quotes if present
if (keyValue.startsWith('"') && keyValue.endsWith('"')) {
  keyValue = keyValue.slice(1, -1);
} else if (keyValue.startsWith('\'') && keyValue.endsWith('\'')) {
  keyValue = keyValue.slice(1, -1);
}

console.log('Current key format:');
console.log('- Length:', keyValue.length);
console.log('- Has actual newlines:', keyValue.includes('\n'));
console.log('- Has escaped newlines:', keyValue.includes('\\n'));

// Check if it needs conversion
if (!keyValue.includes('\n') && keyValue.includes('-----BEGIN') && keyValue.includes('-----END')) {
  console.log('\n⚠️  Key appears to be on a single line, converting...');

  // Replace literal \n with actual newlines
  keyValue = keyValue.replace(/\\n/g, '\n');

  // Ensure proper formatting
  if (!keyValue.includes('\n')) {
    // If still no newlines, try to insert them manually
    keyValue = keyValue
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, '-----BEGIN RSA PRIVATE KEY-----\n')
      .replace(/-----END RSA PRIVATE KEY-----/, '\n-----END RSA PRIVATE KEY-----');
  }

  console.log('\n✅ Key converted to multi-line format');
  console.log('New format has', keyValue.split('\n').length, 'lines');

  // Update the line in the env file
  lines[keyLineIndex] = `DOCUSIGN_PRIVATE_KEY="${keyValue}"`;

  // Write back to file
  fs.writeFileSync(envPath, lines.join('\n'));
  console.log('\n✅ Updated .env file with properly formatted key');

  // Verify the update
  require('dotenv').config({ override: true });
  const updatedKey = process.env.DOCUSIGN_PRIVATE_KEY;
  console.log('\nVerification:');
  console.log('- Key loaded from env:', !!updatedKey);
  console.log('- Key has newlines:', updatedKey?.includes('\n'));
  console.log('- Key lines:', updatedKey?.split('\n').length);
} else {
  console.log('\n✅ Key appears to be properly formatted already');
}

console.log('\n=== Done ===');
#!/usr/bin/env node
/**
 * Extract public key from existing private key
 */

require('dotenv').config();
const crypto = require('crypto');

let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;

if (!privateKey) {
  console.log('❌ No private key found in environment');
  process.exit(1);
}

// Remove quotes and fix newlines
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

try {
  // Extract public key from private key
  const publicKey = crypto.createPublicKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs1'
  }).export({
    type: 'spki',
    format: 'pem'
  });

  console.log('=== Public Key for your current Private Key ===\n');
  console.log('Copy and paste this into your DocuSign app RSA public key field:\n');
  console.log(publicKey);
} catch (error) {
  console.log('❌ Error extracting public key:', error.message);
}
#!/usr/bin/env node
/**
 * Generate RSA Key Pair for DocuSign JWT Authentication
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('=== DocuSign RSA Key Pair Generator ===\n');

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

console.log('✅ RSA Key Pair Generated\n');

// Save keys to files
const keysDir = path.join(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = path.join(keysDir, 'docusign_private.pem');
const publicKeyPath = path.join(keysDir, 'docusign_public.pem');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('📁 Keys saved to:');
console.log(`   Private: ${privateKeyPath}`);
console.log(`   Public:  ${publicKeyPath}`);

console.log('\n=== Instructions ===\n');

console.log('1. UPDATE YOUR .env FILE:');
console.log('   Replace the DOCUSIGN_PRIVATE_KEY value with the content below:');
console.log('   (Copy everything including BEGIN and END lines)\n');
console.log('DOCUSIGN_PRIVATE_KEY="' + privateKey.replace(/\n/g, '\\n') + '"');

console.log('\n2. UPDATE DOCUSIGN APP:');
console.log('   Go to your DocuSign app settings and update the RSA public key.');
console.log('   Copy and paste this PUBLIC KEY:\n');
console.log(publicKey);

console.log('\n3. IMPORTANT NOTES:');
console.log('   - The private key in .env should be on ONE line with \\n for newlines');
console.log('   - The public key in DocuSign should be pasted exactly as shown above');
console.log('   - After updating both, JWT authentication should work');

console.log('\n4. TEST:');
console.log('   After updating, run: node scripts/test-jwt-auth.js');
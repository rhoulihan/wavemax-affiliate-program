#!/usr/bin/env node
/**
 * Verify Live App Configuration
 */

require('dotenv').config();

console.log('=== Verifying Live DocuSign App ===\n');

console.log('Current Configuration:');
console.log('- Integration Key:', process.env.DOCUSIGN_INTEGRATION_KEY);
console.log('- OAuth URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);
console.log('- API Base URL:', process.env.DOCUSIGN_BASE_URL);

console.log('\nSince your app is now LIVE, please verify:');
console.log('1. In DocuSign Admin, confirm the app shows as "Live" not "Development"');
console.log('2. The RSA public key is still present in the app settings');
console.log('3. JWT Grant is enabled');

console.log('\nSometimes after going live, you need to:');
console.log('1. Wait 5-10 minutes for the changes to propagate');
console.log('2. Re-upload the RSA public key');
console.log('3. Grant consent again');

console.log('\nIf JWT still fails after waiting, try:');
console.log('1. Delete the RSA key in DocuSign');
console.log('2. Re-add this public key:');

const crypto = require('crypto');
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

try {
  const publicKey = crypto.createPublicKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs1'
  }).export({
    type: 'spki',
    format: 'pem'
  });

  console.log('\n' + publicKey);
} catch (error) {
  console.log('Error extracting public key:', error.message);
}

console.log('3. Save and wait a few minutes');
console.log('4. Try the JWT test again');
#!/usr/bin/env node
/**
 * Verify DocuSign Setup
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('=== DocuSign Setup Verification ===\n');

// Display all configuration
console.log('1. Configuration Values:');
console.log('   Integration Key:', process.env.DOCUSIGN_INTEGRATION_KEY);
console.log('   User ID:', process.env.DOCUSIGN_USER_ID);
console.log('   Account ID:', process.env.DOCUSIGN_ACCOUNT_ID);
console.log('   OAuth URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);
console.log('   API URL:', process.env.DOCUSIGN_BASE_URL);

// Check private key
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

// Create JWT with different scope combinations
console.log('\n2. Testing different scope combinations:');

const scopeCombinations = [
  'signature impersonation',
  'signature',
  'impersonation',
  'signature extended',
  'signature impersonation extended'
];

for (const scope of scopeCombinations) {
  console.log(`\n   Testing scope: "${scope}"`);

  const jwtPayload = {
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    aud: process.env.DOCUSIGN_OAUTH_BASE_URL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: scope
  };

  try {
    const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });
    console.log(`   ✅ JWT created with scope: ${scope}`);
    console.log(`   JWT length: ${assertion.length}`);
  } catch (error) {
    console.log(`   ❌ Failed to create JWT: ${error.message}`);
  }
}

console.log('\n3. Common Issues to Check:');
console.log('   [ ] Is the User ID correct? (Check in DocuSign admin > Users)');
console.log('   [ ] Is the app in the same environment (demo vs production)?');
console.log('   [ ] Has consent been granted for THIS specific User ID?');
console.log('   [ ] Is the Integration Key active/enabled?');
console.log('   [ ] Does the public key in DocuSign EXACTLY match the one we generated?');

console.log('\n4. Next Steps:');
console.log('   1. In DocuSign Admin, go to Users and verify the User ID matches');
console.log('   2. Check if the app shows "Consent Granted" for this user');
console.log('   3. Try regenerating the RSA keypair if needed');
console.log('   4. Make sure you saved the public key without any extra spaces/newlines');
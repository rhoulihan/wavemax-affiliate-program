#!/usr/bin/env node
/**
 * Debug JWT Authentication for DocuSign
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

console.log('=== DocuSign JWT Authentication Debug ===\n');

// Get configuration
const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const userId = process.env.DOCUSIGN_USER_ID;
const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;

// Process the private key
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

// Verify the key pair matches
console.log('1. Verifying key pair...');
try {
  const publicKeyFromPrivate = crypto.createPublicKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs1'
  }).export({
    type: 'spki',
    format: 'pem'
  });

  console.log('✅ Private key is valid');
  console.log('Public key fingerprint:', crypto.createHash('md5').update(publicKeyFromPrivate).digest('hex'));
} catch (error) {
  console.log('❌ Invalid private key:', error.message);
  process.exit(1);
}

// Try different OAuth endpoints
console.log('\n2. Testing OAuth endpoints...');
const endpoints = [
  'https://account-d.docusign.com',  // Demo
  'https://account.docusign.com'     // Production
];

async function testEndpoint(baseUrl) {
  console.log(`\nTesting ${baseUrl}...`);

  const jwtPayload = {
    iss: integrationKey,
    sub: userId,
    aud: baseUrl,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'signature impersonation'
  };

  const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

  // Decode to verify
  const decoded = jwt.decode(assertion, { complete: true });
  console.log('JWT Header:', decoded.header);

  const formData = new URLSearchParams();
  formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  formData.append('assertion', assertion);

  try {
    const response = await axios.post(`${baseUrl}/oauth/token`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Success!');
    console.log('Access token:', response.data.access_token.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
    return false;
  }
}

// Test each endpoint
(async () => {
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) {
      console.log(`\n✅ Working endpoint: ${endpoint}`);
      console.log('Update your .env file if needed: DOCUSIGN_OAUTH_BASE_URL=' + endpoint);
      break;
    }
  }
})();
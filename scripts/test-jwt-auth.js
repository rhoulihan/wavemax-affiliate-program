#!/usr/bin/env node
/**
 * Test JWT Authentication for DocuSign
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

console.log('=== DocuSign JWT Authentication Test ===\n');

// Get configuration
const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const userId = process.env.DOCUSIGN_USER_ID;
const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;

console.log('Configuration:');
console.log('- Integration Key:', integrationKey ? integrationKey.substring(0, 10) + '...' : 'NOT SET');
console.log('- User ID:', userId ? userId.substring(0, 10) + '...' : 'NOT SET');
console.log('- Account ID:', accountId ? accountId.substring(0, 10) + '...' : 'NOT SET');
console.log('- OAuth Base URL:', oauthBaseUrl);

if (!privateKey) {
  console.log('\n❌ DOCUSIGN_PRIVATE_KEY not found in environment');
  process.exit(1);
}

// Process the private key
console.log('\nPrivate Key Analysis:');
console.log('- Original length:', privateKey.length);
console.log('- Starts with quote:', privateKey.charAt(0));
console.log('- Ends with quote:', privateKey.charAt(privateKey.length - 1));

// Remove quotes if present
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
  console.log('- Removed surrounding quotes');
}

// Check for escaped newlines
if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
  console.log('- Converted escaped newlines to actual newlines');
}

const keyLines = privateKey.split('\n');
console.log('- Number of lines:', keyLines.length);
console.log('- First line:', keyLines[0]);
console.log('- Last line:', keyLines[keyLines.length - 1]);

// Create JWT
console.log('\nCreating JWT...');
const jwtPayload = {
  iss: integrationKey,
  sub: userId,
  aud: oauthBaseUrl,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  scope: 'signature impersonation'
};

console.log('JWT Payload:', JSON.stringify(jwtPayload, null, 2));

let assertion;
try {
  assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });
  console.log('\n✅ JWT created successfully');
  console.log('JWT length:', assertion.length);
} catch (error) {
  console.log('\n❌ Failed to create JWT:', error.message);
  process.exit(1);
}

// Try to authenticate
console.log('\nAttempting OAuth token request...');
const formData = new URLSearchParams();
formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
formData.append('assertion', assertion);

axios.post(`${oauthBaseUrl}/oauth/token`, formData, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})
  .then(response => {
    console.log('\n✅ Authentication successful!');
    console.log('Access token:', response.data.access_token.substring(0, 50) + '...');
    console.log('Token type:', response.data.token_type);
    console.log('Expires in:', response.data.expires_in, 'seconds');
  })
  .catch(error => {
    console.log('\n❌ Authentication failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    process.exit(1);
  });
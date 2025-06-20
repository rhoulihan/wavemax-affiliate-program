#!/usr/bin/env node
/**
 * Detailed JWT debugging
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

console.log('=== Detailed JWT Debugging ===\n');

// Get and process private key
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

// Create JWT with exact DocuSign requirements
const now = Math.floor(Date.now() / 1000);
const jwtPayload = {
  iss: process.env.DOCUSIGN_INTEGRATION_KEY,
  sub: process.env.DOCUSIGN_USER_ID,
  aud: process.env.DOCUSIGN_OAUTH_BASE_URL,
  iat: now,
  exp: now + 3600,
  scope: 'signature impersonation'
};

console.log('JWT Payload:', JSON.stringify(jwtPayload, null, 2));

// Sign the JWT
const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

// Decode to verify structure
const decoded = jwt.decode(assertion, { complete: true });
console.log('\nJWT Header:', decoded.header);
console.log('JWT Signature present:', !!decoded.signature);

// Try different grant type formats
console.log('\n=== Testing OAuth Request ===');

async function testOAuth() {
  const tokenUrl = process.env.DOCUSIGN_OAUTH_BASE_URL + '/oauth/token';

  // Method 1: URLSearchParams
  console.log('\nMethod 1: URLSearchParams');
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', assertion);

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Success!');
    console.log('Access Token:', response.data.access_token.substring(0, 50) + '...');
    return;
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
  }

  // Method 2: Form data string
  console.log('\nMethod 2: Form data string');
  try {
    const formData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`;

    const response = await axios.post(tokenUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Success!');
    console.log('Access Token:', response.data.access_token.substring(0, 50) + '...');
    return;
  } catch (error) {
    console.log('❌ Failed:', error.response?.data || error.message);
  }

  // Check if we should try production endpoint
  console.log('\n=== Checking if we should use production endpoint ===');
  console.log('Current OAuth URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);
  console.log('Current API URL:', process.env.DOCUSIGN_BASE_URL);

  if (process.env.DOCUSIGN_OAUTH_BASE_URL.includes('account-d')) {
    console.log('\n⚠️  Using demo OAuth URL but app might be in production');
    console.log('Try updating DOCUSIGN_OAUTH_BASE_URL to: https://account.docusign.com');
  }
}

testOAuth();
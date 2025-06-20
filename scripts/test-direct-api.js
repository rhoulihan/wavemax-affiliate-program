#!/usr/bin/env node
/**
 * Test Direct DocuSign API with manual token
 */

require('dotenv').config();
const axios = require('axios');

console.log('=== DocuSign Direct API Test ===\n');

console.log('Since JWT auth is having issues, let\'s verify the API endpoints are correct.\n');

console.log('Your configuration:');
console.log('- Account ID:', process.env.DOCUSIGN_ACCOUNT_ID);
console.log('- Base URL:', process.env.DOCUSIGN_BASE_URL);
console.log('- Template ID:', process.env.DOCUSIGN_W9_TEMPLATE_ID);

console.log('\nTo manually test the API:');
console.log('1. Go to: https://developers.docusign.com/tools/api-request-builder');
console.log('2. Log in with your DocuSign account');
console.log('3. Get a temporary access token');
console.log('4. We can use that to test the integration');

console.log('\nAlternatively, try this:');
console.log('1. In DocuSign Admin, delete the current RSA key');
console.log('2. Add a new RSA key (use the one we generated)');
console.log('3. Grant consent again');

console.log('\nChecking if all URLs match the demo environment...');
const isDemoAccount = process.env.DOCUSIGN_BASE_URL.includes('demo');
const isDemoOAuth = process.env.DOCUSIGN_OAUTH_BASE_URL.includes('account-d');

console.log('- API URL is demo:', isDemoAccount);
console.log('- OAuth URL is demo:', isDemoOAuth);
console.log('- URLs match:', isDemoAccount && isDemoOAuth);

if (!isDemoAccount || !isDemoOAuth) {
  console.log('\n⚠️  WARNING: URL mismatch detected!');
  console.log('Make sure both URLs are for the same environment (demo or production)');
}
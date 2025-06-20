#!/usr/bin/env node
/**
 * Get DocuSign Access Token using different methods
 */

require('dotenv').config();

console.log('=== DocuSign Access Token Methods ===\n');

console.log('Since JWT isn\'t working in development mode, here are alternatives:\n');

console.log('Option 1: OAuth Playground');
console.log('1. Go to: https://account-d.docusign.com/oauth/auth');
console.log('2. Add these parameters:');
console.log('   - response_type: token');
console.log(`   - client_id: ${process.env.DOCUSIGN_INTEGRATION_KEY}`);
console.log(`   - redirect_uri: ${process.env.DOCUSIGN_REDIRECT_URI}`);
console.log('   - scope: signature');

console.log('\nFull URL:');
const implicitUrl = `https://account-d.docusign.com/oauth/auth?response_type=token&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&scope=signature&redirect_uri=${encodeURIComponent(process.env.DOCUSIGN_REDIRECT_URI)}`;
console.log(implicitUrl);

console.log('\nThis will redirect to your callback URL with the access token in the URL fragment.');
console.log('Copy the access_token value from the URL.');

console.log('\n\nOption 2: Use DocuSign API Explorer');
console.log('1. Log into your DocuSign Developer account');
console.log('2. Go to the API Explorer section');
console.log('3. It should provide a temporary access token');

console.log('\n\nOption 3: Create a simple test to get token');
console.log('Since you have consent, we can create a temporary endpoint to capture the token.');

console.log('\n\nOnce you have an access token, run:');
console.log('node scripts/docusign-test-calls.js YOUR_ACCESS_TOKEN');
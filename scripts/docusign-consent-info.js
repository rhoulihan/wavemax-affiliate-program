#!/usr/bin/env node
/**
 * DocuSign Consent Information
 */

require('dotenv').config();

const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const userId = process.env.DOCUSIGN_USER_ID;
const redirectUri = process.env.DOCUSIGN_REDIRECT_URI;
const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';

console.log('=== DocuSign Consent Information ===\n');

console.log('Your DocuSign Configuration:');
console.log('- Integration Key:', integrationKey);
console.log('- User ID:', userId);
console.log('- OAuth Base URL:', oauthBaseUrl);
console.log('- Redirect URI:', redirectUri);

console.log('\n=== Option 1: Direct Consent URL ===');
console.log('Try opening this URL in an incognito/private browser window to avoid extension conflicts:\n');

const consentUrl = `${oauthBaseUrl}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
console.log(consentUrl);

console.log('\n=== Option 2: Manual Consent Process ===');
console.log('1. Log into your DocuSign Developer Account');
console.log('2. Go to: https://admindemo.docusign.com/apps-and-keys');
console.log('3. Find your app with Integration Key:', integrationKey);
console.log('4. Under "Service Integration", ensure JWT Grant is enabled');
console.log('5. Check that your RSA public key is uploaded');

console.log('\n=== Option 3: Use DocuSign Admin Console ===');
console.log('1. Go to: https://admindemo.docusign.com/');
console.log('2. Navigate to "Settings" > "Apps and Keys"');
console.log('3. Find your integration and check:');
console.log('   - JWT is enabled');
console.log('   - User consent is granted for User ID:', userId);
console.log('   - RSA public key matches your private key');

console.log('\n=== Option 4: Test with cURL ===');
console.log('You can test consent by running this command:\n');
console.log(`curl -X GET "${oauthBaseUrl}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=${encodeURIComponent(redirectUri)}"`);

console.log('\n=== Troubleshooting ===');
console.log('If the browser extension is causing issues:');
console.log('1. Use a different browser or incognito mode');
console.log('2. Temporarily disable browser extensions');
console.log('3. Use the DocuSign admin console directly');

console.log('\n=== Alternative: Use API Request Key ===');
console.log('For testing purposes, you can also:');
console.log('1. Go to your DocuSign sandbox account');
console.log('2. Create an API Request Logger integration');
console.log('3. Use the provided access token for testing');
#!/usr/bin/env node
/**
 * Generate DocuSign Consent URL
 * Users need to grant consent before JWT authentication can work
 */

require('dotenv').config();

const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const redirectUri = process.env.DOCUSIGN_REDIRECT_URI || 'https://www.wavemaxlaundry.com/wavemax-affiliate-program/affiliate/dashboard';
const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';

console.log('=== DocuSign Consent URL Generator ===\n');

if (!integrationKey) {
  console.log('❌ DOCUSIGN_INTEGRATION_KEY not found in environment');
  process.exit(1);
}

// Build consent URL
const consentUrl = `${oauthBaseUrl}/oauth/auth?` +
  'response_type=code&' +
  'scope=signature%20impersonation&' +
  `client_id=${integrationKey}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}`;

console.log('The DocuSign user needs to grant consent for JWT authentication.');
console.log('\nConsent URL:');
console.log(consentUrl);

console.log('\nInstructions:');
console.log('1. Have the DocuSign account admin open the above URL in a browser');
console.log('2. Log in with the DocuSign credentials');
console.log('3. Click "Accept" to grant consent for JWT authentication');
console.log('4. After consent is granted, JWT authentication should work');

console.log('\nNote: This is a one-time process per DocuSign user.');
console.log('The User ID in your .env file is:', process.env.DOCUSIGN_USER_ID);
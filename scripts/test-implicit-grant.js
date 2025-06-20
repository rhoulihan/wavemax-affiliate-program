#!/usr/bin/env node
/**
 * Generate Implicit Grant URL for DocuSign
 */

require('dotenv').config();

const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const redirectUri = process.env.DOCUSIGN_REDIRECT_URI;
const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';

console.log('=== DocuSign Implicit Grant Setup ===\n');

console.log('Since you changed to Implicit Grant, JWT authentication will not work.');
console.log('Implicit Grant requires a different approach:\n');

// Build implicit grant URL
const implicitGrantUrl = `${oauthBaseUrl}/oauth/auth?` +
  'response_type=token&' +
  'scope=signature&' +
  `client_id=${integrationKey}&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}`;

console.log('1. For Implicit Grant, users need to authorize via browser:');
console.log(implicitGrantUrl);

console.log('\n2. This will redirect to your callback URL with an access token in the URL fragment');
console.log('   Example: ' + redirectUri + '#access_token=...&token_type=bearer&expires_in=28800');

console.log('\n3. For server-side operations (like creating W9 envelopes), you need either:');
console.log('   a) Authorization Code Grant (recommended for server apps)');
console.log('   b) JWT Grant (what we were trying to use)');
console.log('   c) A stored access token from implicit grant (not recommended - tokens expire)');

console.log('\n⚠️  IMPORTANT: Implicit Grant is typically used for client-side apps.');
console.log('For a server application like this, you should use:');
console.log('- JWT Grant (for server-to-server auth) - requires RSA keys');
console.log('- Authorization Code Grant (for user auth) - requires client secret');

console.log('\nWhich grant type should we use?');
console.log('1. Keep JWT Grant (fix the key issue)');
console.log('2. Switch to Authorization Code Grant');
console.log('3. Use Implicit Grant (not recommended for servers)');
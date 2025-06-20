/**
 * Simple OAuth Test
 */

require('dotenv').config();

console.log('=== DocuSign OAuth Configuration ===\n');

console.log('1. Integration Key (Client ID):', process.env.DOCUSIGN_INTEGRATION_KEY);
console.log('2. Client Secret:', process.env.DOCUSIGN_CLIENT_SECRET ? '✓ Set' : '✗ Not Set');
console.log('3. Redirect URI:', process.env.DOCUSIGN_REDIRECT_URI);
console.log('4. OAuth Base URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);

console.log('\n=== Authorization URL ===');
const authUrl = `${process.env.DOCUSIGN_OAUTH_BASE_URL}/oauth/auth?` +
  'response_type=code&' +
  `client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&` +
  `redirect_uri=${encodeURIComponent(process.env.DOCUSIGN_REDIRECT_URI)}&` +
  'scope=signature';

console.log(authUrl);

console.log('\n=== Important Configuration Steps ===');
console.log('1. In your DocuSign app settings, ensure:');
console.log('   - Grant Type: Authorization Code Grant is enabled');
console.log('   - Redirect URI matches exactly:', process.env.DOCUSIGN_REDIRECT_URI);
console.log('   - Client Secret is generated and matches the one in .env');
console.log('\n2. The app should be in "Live" status in production');
console.log('\n3. Make sure the OAuth Base URL is correct:');
console.log('   - Demo: https://account-d.docusign.com');
console.log('   - Production: https://account.docusign.com');

console.log('\n=== Test the Flow ===');
console.log('1. Visit the authorization URL above');
console.log('2. Log in with your DocuSign credentials');
console.log('3. Grant consent to the application');
console.log('4. You should be redirected to:', process.env.DOCUSIGN_REDIRECT_URI);
console.log('5. The redirect will include ?code=xxx&state=xxx parameters');
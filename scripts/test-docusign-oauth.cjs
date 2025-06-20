/**
 * Test DocuSign OAuth Flow
 */

require('dotenv').config();
const docusignService = require('../server/services/docusignService');

async function test() {
  console.log('=== DocuSign OAuth Flow Test ===\n');

  // Check configuration
  console.log('Configuration:');
  console.log('- Integration Key:', process.env.DOCUSIGN_INTEGRATION_KEY);
  console.log('- Client Secret:', process.env.DOCUSIGN_CLIENT_SECRET ? '✓ Set' : '✗ Not Set');
  console.log('- OAuth Base URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);
  console.log('- Redirect URI:', process.env.DOCUSIGN_REDIRECT_URI);
  console.log('- User ID:', process.env.DOCUSIGN_USER_ID);
  console.log('- Account ID:', process.env.DOCUSIGN_ACCOUNT_ID);

  // Test authorization URL generation
  console.log('\n1. Testing Authorization URL Generation...');
  try {
    const authData = docusignService.getAuthorizationUrl();
    console.log('✓ Authorization URL generated successfully');
    console.log('- URL:', authData.url);
    console.log('- State:', authData.state);
    
    // Verify URL components
    const url = new URL(authData.url);
    console.log('\n2. Verifying URL Components...');
    console.log('- Host:', url.host);
    console.log('- Response Type:', url.searchParams.get('response_type'));
    console.log('- Client ID:', url.searchParams.get('client_id'));
    console.log('- Redirect URI:', url.searchParams.get('redirect_uri'));
    console.log('- Scope:', url.searchParams.get('scope'));
    console.log('- Code Challenge Method:', url.searchParams.get('code_challenge_method'));
    console.log('- Code Challenge:', url.searchParams.get('code_challenge') ? '✓ Present' : '✗ Missing');
    
    console.log('\n3. Testing Token Availability...');
    const hasToken = await docusignService.hasValidToken();
    console.log('- Has valid token:', hasToken ? '✓ Yes' : '✗ No');
    
    if (!hasToken) {
      console.log('\n✅ OAuth flow is ready. No existing token found, which is expected.');
      console.log('\nNext steps:');
      console.log('1. Visit the authorization URL above in a browser');
      console.log('2. Log in with DocuSign credentials');
      console.log('3. Grant consent to the application');
      console.log('4. You will be redirected to the callback URL');
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

test();
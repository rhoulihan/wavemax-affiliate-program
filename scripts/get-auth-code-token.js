#!/usr/bin/env node
/**
 * Get DocuSign Access Token using Authorization Code flow
 */

require('dotenv').config();
const axios = require('axios');

console.log('=== DocuSign Authorization Code Flow ===\n');

console.log('Step 1: Get Authorization Code');
console.log('Visit this URL to get an authorization code:\n');

const authUrl = `https://account-d.docusign.com/oauth/auth?response_type=code&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&scope=signature&redirect_uri=${encodeURIComponent(process.env.DOCUSIGN_REDIRECT_URI)}`;

console.log(authUrl);

console.log('\nThis will redirect to your callback URL with a code parameter.');
console.log('Copy the code value from the URL.\n');

console.log('Step 2: Exchange Code for Token');
console.log('Once you have the code, run this script with the code:\n');
console.log('node scripts/get-auth-code-token.js YOUR_CODE\n');

const code = process.argv[2];

if (code) {
  console.log('Code provided, attempting to exchange for access token...\n');

  async function exchangeCodeForToken() {
    try {
      // For authorization code without client secret, we'll try PKCE-less request
      const tokenUrl = 'https://account-d.docusign.com/oauth/token';

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('client_id', process.env.DOCUSIGN_INTEGRATION_KEY);
      params.append('redirect_uri', process.env.DOCUSIGN_REDIRECT_URI);

      console.log('Making token request...');

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('✅ Success! Access token obtained:\n');
      console.log('Access Token:', response.data.access_token);
      console.log('\nToken Type:', response.data.token_type);
      console.log('Expires In:', response.data.expires_in, 'seconds');

      console.log('\n\nNow run the test calls script:');
      console.log(`node scripts/docusign-test-calls.js ${response.data.access_token}`);

    } catch (error) {
      console.log('❌ Failed to exchange code for token');
      if (error.response) {
        console.log('Error:', error.response.data);

        if (error.response.data.error === 'invalid_client') {
          console.log('\n⚠️  This app might require a client secret for authorization code flow.');
          console.log('In DocuSign, check if your app has a client secret.');
        }
      } else {
        console.log('Error:', error.message);
      }
    }
  }

  exchangeCodeForToken();
}
#!/usr/bin/env node
/**
 * Make 20 test API calls to DocuSign to meet Go Live requirements
 */

require('dotenv').config();
const axios = require('axios');

console.log('=== DocuSign Test API Calls for Go Live ===\n');

console.log('To get a temporary access token:\n');
console.log('1. Go to: https://developers.docusign.com/tools/api-request-builder');
console.log('2. Log in with your DocuSign account');
console.log('3. Click "Get Token" to get a temporary access token');
console.log('4. Copy the access token and run this script with:');
console.log('   node scripts/docusign-test-calls.js YOUR_ACCESS_TOKEN\n');

const accessToken = process.argv[2];

if (!accessToken) {
  console.log('❌ Please provide an access token as an argument');
  console.log('Example: node scripts/docusign-test-calls.js eyJ0eXAiOiJNVCIsImFsZy...');
  process.exit(1);
}

const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

async function makeTestCalls() {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  console.log('Making 20 API calls to meet Go Live requirements...\n');

  const calls = [
    // 1-5: User Info calls
    { name: 'Get User Info 1', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/users` },
    { name: 'Get User Info 2', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/users` },
    { name: 'Get User Info 3', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/users` },
    { name: 'Get User Info 4', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/users` },
    { name: 'Get User Info 5', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/users` },

    // 6-10: Account Info calls
    { name: 'Get Account Info 1', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}` },
    { name: 'Get Account Info 2', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}` },
    { name: 'Get Account Info 3', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}` },
    { name: 'Get Account Info 4', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}` },
    { name: 'Get Account Info 5', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}` },

    // 11-15: Template calls
    { name: 'List Templates 1', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/templates` },
    { name: 'List Templates 2', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/templates` },
    { name: 'List Templates 3', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/templates` },
    { name: 'List Templates 4', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/templates` },
    { name: 'List Templates 5', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/templates` },

    // 16-20: Envelope calls
    { name: 'List Envelopes 1', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes?from_date=2024-01-01` },
    { name: 'List Envelopes 2', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes?from_date=2024-01-01` },
    { name: 'List Envelopes 3', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes?from_date=2024-01-01` },
    { name: 'List Envelopes 4', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes?from_date=2024-01-01` },
    { name: 'List Envelopes 5', method: 'GET', url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes?from_date=2024-01-01` }
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    process.stdout.write(`[${i + 1}/20] ${call.name}... `);

    try {
      const response = await axios({
        method: call.method,
        url: call.url,
        headers: headers
      });

      console.log('✅ Success');
      successCount++;

      // 2 second delay between requests to ensure they register
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('❌ Failed:', error.response?.status || error.message);
      failCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successful calls: ${successCount}/20`);
  console.log(`❌ Failed calls: ${failCount}/20`);

  if (successCount >= 20) {
    console.log('\n🎉 You have made enough successful calls to start the Go Live process!');
    console.log('Go back to your DocuSign app settings and click "Go Live"');
  } else {
    console.log(`\n⚠️  You need ${20 - successCount} more successful calls before you can go live.`);
  }
}

makeTestCalls().catch(error => {
  console.error('Error:', error.message);
});
#!/usr/bin/env node
/**
 * Test DocuSign Configuration
 * Verifies that all DocuSign environment variables are set and the API connection works
 */

require('dotenv').config();
const docusignService = require('../server/services/docusignService');

console.log('=== DocuSign Configuration Test ===\n');

// Check environment variables
console.log('1. Checking environment variables...');
const requiredEnvVars = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_BASE_URL',
  'DOCUSIGN_OAUTH_BASE_URL',
  'DOCUSIGN_W9_TEMPLATE_ID',
  'DOCUSIGN_WEBHOOK_SECRET',
  'DOCUSIGN_REDIRECT_URI',
  'DOCUSIGN_PRIVATE_KEY'
];

let allVarsSet = true;
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    allVarsSet = false;
  } else {
    // Mask sensitive values
    let displayValue = value;
    if (varName.includes('KEY') || varName.includes('SECRET')) {
      displayValue = value.substring(0, 10) + '...' + (value.length > 20 ? value.substring(value.length - 5) : '');
    } else if (varName.includes('ID')) {
      displayValue = value.substring(0, 8) + '...';
    }
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

if (!allVarsSet) {
  console.log('\n❌ Some required environment variables are missing!');
  process.exit(1);
}

console.log('\n2. Testing DocuSign API authentication...');

// Test authentication
async function testAuth() {
  try {
    console.log('   Attempting JWT authentication...');

    // Check private key format
    const privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
    if (!privateKey) {
      console.log('❌ Private key is not defined in environment');
      return false;
    }

    // Try to parse the private key
    const keyLines = privateKey.split('\\n');
    console.log(`   Private key has ${keyLines.length} lines`);

    // Check if it needs newline conversion
    if (keyLines.length === 1 && privateKey.includes('-----BEGIN') && privateKey.includes('-----END')) {
      console.log('   ⚠️  Private key appears to be on a single line, may need newline conversion');
    }

    const accessToken = await docusignService.authenticate();

    if (accessToken) {
      console.log(`✅ Authentication successful! Token: ${accessToken.substring(0, 20)}...`);
      return true;
    } else {
      console.log('❌ Authentication failed: No access token received');
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    if (error.response && error.response.data) {
      console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
    }

    // Check for common JWT errors
    if (error.message.includes('secretOrPrivateKey')) {
      console.log('   ⚠️  This appears to be a private key formatting issue');
      console.log('   Make sure the private key has proper newlines (\\n) between lines');
    }

    return false;
  }
}

// Test getting account info
async function testAccountInfo() {
  try {
    console.log('\n3. Testing account access...');
    const accessToken = await docusignService.authenticate();
    const axios = require('axios');

    const response = await axios.get(
      `${process.env.DOCUSIGN_BASE_URL}/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ Account access successful!');
    console.log(`   Account Name: ${response.data.accountName}`);
    console.log(`   Account ID: ${response.data.accountId}`);
    console.log(`   Base URI: ${response.data.baseUri}`);
    return true;
  } catch (error) {
    console.log('❌ Account access failed:', error.message);
    return false;
  }
}

// Test template access
async function testTemplate() {
  try {
    console.log('\n4. Testing W9 template access...');
    const accessToken = await docusignService.authenticate();
    const axios = require('axios');

    const response = await axios.get(
      `${process.env.DOCUSIGN_BASE_URL}/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}/templates/${process.env.DOCUSIGN_W9_TEMPLATE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('✅ Template access successful!');
    console.log(`   Template Name: ${response.data.name}`);
    console.log(`   Template ID: ${response.data.templateId}`);
    console.log(`   Status: ${response.data.status}`);
    return true;
  } catch (error) {
    console.log('❌ Template access failed:', error.message);
    if (error.response && error.response.status === 404) {
      console.log('   The W9 template ID may be incorrect or the template does not exist.');
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('\n=== Running DocuSign API Tests ===\n');

  const authSuccess = await testAuth();
  if (!authSuccess) {
    console.log('\n⚠️  Cannot proceed with other tests without authentication.');
    process.exit(1);
  }

  const accountSuccess = await testAccountInfo();
  const templateSuccess = await testTemplate();

  console.log('\n=== Test Summary ===');
  console.log(`Authentication: ${authSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Account Access: ${accountSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Template Access: ${templateSuccess ? '✅ PASS' : '❌ FAIL'}`);

  if (authSuccess && accountSuccess && templateSuccess) {
    console.log('\n✅ All tests passed! DocuSign is properly configured.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check your configuration.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
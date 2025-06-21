#!/usr/bin/env node

// Check DocuSign configuration
require('dotenv').config();

console.log('DocuSign Configuration Check:');
console.log('============================');

const requiredVars = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_CLIENT_SECRET',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_W9_TEMPLATE_ID',
  'DOCUSIGN_REDIRECT_URI'
];

const optionalVars = [
  'DOCUSIGN_BASE_URL',
  'DOCUSIGN_OAUTH_BASE_URL',
  'DOCUSIGN_WEBHOOK_SECRET',
  'DOCUSIGN_TEST_MODE'
];

let allConfigured = true;

console.log('\nRequired Environment Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✓ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`✗ ${varName}: NOT SET`);
    allConfigured = false;
  }
});

console.log('\nOptional Environment Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✓ ${varName}: ${value}`);
  } else {
    console.log(`- ${varName}: Not set (using defaults)`);
  }
});

console.log('\nConfiguration Status:', allConfigured ? '✓ All required variables are set' : '✗ Missing required variables');

if (!allConfigured) {
  console.log('\nPlease set the missing environment variables in your .env file.');
  process.exit(1);
}
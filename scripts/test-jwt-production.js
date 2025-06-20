#!/usr/bin/env node
/**
 * Test JWT with Production DocuSign - Enhanced Debugging
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

console.log('=== Production DocuSign JWT Test ===\n');

// Verify we're using production values
console.log('Environment Check:');
console.log('- OAuth URL:', process.env.DOCUSIGN_OAUTH_BASE_URL);
console.log('- Contains "account-d"?', process.env.DOCUSIGN_OAUTH_BASE_URL.includes('account-d') ? '❌ Demo' : '✅ Production');
console.log('- API URL:', process.env.DOCUSIGN_BASE_URL);
console.log('- User ID:', process.env.DOCUSIGN_USER_ID);

// Get and process private key
let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

// Verify the private key matches the public key you provided
console.log('\nVerifying RSA Key Pair...');
try {
  const publicKeyFromPrivate = crypto.createPublicKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs1'
  }).export({
    type: 'spki',
    format: 'pem'
  });

  const expectedPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzKMi8Ez9wwecL2mh9N0L
gbRqbJ1k8bTnHygBPjqMWdblbDmeZs7puYezsoogTXL0TpRzSH3qUO2k5xxUdPkY
E/oIoNIhUSmNypPgqi62ZVDK7SXUxnPg4PVQXV0xzQVpFsOJt2WYQG0Ds1TPpZYz
v2q/+Aw9wHR/F1ezGSg8JN8hJrXxOY/b9nqhoh4wQJov0xjO6PBPqOiA6XVcz/Ej
nZtkVgrMddQjZKpimUR3tUpaahebpHE3sEQHM4huH8dT2Kwr44yp0KTIzKdodwJm
r21x19bGLlbNn0FlmF4TphG9gkQFO2HPFsX/libe98HZuRST5Wom+afrKTbLOawq
oQIDAQAB
-----END PUBLIC KEY-----`;

  if (publicKeyFromPrivate.trim() === expectedPublicKey.trim()) {
    console.log('✅ Private key matches the public key in DocuSign');
  } else {
    console.log('❌ Private key does NOT match the public key in DocuSign');
    console.log('Generated public key:', publicKeyFromPrivate.substring(0, 100) + '...');
  }
} catch (error) {
  console.log('❌ Error verifying key:', error.message);
}

// Create JWT
console.log('\nCreating JWT...');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 3600;

const jwtPayload = {
  iss: process.env.DOCUSIGN_INTEGRATION_KEY,
  sub: process.env.DOCUSIGN_USER_ID,
  aud: process.env.DOCUSIGN_OAUTH_BASE_URL,
  iat: iat,
  exp: exp,
  scope: 'signature impersonation'
};

console.log('JWT Claims:');
console.log(JSON.stringify(jwtPayload, null, 2));

const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

// Make the OAuth request
console.log('\nMaking OAuth token request...');
const tokenUrl = process.env.DOCUSIGN_OAUTH_BASE_URL + '/oauth/token';

axios.post(tokenUrl,
  `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
)
  .then(response => {
    console.log('\n✅ SUCCESS! JWT Authentication working!');
    console.log('Access Token:', response.data.access_token.substring(0, 50) + '...');
    console.log('Token Type:', response.data.token_type);
    console.log('Expires In:', response.data.expires_in, 'seconds');
    console.log('\n🎉 DocuSign JWT authentication is now working in production!');
  })
  .catch(error => {
    console.log('\n❌ Authentication failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);

      if (error.response.data.error === 'consent_required') {
        console.log('\n⚠️  Consent is required. Visit:');
        console.log(`https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=${encodeURIComponent(process.env.DOCUSIGN_REDIRECT_URI)}`);
      }
    } else {
      console.log('Error:', error.message);
    }
  });
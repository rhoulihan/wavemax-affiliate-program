#!/bin/bash
# Test JWT with curl to see raw request/response

echo "=== Testing JWT Authentication with curl ==="
echo

# Load environment
source /var/www/wavemax/wavemax-affiliate-program/.env

# Generate JWT using Node.js
JWT=$(node -e "
require('dotenv').config();
const jwt = require('jsonwebtoken');

let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
if (privateKey.startsWith('\"') && privateKey.endsWith('\"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\\\n/g, '\\n');

const jwtPayload = {
  iss: process.env.DOCUSIGN_INTEGRATION_KEY,
  sub: process.env.DOCUSIGN_USER_ID,
  aud: process.env.DOCUSIGN_OAUTH_BASE_URL,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  scope: 'signature impersonation'
};

const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });
console.log(assertion);
")

echo "JWT Token generated (first 50 chars):"
echo "${JWT:0:50}..."
echo

echo "Making request to DocuSign OAuth endpoint..."
echo

curl -v -X POST "https://account-d.docusign.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=$JWT" 2>&1

echo
echo
echo "=== Debugging Info ==="
echo "Integration Key: $DOCUSIGN_INTEGRATION_KEY"
echo "User ID: $DOCUSIGN_USER_ID"
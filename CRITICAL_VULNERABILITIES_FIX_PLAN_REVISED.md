# Critical Vulnerabilities Fix Plan (Revised)

## Overview
This plan addresses the 4 critical vulnerabilities with updated requirements:
- Single operator login (not store-specific)
- Operator ID and PIN from environment variables
- OAuth token encryption only
- Specific domain whitelist for redirects

## 1. Store IP Authentication Bypass → Environment Variable Authentication

### Current Issue
- Expired tokens from store IPs are automatically renewed without re-authentication
- Provides permanent access from whitelisted IP addresses

### Solution: Environment Variable Based Authentication
Replace IP-based authentication with environment variable credentials for the single operator account.

#### Implementation Details

**Environment Variables:**
```bash
# Add to .env file
OPERATOR_ID=OP_WAVEMAX_001
OPERATOR_PIN=1234  # Will be hashed before comparison
OPERATOR_TOKEN_EXPIRY=24h
OPERATOR_PIN_REENTRY=8h
```

**Updated Authentication Flow:**
1. Operator app authenticates using OPERATOR_ID + OPERATOR_PIN from env vars
2. PIN is hashed and compared using bcrypt
3. Receives JWT token valid for 24 hours
4. Must re-enter PIN every 8 hours
5. No automatic token renewal based on IP

**Code Changes in auth.js:**
```javascript
// Remove lines 55-92 (store IP auto-renewal logic)
// Replace with:
if (decoded && decoded.exp < currentTime) {
  // Token expired - require re-authentication
  return res.status(401).json({ 
    success: false, 
    message: 'Token expired. Please login again.' 
  });
}
```

**Operator Login Endpoint Update:**
```javascript
// In authController.js - operatorLogin function
const validOperator = (
  req.body.operatorId === process.env.OPERATOR_ID &&
  await bcrypt.compare(req.body.pin, await bcrypt.hash(process.env.OPERATOR_PIN, 10))
);
```

## 2. NoSQL Injection via Regex

### Current Issue
- User input directly used in MongoDB `$regex` queries
- Vulnerable to ReDoS attacks and query manipulation

### Solution: Regex Escaping Utility
Create a centralized security utility file.

**Create new file: server/utils/securityUtils.js**
```javascript
/**
 * Escapes special regex characters to prevent ReDoS attacks
 * @param {string} string - User input to escape
 * @returns {string} - Escaped string safe for regex use
 */
function escapeRegex(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex
};
```

**Update Controllers:**
All instances of `new RegExp(searchTerm)` or `$regex: searchTerm` must use `escapeRegex()`.

Example fix in affiliateController.js:
```javascript
const { escapeRegex } = require('../utils/securityUtils');

// Before: { name: { $regex: searchTerm, $options: 'i' } }
// After: { name: { $regex: escapeRegex(searchTerm), $options: 'i' } }
```

## 3. OAuth Token Encryption

### Current Issue
- OAuth access and refresh tokens stored in plain text
- Database breach would expose all user tokens

### Solution: Encrypt Only OAuth Tokens
Use existing encryption utility to secure tokens while keeping other fields readable.

**Update passport-config.js:**
```javascript
const { encrypt, decrypt } = require('../utils/encryption');

// Google Strategy - Lines 41-42
user.socialAccounts.google.accessToken = accessToken ? encrypt(accessToken) : null;
user.socialAccounts.google.refreshToken = refreshToken ? encrypt(refreshToken) : null;

// Facebook Strategy - Lines 252-253, 372-373  
user.socialAccounts.facebook.accessToken = accessToken ? encrypt(accessToken) : null;
// Note: Facebook doesn't provide refresh tokens

// When using tokens (create utility function)
function getDecryptedTokens(socialAccount) {
  return {
    accessToken: socialAccount.accessToken ? decrypt(socialAccount.accessToken) : null,
    refreshToken: socialAccount.refreshToken ? decrypt(socialAccount.refreshToken) : null
  };
}
```

**Migration Script for Existing Tokens:**
```javascript
// scripts/encrypt-oauth-tokens.js
const { encrypt } = require('../server/utils/encryption');
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');

async function migrateTokens() {
  // Encrypt existing affiliate tokens
  const affiliates = await Affiliate.find({
    $or: [
      { 'socialAccounts.google.accessToken': { $exists: true } },
      { 'socialAccounts.facebook.accessToken': { $exists: true } }
    ]
  });

  for (const affiliate of affiliates) {
    let updated = false;
    
    if (affiliate.socialAccounts.google?.accessToken && !affiliate.socialAccounts.google.accessToken.includes(':')) {
      affiliate.socialAccounts.google.accessToken = encrypt(affiliate.socialAccounts.google.accessToken);
      updated = true;
    }
    
    if (affiliate.socialAccounts.facebook?.accessToken && !affiliate.socialAccounts.facebook.accessToken.includes(':')) {
      affiliate.socialAccounts.facebook.accessToken = encrypt(affiliate.socialAccounts.facebook.accessToken);
      updated = true;
    }
    
    if (updated) {
      await affiliate.save();
    }
  }
  
  // Repeat for customers...
}
```

## 4. Open Redirect Vulnerability

### Current Issue
- HTTPS redirect uses unvalidated host header
- Allows attackers to redirect to malicious sites

### Solution: Strict Host Validation
Implement whitelist validation for allowed domains.

**Update server.js (replace lines 119-122):**
```javascript
// Allowed hosts for redirect
const allowedHosts = [
  'wavemax.promo',
  'www.wavemax.promo',
  'wavemaxlaundry.com',
  'www.wavemaxlaundry.com'
];

// Add localhost for development
if (process.env.NODE_ENV !== 'production') {
  allowedHosts.push('localhost:3000');
}

// HTTPS redirect middleware with host validation
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    const host = req.header('host');
    
    // Validate host against whitelist
    if (!host || !allowedHosts.some(allowed => host.toLowerCase() === allowed || host.toLowerCase().startsWith(allowed + ':'))) {
      console.error(`Invalid host header attempted: ${host}`);
      return res.status(400).send('Invalid host header');
    }
    
    return res.redirect(`https://${host}${req.url}`);
  }
  next();
});
```

## Implementation Steps

### Step 1: Open Redirect Fix (30 minutes)
1. Update server.js with host validation
2. Test with curl using different host headers
3. Deploy and monitor logs

### Step 2: NoSQL Injection Fix (2 hours)
1. Create securityUtils.js
2. Search and update all regex queries:
   ```bash
   grep -r "\$regex" server/controllers/
   ```
3. Update each controller
4. Test search functionality

### Step 3: Environment Variable Authentication (3 hours)
1. Add new environment variables
2. Remove IP-based auto-renewal code
3. Update operator login to use env vars
4. Test operator authentication flow
5. Update operator terminals

### Step 4: OAuth Token Encryption (3 hours)
1. Update passport strategies
2. Create migration script
3. Test migration on staging data
4. Run migration in production
5. Test OAuth login for Google and Facebook

## Testing Checklist

- [ ] Open redirect returns 400 for invalid hosts
- [ ] Valid hosts redirect properly to HTTPS
- [ ] Search queries work with special characters
- [ ] Regex injection attempts are escaped
- [ ] Operator login works with env var credentials
- [ ] Operator tokens expire after 24 hours
- [ ] No automatic token renewal from IPs
- [ ] OAuth login works after encryption
- [ ] Existing OAuth users can still login
- [ ] New OAuth users get encrypted tokens

## Environment Variable Updates Required

Add to `.env`:
```bash
# Operator Authentication
OPERATOR_ID=OP_WAVEMAX_001
OPERATOR_PIN=7834  # Change this to a secure PIN
OPERATOR_TOKEN_EXPIRY=24h
OPERATOR_PIN_REENTRY=8h
```

## Deployment Notes

1. **Deploy in this order:**
   - Open redirect fix (no breaking changes)
   - NoSQL injection fix (no breaking changes)
   - OAuth encryption (run migration after deploy)
   - Operator authentication (coordinate with store)

2. **Rollback procedure:**
   - Each fix can be rolled back independently
   - OAuth migration has a reverse script
   - Keep old auth code commented for 24 hours

3. **Monitoring:**
   - Watch error logs for failed authentications
   - Monitor operator login success rate
   - Check for regex timeout errors
   - Track OAuth login failures

Ready to proceed with implementation?
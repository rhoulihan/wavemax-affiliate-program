# Critical Vulnerabilities Fix Plan

## Overview
This plan addresses the 4 critical vulnerabilities identified in the security audit. Each fix is designed to maintain functionality while eliminating security risks.

## 1. Store IP Authentication Bypass → Local Credentials File

### Current Issue
- Expired tokens from store IPs are automatically renewed without re-authentication
- Provides permanent access from whitelisted IP addresses

### Solution: Local Environment Credentials File
Replace IP-based authentication with a secure local credentials file for operator terminals.

#### Implementation Details

**File Location:** `/etc/wavemax/operator-credentials.json`
- Outside of web root to prevent web access
- Restricted file permissions (600 - owner read/write only)
- Store-specific credentials for each location

**File Format:**
```json
{
  "version": "1.0",
  "stores": {
    "STORE_001": {
      "operatorId": "OP123456",
      "pin": "hashed_pin_here",
      "storeId": "STORE_001",
      "storeName": "WaveMAX Downtown",
      "allowedTerminals": ["TERM_01", "TERM_02"],
      "permissions": ["scan_orders", "update_status", "quality_check"]
    }
  },
  "settings": {
    "tokenExpiry": "24h",
    "requirePinEvery": "8h",
    "maxFailedAttempts": 3
  }
}
```

**Authentication Flow:**
1. Operator app reads local credentials file
2. Authenticates with operator ID + PIN
3. Receives JWT token valid for 24 hours
4. Must re-enter PIN every 8 hours
5. No automatic token renewal

**Benefits:**
- No permanent access from IP addresses
- Store-specific credentials
- Regular re-authentication required
- Audit trail maintained

## 2. NoSQL Injection via Regex

### Current Issue
- User input directly used in MongoDB `$regex` queries
- Vulnerable to ReDoS attacks and query manipulation

### Solution: Regex Escaping Utility
Create a centralized utility to escape all regex special characters.

**Implementation:**
```javascript
// server/utils/securityUtils.js
function escapeRegex(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Usage in controllers
const searchTerm = escapeRegex(req.query.search);
const users = await User.find({ 
  name: { $regex: searchTerm, $options: 'i' } 
});
```

**Files to Update:**
- `/server/controllers/affiliateController.js`
- `/server/controllers/orderController.js` 
- `/server/controllers/customerController.js`
- `/server/controllers/administratorController.js`

## 3. OAuth Token Encryption

### Current Issue
- OAuth access and refresh tokens stored in plain text
- Database breach would expose all user tokens

### Solution: Encrypt Tokens Before Storage
Use existing encryption utility to secure tokens.

**Implementation:**
```javascript
// In passport-config.js
const { encrypt, decrypt } = require('../utils/encryption');

// Before saving
user.socialAccounts.google.accessToken = encrypt(accessToken);
user.socialAccounts.google.refreshToken = encrypt(refreshToken);

// When using tokens
const decryptedToken = decrypt(user.socialAccounts.google.accessToken);
```

**Migration Strategy:**
1. Add encryption for new tokens
2. Create migration script for existing tokens
3. Add decryption when tokens are used
4. Update all OAuth strategies

## 4. Open Redirect Vulnerability

### Current Issue
- HTTPS redirect uses unvalidated host header
- Allows attackers to redirect to malicious sites

### Solution: Host Header Validation
Implement strict host validation against whitelist.

**Implementation:**
```javascript
// server.js - Replace line 119-122
const allowedHosts = [
  'wavemax.promo',
  'www.wavemax.promo',
  'localhost:3000'
];

app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    const host = req.header('host');
    
    // Validate host against whitelist
    if (!host || !allowedHosts.includes(host.toLowerCase())) {
      return res.status(400).send('Invalid host header');
    }
    
    return res.redirect(`https://${host}${req.url}`);
  }
  next();
});
```

## Implementation Order & Timeline

### Phase 1: Immediate (Day 1)
1. **Open Redirect Fix** (1 hour)
   - Simple code change with immediate impact
   - No database changes required

2. **NoSQL Injection Fix** (3 hours)
   - Create escapeRegex utility
   - Update all controllers
   - Test search functionality

### Phase 2: Short Term (Day 2-3)
3. **OAuth Token Encryption** (4 hours)
   - Update passport strategies
   - Create migration script
   - Test OAuth login flows

4. **Store Authentication Replacement** (6 hours)
   - Create credentials file structure
   - Update auth middleware
   - Deploy to test store first
   - Roll out to all stores

### Testing Strategy
1. Unit tests for each security utility
2. Integration tests for authentication flows
3. Manual testing of OAuth login
4. Store location testing for operator app
5. Penetration testing of fixed vulnerabilities

### Rollback Plan
1. Each fix is independent and can be rolled back separately
2. Database backups before OAuth token migration
3. Keep IP whitelist as fallback during transition
4. Monitor error rates after deployment

## Success Criteria
- [ ] No automatic token renewal from IP addresses
- [ ] All regex queries properly escaped
- [ ] All OAuth tokens encrypted in database
- [ ] Host header validation prevents redirects
- [ ] All tests passing
- [ ] No functionality regression

## Questions for Review
1. Should we implement the credentials file in JSON or use environment variables?
2. What should be the token expiry time for operators (currently suggesting 24h)?
3. Should we encrypt the entire socialAccounts object or just tokens?
4. Do we need to support additional hosts in the redirect whitelist?
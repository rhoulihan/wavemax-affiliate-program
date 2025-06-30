# IMMEDIATE SECURITY ACTIONS REQUIRED

## 🚨 CRITICAL - Complete Within 24 Hours

### 1. Remove Secrets from Repository (HIGHEST PRIORITY)
```bash
# Step 1: Remove .env from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Step 2: Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore

# Step 3: Force push to remove history
git push origin --force --all
git push origin --force --tags
```

### 2. Rotate ALL Credentials
- [ ] JWT_SECRET - Generate new: `openssl rand -base64 64`
- [ ] ENCRYPTION_KEY - Generate new: `openssl rand -hex 32`  
- [ ] SESSION_SECRET - Generate new: `openssl rand -base64 32`
- [ ] CSRF_SECRET - Generate new: `openssl rand -base64 32`
- [ ] MongoDB password - Change in Atlas
- [ ] Google OAuth - Regenerate client secret
- [ ] Facebook OAuth - Regenerate app secret
- [ ] LinkedIn OAuth - Regenerate client secret
- [ ] DocuSign - Generate new integration key
- [ ] Email service - Reset SMTP password
- [ ] Paygistix - Request new API credentials

### 3. Update Production Environment
```bash
# On production server
# Create new .env file with rotated credentials
nano /var/www/wavemax/wavemax-affiliate-program/.env

# Restart application
pm2 restart wavemax --update-env
```

### 4. Disable Vulnerable Features
```javascript
// In server/middleware/auth.js
// Comment out IP-based auto-login
// Lines 125-145: Comment the isStoreOperator auto-login logic

// In server.js
// Increase security for rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Reduce from 100
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 5. Emergency Rate Limiting
Add to server.js immediately:
```javascript
// Critical endpoint protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
```

## 🔴 HIGH PRIORITY - Complete Within 48 Hours

### 6. Fix MongoDB Injection Points
```javascript
// Add to ALL find operations in controllers
const mongoSanitize = require('express-mongo-sanitize');

// Install package
npm install express-mongo-sanitize

// Add middleware
app.use(mongoSanitize());
```

### 7. Add Security Headers
```javascript
// In server.js, enhance helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 8. Secure Password Reset Tokens
```javascript
// In authController.js - forgotPassword method
const crypto = require('crypto');

// Generate secure token
const resetToken = crypto.randomBytes(32).toString('hex');
const hashedToken = crypto
  .createHash('sha256')
  .update(resetToken)
  .digest('hex');

// Store only the hash
user.resetPasswordToken = hashedToken;
user.resetPasswordExpires = Date.now() + 1800000; // 30 minutes
```

## 🟡 MEDIUM PRIORITY - Complete Within 1 Week

### 9. Implement Request Validation
```javascript
// Install validation library
npm install joi

// Add validation middleware
const Joi = require('joi');

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
  });
  
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
```

### 10. Add Security Monitoring
```javascript
// Create security event logger
const securityEvents = {
  FAILED_LOGIN: 'FAILED_LOGIN',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY'
};

const logSecurityEvent = (event, userId, metadata) => {
  console.error(`[SECURITY] ${event}`, {
    timestamp: new Date().toISOString(),
    userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...metadata
  });
};
```

## Verification Checklist

After completing each action, verify:

- [ ] .env file is removed from repository
- [ ] All credentials have been rotated
- [ ] Production server has new credentials
- [ ] Application is running with new credentials
- [ ] Rate limiting is active on auth endpoints
- [ ] Security headers are present (check with securityheaders.com)
- [ ] MongoDB queries are sanitized
- [ ] Password reset tokens are hashed
- [ ] Security monitoring is logging events

## Emergency Contacts

If you discover active exploitation:
1. Take application offline: `pm2 stop wavemax`
2. Review access logs: `tail -1000 /var/log/nginx/access.log | grep -E "(POST|PUT|DELETE)"`
3. Check for unauthorized database changes
4. Contact security team immediately

## Next Steps

1. Complete all CRITICAL actions within 24 hours
2. Schedule security audit after remediation
3. Implement continuous security monitoring
4. Plan for regular security assessments
5. Train development team on secure coding

**Remember**: Security is not a one-time fix but an ongoing process. These immediate actions address critical vulnerabilities, but the full remediation plan should be implemented systematically.
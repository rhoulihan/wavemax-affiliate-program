# Uncovered Functions Analysis - WaveMAX Affiliate Program

## Summary
- **Total Functions**: 641
- **Covered Functions**: 596 (92.97%)
- **Uncovered Functions**: 45 (7.03%)

## Uncovered Functions by Module

### Routes (21 uncovered functions)

#### 1. **administratorRoutes.js** (1 function)
- **Line 364**: Anonymous async function for POST `/api/administrators/reset-rate-limits`
  - Purpose: Reset rate limiting counters

#### 2. **docsRoutes.js** (1 function)
- **Line 9**: `serveDocsWithNonce` async middleware function
  - Purpose: Serve documentation files with CSP nonce injection

#### 3. **monitoringRoutes.js** (9 functions)
- **Line 7**: `securityHeaders` middleware function
- **Line 18**: Anonymous async function for GET `/status`
- **Line 64**: Anonymous arrow functions (6) within monitoring data generation for service history mapping
- **Line 129**: Anonymous function for 404 handler

#### 4. **testRoutes.js** (5 functions)
- **Line 10**: `testOnlyMiddleware` function
- **Line 20**: Anonymous async function for GET `/customer`
- **Line 37**: Anonymous async function for POST `/customer`
- **Line 123**: Anonymous async function for POST `/order`
- **Line 182**: Anonymous async function for DELETE `/cleanup`

#### 5. **authRoutes.js** (1 function)
- Not specifically identified in coverage report but contributes to uncovered count

#### 6. **customerRoutes.js** (2 functions)
- Not specifically identified in coverage report but contributes to uncovered count

#### 7. **socialAuthRoutes.js** (2 functions)
- **Line ~**: Anonymous function for Facebook OAuth callback
- **Line ~**: Nested callback function in Facebook authentication

### Middleware (6 uncovered functions)

#### 8. **rateLimiting.js** (6 functions)
- **Line 18**: `createMongoStore` function (partially covered)
- **Line 139**: Anonymous key generator function for `sensitiveOperationLimiter`
- **Line 156**: Anonymous key generator function for `emailVerificationLimiter`
- **Line 188**: Anonymous key generator function for `fileUploadLimiter`
- **Line 205**: Anonymous skip function for `adminOperationLimiter`
- **Line 224**: Anonymous key generator function for `adminLoginLimiter`
- **Line 233**: `createCustomLimiter` function

### Controllers (10 uncovered functions)

#### 9. **administratorController.js** (8 functions)
- **Line ~**: Anonymous arrow functions (4) in getDashboard for:
  - Mapping order affiliate IDs
  - Filtering affiliate IDs
  - Creating affiliate map
  - Formatting activity
- **Line ~**: `generateComprehensiveReport` function
- **Line ~**: Anonymous arrow functions (3) in generateComprehensiveReport for:
  - Calculating total revenue
  - Filtering active operators
  - Filtering active affiliates

#### 10. **affiliateController.js** (1 function)
- Not specifically identified but contributes to uncovered count

#### 11. **facebookDataController.js** (1 function)
- Not specifically identified but contributes to uncovered count

### Models (6 uncovered functions)

#### 12. **Payment.js** (1 function)
- **Line ~**: Pre-save middleware function

#### 13. **Operator.js** (2 functions)
- **Line ~**: `isPasswordInHistory` method
- **Line ~**: Anonymous function in password history check

#### 14. **Administrator.js** (1 function)
- **Line ~**: `setPassword` method

#### 15. **DataDeletionRequest.js** (2 functions)
- **Line ~**: `markAsFailed` method
- **Line ~**: `findStaleRequests` static method

### Utils (2 uncovered functions)

#### 16. **qrCodeGenerator.js** (1 function)
- **Line ~**: `generateQRCode` function

#### 17. **emailService.js** (1 function)
- **Line ~**: `formatSize` arrow function

## Function Categories

### By Type:
- **Route Handlers**: 15 functions
- **Middleware Functions**: 7 functions
- **Controller Methods**: 10 functions
- **Model Methods/Hooks**: 6 functions
- **Utility Functions**: 7 functions

### By Priority:
1. **High Priority** (Production-critical):
   - Rate limiting functions (6)
   - Authentication handlers (2)
   - Payment pre-save hook (1)

2. **Medium Priority** (Important features):
   - Admin dashboard functions (8)
   - Password management (3)
   - Monitoring endpoints (9)

3. **Low Priority** (Development/test features):
   - Test routes (5)
   - Documentation serving (1)
   - Utility helpers (2)

## Recommendations

### Quick Wins (Easy to test):
1. Test routes - can be covered with simple integration tests
2. Utility functions like `generateQRCode` and `formatSize`
3. Model methods like `setPassword` and `isPasswordInHistory`

### Medium Effort:
1. Rate limiting middleware - requires mocking MongoDB store
2. Admin dashboard helper functions
3. OAuth callback handlers

### Higher Effort:
1. Monitoring endpoints with complex data generation
2. Comprehensive report generation
3. Documentation serving with CSP nonce handling
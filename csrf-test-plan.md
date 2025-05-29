# CSRF Protection Test Plan

## Overview
This test plan validates CSRF protection implementation across all API endpoints after remediation.

## Test Environment Setup
1. Create test users for each role (admin, operator, affiliate, customer)
2. Set up automated testing tools (Jest/Supertest for integration tests)
3. Configure manual testing tools (Postman/cURL)
4. Prepare CSRF attack simulation scripts

## Test Categories

### 1. CSRF Token Generation Tests
- [ ] Verify `/api/csrf-token` returns valid token for authenticated users
- [ ] Verify token is tied to user session
- [ ] Verify token expires appropriately
- [ ] Verify new token generated after expiry

### 2. CSRF Token Validation Tests (Per Endpoint)

#### Critical Priority Endpoints
**Order Management**
- [ ] POST `/api/v1/orders` - Create order requires valid CSRF
- [ ] PUT `/api/v1/orders/:orderId/status` - Status update requires valid CSRF
- [ ] POST `/api/v1/orders/:orderId/cancel` - Cancellation requires valid CSRF
- [ ] PUT `/api/v1/orders/:orderId/payment-status` - Payment update requires valid CSRF
- [ ] PUT `/api/v1/orders/bulk/status` - Bulk update requires valid CSRF

**Authentication & Security**
- [ ] POST `/api/v1/auth/logout` - Logout requires valid CSRF
- [ ] PUT `/api/v1/customers/:customerId/password` - Password change requires valid CSRF
- [ ] PUT `/api/v1/administrators/config` - System config requires valid CSRF

**Data Deletion**
- [ ] DELETE `/api/v1/affiliates/:affiliateId/delete-all-data` - Requires valid CSRF
- [ ] DELETE `/api/v1/customers/:customerId/delete-all-data` - Requires valid CSRF
- [ ] DELETE `/api/v1/administrators/operators/:operatorId` - Requires valid CSRF

#### High Priority Endpoints
**Profile Management**
- [ ] PUT `/api/v1/customers/:customerId/profile` - Profile update requires valid CSRF
- [ ] PUT `/api/v1/affiliates/:affiliateId` - Affiliate update requires valid CSRF
- [ ] POST `/api/v1/customers/:customerId/bags` - Bag creation requires valid CSRF

**Operator Actions**
- [ ] POST `/api/v1/operators/orders/:orderId/claim` - Claim requires valid CSRF
- [ ] POST `/api/v1/operators/orders/:orderId/quality-check` - QC requires valid CSRF
- [ ] POST `/api/v1/operators/shift/status` - Shift update requires valid CSRF

### 3. Negative Test Cases (Should Fail)
- [ ] Request without CSRF token → 403 Forbidden
- [ ] Request with invalid CSRF token → 403 Forbidden
- [ ] Request with expired CSRF token → 403 Forbidden
- [ ] Request with CSRF token from different session → 403 Forbidden
- [ ] Cross-origin request without valid token → 403 Forbidden

### 4. Positive Test Cases (Should Pass)
- [ ] Request with valid CSRF token in header → Success
- [ ] Request with valid CSRF token in body → Success
- [ ] GET requests without CSRF token → Success (read-only)
- [ ] OPTIONS requests without CSRF token → Success (preflight)

### 5. Client-Side Integration Tests
- [ ] Affiliate dashboard can perform all actions with CSRF
- [ ] Customer dashboard can update profile with CSRF
- [ ] Administrator dashboard can manage operators with CSRF
- [ ] Operator dashboard can process orders with CSRF
- [ ] Order creation flow includes CSRF token

### 6. Authentication Flow Tests
- [ ] Login endpoints work without CSRF (rate limited)
- [ ] Registration endpoints work without CSRF (with CAPTCHA)
- [ ] Password reset flow works securely
- [ ] Token refresh maintains CSRF protection

### 7. Error Handling Tests
- [ ] CSRF failure returns clear error message
- [ ] Client receives 403 status code for CSRF failures
- [ ] Audit logs capture CSRF violations
- [ ] Error response includes CSRF token refresh hint

### 8. Performance Tests
- [ ] CSRF validation doesn't significantly impact response time
- [ ] Token generation is efficient under load
- [ ] Session storage scales appropriately

### 9. Security Validation Tests
- [ ] CSRF tokens are not predictable
- [ ] Tokens are properly bound to sessions
- [ ] No token leakage in responses
- [ ] Double-submit cookie pattern works correctly

## Test Execution Plan

### Phase 1: Unit Tests
1. Update existing unit tests to include CSRF tokens
2. Add new unit tests for CSRF middleware
3. Test CSRF token generation and validation logic

### Phase 2: Integration Tests
1. Update integration test helpers for CSRF
2. Run full integration test suite with CSRF enabled
3. Validate all endpoints require appropriate CSRF protection

### Phase 3: Manual Testing
1. Test each dashboard manually
2. Attempt CSRF attacks from external sites
3. Validate error messages and user experience

### Phase 4: Security Audit
1. Run automated security scanning tools
2. Perform penetration testing on CSRF implementation
3. Validate against OWASP guidelines

## Success Criteria
- All state-changing endpoints require valid CSRF tokens
- No false positives blocking legitimate requests
- Clear error messages for CSRF failures
- All client applications function correctly with CSRF
- Zero CSRF vulnerabilities in security audit

## Rollback Plan
1. Keep backup of original server.js configuration
2. Monitor error rates after deployment
3. Have quick rollback script ready
4. Gradual rollout with feature flags if needed
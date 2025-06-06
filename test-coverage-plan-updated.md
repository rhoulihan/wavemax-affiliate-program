# Updated Test Coverage Plan - WaveMAX Affiliate Program

## Current Status (January 6, 2025)
- **All Tests Passing**: ✅ 1,059 tests (0 failures)
- **Statement Coverage**: 77.78% (Target: 80%)
- **Branch Coverage**: 68.80% (Target: 80%)
- **Function Coverage**: 83.23% (Target: 80%) ✅
- **Line Coverage**: 77.67% (Target: 80%)

## Recent Achievements
1. ✅ Fixed all failing integration tests
2. ✅ Updated tests for new fee structure (feeBreakdown)
3. ✅ Added required location fields to affiliate tests
4. ✅ Fixed password validation expectations
5. ✅ Updated social auth tests with required fields

## Priority 1: Email Service Tests (Immediate)
**File**: `server/utils/emailService.js`
**Current Coverage**: 0% (192 lines untested)
**Target**: 80%+
**Expected Impact**: +5.5% overall coverage

### Test Implementation Plan:
```javascript
// tests/unit/emailService.test.js
describe('Email Service', () => {
  // Mock nodemailer and AWS SES
  beforeEach(() => {
    jest.mock('nodemailer');
    jest.mock('@aws-sdk/client-ses');
  });

  describe('Email Sending Functions', () => {
    // Test each email type
    test('sendAffiliateWelcomeEmail');
    test('sendCustomerOrderConfirmationEmail');
    test('sendOrderStatusUpdateEmail');
    test('sendPasswordResetEmail');
    test('sendAffiliateCommissionEmail');
  });

  describe('Template Loading', () => {
    test('should load email templates correctly');
    test('should handle missing templates');
    test('should replace placeholders');
  });

  describe('Error Handling', () => {
    test('should handle SES errors');
    test('should handle SMTP errors');
    test('should retry on transient failures');
  });
});
```

## Priority 2: Administrator Controller (High)
**File**: `server/controllers/administratorController.js`
**Current Coverage**: 68.30%
**Target**: 80%+
**Expected Impact**: +2.5% overall coverage

### Focus Areas:
1. Permission management functions
2. Error handling paths
3. Audit log operations
4. System configuration updates

### Test Template:
```javascript
describe('Administrator Controller - Enhanced Coverage', () => {
  describe('Permission Management', () => {
    test('should handle permission updates');
    test('should validate permission combinations');
    test('should handle invalid permissions');
  });

  describe('Error Scenarios', () => {
    test('should handle database errors');
    test('should handle validation errors');
    test('should handle concurrent updates');
  });
});
```

## Priority 3: Auth Controller OAuth (High)
**File**: `server/controllers/authController.js`
**Current Coverage**: 71.03%
**Target**: 80%+
**Expected Impact**: +2% overall coverage

### Missing Coverage:
- OAuth session handling
- Social authentication completion flows
- Account conflict resolution
- Customer social registration

## Priority 4: Branch Coverage Improvements
**Current**: 68.80%
**Target**: 80%+

### Strategy:
1. Focus on high-impact files with many branches
2. Add tests for error conditions
3. Cover edge cases in validation logic
4. Test all conditional paths

## Implementation Timeline

### Week 1 (Immediate)
- [ ] Email Service: Complete unit test suite
- [ ] Administrator Controller: Add missing test cases
- [ ] Run coverage analysis after each addition

### Week 2
- [ ] Auth Controller: OAuth flow tests
- [ ] Operator Controller: Add missing coverage
- [ ] Social Auth Routes: Configuration tests

### Week 3
- [ ] Branch coverage focus
- [ ] Edge case testing
- [ ] Final coverage analysis

## Test Writing Guidelines

### 1. Mock External Dependencies
```javascript
jest.mock('nodemailer');
jest.mock('@aws-sdk/client-ses');
jest.mock('../utils/emailService');
```

### 2. Test Error Paths
```javascript
test('should handle database connection errors', async () => {
  // Mock database error
  Model.findOne = jest.fn().mockRejectedValue(new Error('Connection failed'));
  
  const response = await request(app)
    .get('/api/endpoint')
    .expect(500);
    
  expect(response.body.success).toBe(false);
});
```

### 3. Test Edge Cases
```javascript
test('should handle empty input gracefully', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send({})
    .expect(400);
});
```

## Coverage Monitoring

### Run Coverage After Each Test Addition:
```bash
npm test -- --coverage --coverageReporters=text-summary
```

### Generate Full Report:
```bash
npm test -- --coverage --coverageReporters=html
```

### Check Specific File Coverage:
```bash
npm test -- --coverage --collectCoverageFrom="server/utils/emailService.js"
```

## Success Criteria
- [ ] Statement coverage ≥ 80%
- [ ] Branch coverage ≥ 80%
- [ ] Function coverage maintained ≥ 80%
- [ ] Line coverage ≥ 80%
- [ ] All tests passing
- [ ] No regression in existing tests

## Files to Exclude from Coverage (Consider)
- `server/routes/coverageRoutes.js` (dev-only utility)
- Migration scripts
- Test helpers
- Development utilities

## Notes
- Email service is the highest priority due to 0% coverage
- Focus on quality over quantity - ensure tests are meaningful
- Consider removing deprecated features instead of testing them
- Document any intentionally untested code
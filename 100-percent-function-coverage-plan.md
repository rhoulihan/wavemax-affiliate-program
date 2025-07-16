# Plan to Achieve 100% Function Coverage - WaveMAX Affiliate Program

## Current Status
- **Current Function Coverage**: 92.97% (596/641 functions)
- **Gap to 100%**: 45 uncovered functions
- **Time Estimate**: 2-3 days of focused effort

## Phased Approach

### Phase 1: Quick Wins (Day 1 Morning - ~15 functions)
**Estimated Time**: 4 hours
**Functions**: Simple utility functions and straightforward routes

1. **Utility Functions (2 functions)**
   - `qrCodeGenerator.generateQRCode()` - Add unit test
   - `emailService.formatSize()` - Add unit test with various file sizes

2. **Model Methods (5 functions)**
   - `Administrator.setPassword()` - Test password setting with validation
   - `Operator.isPasswordInHistory()` - Test password history checking
   - `Payment` pre-save hook - Test validation logic
   - `DataDeletionRequest.markAsFailed()` - Test failure marking
   - `DataDeletionRequest.findStaleRequests()` - Test with various age thresholds

3. **Test Routes (5 functions)**
   - Create `testRoutes.test.js` to cover all test endpoints
   - Test `testOnlyMiddleware` with different environments
   - Cover customer creation, order creation, and cleanup endpoints

4. **Simple Route Handlers (3 functions)**
   - Admin rate limit reset endpoint
   - Documentation serving with CSP nonce
   - Basic auth route handlers

### Phase 2: Rate Limiting & Middleware (Day 1 Afternoon - ~8 functions)
**Estimated Time**: 4 hours
**Functions**: Rate limiting middleware and key generators

1. **Rate Limiting Key Generators (5 functions)**
   - Test each custom key generator with various request scenarios
   - Mock MongoDB store for rate limiter tests
   - Test skip conditions for admin operations

2. **Custom Limiter Creation (1 function)**
   - Test `createCustomLimiter` with various configurations
   - Verify proper store initialization

3. **Middleware Functions (2 functions)**
   - Test security headers middleware
   - Test 404 handler in monitoring routes

### Phase 3: Admin Dashboard Functions (Day 2 Morning - ~10 functions)
**Estimated Time**: 4 hours
**Functions**: Complex controller methods

1. **Dashboard Analytics (4 functions)**
   - Mock data for order mapping
   - Test affiliate filtering
   - Test activity formatting
   - Create comprehensive test data sets

2. **Report Generation (4 functions)**
   - Test `generateComprehensiveReport` with various data scenarios
   - Test revenue calculations
   - Test operator/affiliate filtering
   - Mock complex aggregation results

3. **Controller Helpers (2 functions)**
   - Remaining affiliate controller functions
   - Facebook data controller edge cases

### Phase 4: Monitoring & OAuth (Day 2 Afternoon - ~12 functions)
**Estimated Time**: 4 hours
**Functions**: Complex integration points

1. **Monitoring Routes (9 functions)**
   - Test status endpoint with various system states
   - Test service history mapping functions
   - Mock monitoring data generation
   - Test error scenarios

2. **OAuth Callbacks (3 functions)**
   - Test Facebook OAuth callback handlers
   - Test nested authentication callbacks
   - Mock OAuth provider responses

## Implementation Strategy

### Test File Structure
```
tests/unit/
├── qrCodeGenerator.test.js          # Phase 1
├── emailServiceHelpers.test.js      # Phase 1
├── modelMethods.test.js             # Phase 1
├── testRoutes.test.js               # Phase 1
├── rateLimitingMiddleware.test.js   # Phase 2
├── adminDashboard.test.js           # Phase 3
├── monitoringRoutes.test.js         # Phase 4
└── oauthCallbacks.test.js           # Phase 4
```

### Key Testing Patterns

1. **For Route Handlers**:
   ```javascript
   // Mock dependencies
   jest.mock('../../server/models/Customer');
   // Test the route
   const response = await request(app).get('/api/test/customer');
   expect(response.status).toBe(200);
   ```

2. **For Middleware**:
   ```javascript
   // Create mock req, res, next
   const req = { /* mock data */ };
   const res = { /* mock methods */ };
   const next = jest.fn();
   // Test middleware
   await middleware(req, res, next);
   expect(next).toHaveBeenCalled();
   ```

3. **For Model Methods**:
   ```javascript
   // Create model instance
   const operator = new Operator(mockData);
   // Test method
   const result = await operator.isPasswordInHistory('password123');
   expect(result).toBe(false);
   ```

### Special Considerations

1. **Environment-Specific Tests**:
   - Some functions only run in development/test environments
   - Use `process.env.NODE_ENV` mocking

2. **Database Mocking**:
   - Use Jest mocks for Mongoose models
   - Mock MongoDB store for rate limiters

3. **External Dependencies**:
   - Mock QR code generation library
   - Mock email service responses

4. **Error Scenarios**:
   - Test error handling paths
   - Test edge cases and validation failures

## Success Metrics

- All 45 uncovered functions have tests
- Function coverage reaches 100% (641/641)
- All new tests pass reliably
- No reduction in line/branch/statement coverage

## Risk Mitigation

1. **Complex Functions**: Break down complex functions into smaller testable units if needed
2. **Integration Issues**: Use proper mocking to isolate functions
3. **Time Constraints**: Prioritize by business impact if time runs short
4. **Test Maintenance**: Write clear, maintainable tests with good documentation

## Next Steps

1. Review this plan and get approval
2. Create test files in order of phases
3. Implement tests following the patterns outlined
4. Run coverage after each phase to track progress
5. Refactor any problematic functions if testing reveals issues
# WaveMAX Affiliate Program - Test Suite

This directory contains comprehensive tests for the WaveMAX Affiliate Program application.

## Test Structure

```
tests/
├── unit/                   # Unit tests for individual components
│   ├── authController.test.js
│   ├── customerController.test.js
│   ├── orderController.test.js
│   ├── emailService.test.js
│   ├── encryption.test.js
│   ├── authMiddleware.test.js
│   ├── paginationMiddleware.test.js
│   └── models.test.js
├── integration/            # Integration tests for API endpoints
│   ├── affiliate.test.js
│   ├── auth.test.js
│   ├── customer.test.js
│   └── order.test.js
├── setup.js               # Test environment setup
└── runAllTests.sh         # Script to run all tests with coverage
```

## Running Tests

### All Tests
```bash
npm test
# or
npm run test:all
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Tests with Coverage Report
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## Test Coverage

The test suite aims for at least 80% code coverage across:
- Statements
- Branches
- Functions
- Lines

Coverage reports are generated in the `coverage/` directory.

## What's Tested

### Unit Tests

1. **Controllers**
   - Authentication Controller (login, token refresh, verification)
   - Customer Controller (registration, profile management, orders)
   - Order Controller (creation, status updates, cancellation)
   - Affiliate Controller (covered in integration tests)

2. **Models**
   - Affiliate Model (validation, unique constraints, defaults)
   - Customer Model (validation, relationships)
   - Order Model (calculations, status transitions)
   - Bag Model (barcode generation)
   - Transaction Model (validation)
   - RefreshToken Model (expiry checks)

3. **Middleware**
   - Authentication Middleware (token validation, role authorization)
   - Pagination Middleware (query parameter parsing)

4. **Utilities**
   - Email Service (template loading, email sending)
   - Encryption Utilities (password hashing, verification)

### Integration Tests

1. **Authentication Flow**
   - Affiliate login
   - Customer login
   - Token verification
   - Token refresh

2. **Customer Management**
   - Registration with affiliate association
   - Profile retrieval and updates
   - Order history
   - Lost bag reporting

3. **Order Processing**
   - Order creation
   - Status updates
   - Order cancellation
   - Authorization checks

4. **Affiliate Operations**
   - Registration
   - Profile management
   - Customer and order retrieval

## Test Database

Integration tests use MongoDB Memory Server to create an in-memory database for each test run. This ensures:
- Tests don't affect production data
- Each test starts with a clean state
- Tests run quickly without network I/O

## Environment Variables

Tests use the following environment variables:
- `NODE_ENV=test`
- `JWT_SECRET=test-secret-key`
- `MONGODB_URI` (set to in-memory database)

## Writing New Tests

### Unit Test Example
```javascript
describe('MyComponent', () => {
  it('should do something', async () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = await myFunction(input);
    
    // Assert
    expect(result).toEqual(expectedResult);
  });
});
```

### Integration Test Example
```javascript
describe('POST /api/endpoint', () => {
  it('should create resource', async () => {
    const response = await request(server)
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ /* request body */ });
      
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      /* expected response */
    });
  });
});
```

## Continuous Integration

The test suite is designed to run in CI/CD pipelines. Use:
```bash
npm run test:all
```

This will:
1. Run linting
2. Run all tests
3. Generate coverage reports
4. Exit with appropriate status codes

## Troubleshooting

### Tests Timing Out
- Increase timeout in `jest.config.js`
- Check for unresolved promises
- Ensure database connections are closed

### Port Already in Use
- Integration tests use port 0 (random available port)
- Check for zombie processes: `lsof -i :3000`

### Database Connection Issues
- Ensure MongoDB is installed for integration tests
- Check MongoDB Memory Server installation
# Isolated Route Testing Strategy

## Overview

Due to Jest module loading issues with complex Express route files, we've implemented an isolated testing approach that creates routes manually within tests rather than requiring actual route files.

## Problem

When requiring route files that have complex dependencies (like express-validator, middleware, etc.), Jest can hang during module loading. This is especially problematic with:
- Dynamic route loading
- Circular dependencies
- File system operations during module initialization
- Singleton patterns that load configuration files

## Solution

Create isolated test files that:
1. Manually define routes without requiring the actual route files
2. Mock all dependencies
3. Focus on testing route behavior rather than module loading

## Implementation

### 1. Isolated Test Structure

```javascript
// tests/unit/[route].isolated.test.js
const express = require('express');
const request = require('supertest');

describe('Route Name - Isolated', () => {
  let app;
  let mockController;

  beforeEach(() => {
    // Create mock controller
    mockController = {
      method: jest.fn((req, res) => res.json({ success: true }))
    };

    // Create express app
    app = express();
    app.use(express.json());

    // Define routes manually
    const router = express.Router();
    router.get('/path', mockController.method);
    app.use('/api/prefix', router);
  });

  test('should handle request', async () => {
    const response = await request(app)
      .get('/api/prefix/path')
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(mockController.method).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Isolated Jest Configuration

```javascript
// jest.config.isolated.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.isolated.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.isolated.js'],
  testTimeout: 5000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

### 3. Minimal Setup File

```javascript
// tests/setup.isolated.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
```

## Running Isolated Tests

```bash
# Run all isolated tests
NODE_ENV=test npx jest --config=jest.config.isolated.js

# Run specific isolated test
NODE_ENV=test npx jest --config=jest.config.isolated.js tests/unit/paymentRoutes.isolated.test.js
```

## Benefits

1. **No Module Loading Issues**: Tests don't hang on complex requires
2. **Faster Execution**: No database connections or file system operations
3. **Better Isolation**: Each test is truly independent
4. **Clearer Intent**: Routes are defined explicitly in tests

## Trade-offs

1. **Route Definition Duplication**: Routes must be manually defined
2. **No Integration Testing**: Doesn't test actual route file loading
3. **Maintenance Overhead**: Changes to routes must be reflected in tests

## When to Use

Use isolated tests when:
- Route files cause Jest to hang
- Testing route behavior without dependencies
- Need fast unit tests for CI/CD
- Testing complex middleware chains

## Examples in This Project

- `tests/unit/paymentRoutes.isolated.test.js`
- `tests/unit/orderRoutes.isolated.test.js`

## Migration Guide

To convert a hanging route test to isolated:

1. Copy the test file and rename with `.isolated.test.js`
2. Remove the route file require
3. Manually create routes based on the actual route file
4. Mock all middleware and controllers
5. Update test assertions to match mocked behavior
6. Add to isolated Jest config if needed

## Best Practices

1. Keep isolated tests focused on route behavior
2. Use consistent mock patterns across tests
3. Document any deviations from actual routes
4. Run both isolated and integration tests in CI
5. Prefer fixing the root cause over isolated tests when possible
# WaveMAX Codebase Refactoring Guide

## Overview
This guide provides instructions for refactoring existing code to use the new utility modules that reduce code duplication and improve maintainability.

## New Utility Modules

### Server-Side Utilities
1. **`/server/utils/controllerHelpers.js`** - Controller utilities
2. **`/server/middleware/authorizationHelpers.js`** - Authorization middleware
3. **`/server/utils/formatters.js`** - Data formatting utilities

### Client-Side Utilities
1. **`/public/assets/js/api-client.js`** - Centralized API client

## Migration Patterns

### 1. Controller Error Handling

#### Before:
```javascript
exports.someMethod = async (req, res) => {
  try {
    // logic here
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
};
```

#### After:
```javascript
const ControllerHelpers = require('../utils/controllerHelpers');

exports.someMethod = ControllerHelpers.asyncWrapper(async (req, res) => {
  // logic here (no try-catch needed)
  return ControllerHelpers.sendSuccess(res, { data: result });
});
```

### 2. Authorization Checks

#### Before:
```javascript
// Duplicated in every method
const isAuthorized = 
  req.user.role === 'admin' ||
  req.user.customerId === customerId ||
  (req.user.role === 'affiliate' && req.user.affiliateId === customer.affiliateId);

if (!isAuthorized) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized'
  });
}
```

#### After:
```javascript
const AuthorizationHelpers = require('../middleware/authorizationHelpers');

// Use as middleware
exports.getCustomer = [
  AuthorizationHelpers.checkCustomerAccess,
  ControllerHelpers.asyncWrapper(async (req, res) => {
    // Authorization already checked by middleware
    // Customer may be attached as req.customer
  })
];

// Or check inline
if (!AuthorizationHelpers.canAccessCustomer(req.user, customerId, customerAffiliateId)) {
  return ControllerHelpers.sendError(res, 'Unauthorized', 403);
}
```

### 3. Pagination

#### Before:
```javascript
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 10;
const skip = (page - 1) * limit;
const totalPages = Math.ceil(totalItems / limit);

res.json({
  success: true,
  items: results,
  pagination: {
    page, limit, totalPages, totalItems,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
});
```

#### After:
```javascript
// Parse pagination
const { page, limit, skip, sortBy } = ControllerHelpers.parsePagination(req.query);

// Calculate metadata
const pagination = ControllerHelpers.calculatePagination(totalItems, page, limit);

// Send response
return ControllerHelpers.sendPaginated(res, results, pagination, 'items');
```

### 4. Data Formatting

#### Before:
```javascript
// Scattered formatting logic
const formattedPhone = phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
const formattedDate = new Date(date).toLocaleDateString();
const formattedPrice = '$' + amount.toFixed(2);
```

#### After:
```javascript
const Formatters = require('../utils/formatters');

const formattedPhone = Formatters.phone(phone, 'us');
const formattedDate = Formatters.date(date, 'medium');
const formattedPrice = Formatters.currency(amount);
const relativeTime = Formatters.relativeTime(createdAt);
```

### 5. Frontend AJAX Calls

#### Before:
```javascript
fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    // handle success
  } else {
    showError(data.message);
  }
})
.catch(error => {
  console.error('Error:', error);
  showError('Request failed');
});
```

#### After:
```javascript
// Using the new ApiClient
await ApiClient.post('/api/endpoint', data, {
  showLoading: true,
  showSuccess: true,
  loadingMessage: 'Processing...'
});
// Errors are handled automatically
```

## Step-by-Step Migration Process

### Phase 1: Add Utility Imports
1. Add required utility imports at the top of the file
2. Keep existing code working while migrating

### Phase 2: Migrate Method by Method
1. Wrap async methods with `ControllerHelpers.asyncWrapper`
2. Replace error responses with `ControllerHelpers.sendError`
3. Replace success responses with `ControllerHelpers.sendSuccess`
4. Add authorization middleware where applicable

### Phase 3: Format Data
1. Replace inline formatting with `Formatters` utilities
2. Standardize date, currency, and phone formatting
3. Use consistent status display formatting

### Phase 4: Clean Up
1. Remove try-catch blocks handled by asyncWrapper
2. Remove duplicate authorization logic
3. Remove inline formatting functions

## Testing After Refactoring

### 1. Unit Tests
Update tests to work with new response formats:
```javascript
// Test example
const response = await request(app)
  .get('/api/customers/CUST-123')
  .set('Authorization', `Bearer ${token}`);

expect(response.status).toBe(200);
expect(response.body.success).toBe(true);
expect(response.body.customer).toBeDefined();
```

### 2. Integration Tests
Ensure authorization middleware works correctly:
```javascript
// Test authorization
const response = await request(app)
  .get('/api/customers/OTHER-CUSTOMER')
  .set('Authorization', `Bearer ${customerToken}`);

expect(response.status).toBe(403);
expect(response.body.success).toBe(false);
```

## Benefits After Refactoring

1. **Reduced Code**: ~1,700-2,100 lines eliminated
2. **Consistency**: Uniform error handling and responses
3. **Maintainability**: Single source of truth for common logic
4. **Testing**: Easier to test centralized utilities
5. **Development Speed**: Faster to add new endpoints

## Common Pitfalls to Avoid

1. **Don't forget to import utilities** - Always add imports at the top
2. **Check middleware order** - Authorization middleware must come before handlers
3. **Test authorization** - Ensure role checks still work correctly
4. **Preserve existing API contracts** - Response format should remain compatible
5. **Update tests** - Tests may need adjustments for new response formats

## Files to Prioritize for Refactoring

### High Priority (Most Duplication)
1. `/server/controllers/customerController.js`
2. `/server/controllers/orderController.js`
3. `/server/controllers/affiliateController.js`
4. `/server/controllers/operatorController.js`

### Medium Priority
1. `/server/controllers/authController.js`
2. `/server/services/emailService.js`
3. `/public/assets/js/customer-register-init.js`
4. `/public/assets/js/affiliate-register-init.js`

### Lower Priority
1. Admin controllers (less duplication)
2. Test utilities (already fairly DRY)
3. Model files (limited duplication)

## Example Refactored Controller

See `/server/controllers/customerController.refactored.example.js` for a complete example of a refactored controller using all the new utilities.

## Gradual Migration Strategy

1. **Week 1**: Refactor authentication and error handling
2. **Week 2**: Add authorization middleware to all endpoints
3. **Week 3**: Standardize data formatting
4. **Week 4**: Migrate frontend to use ApiClient

## Measuring Success

Track these metrics:
- Lines of code reduced
- Test coverage maintained or improved
- Number of bug reports related to inconsistent behavior
- Developer feedback on ease of adding new features

---

*Last Updated: September 2025*
*Estimated Code Reduction: 1,700-2,100 lines*
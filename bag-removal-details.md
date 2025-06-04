# Bag Removal Implementation Details

## Overview
This document provides detailed implementation notes for removing bag tracking from the WaveMAX system while preserving the bag purchase credit functionality.

## Key Considerations

### 1. Preserve Bag Purchase Credits
- Customers can still purchase bags
- Cost is applied as credit to customer account
- No tracking of individual bags needed
- Transaction history should show bag purchases

### 2. Database Impact
- `bags` collection can be dropped after migration
- `orders.bagIDs` field needs to be removed from schema
- Existing orders in production may have bagIDs that need cleanup
- No data loss for customer credits

### 3. API Breaking Changes
All bag-related endpoints will be removed:
- GET `/api/v1/bags`
- POST `/api/v1/bags`
- GET `/api/v1/bags/search`
- GET `/api/v1/bags/barcode/:barcode`
- GET `/api/v1/bags/:id`
- PATCH `/api/v1/bags/:id`
- DELETE `/api/v1/bags/:id`
- POST `/api/v1/bags/:id/report-lost`
- PATCH `/api/v1/bags/:id/report`

### 4. Frontend Impact
- Remove bag tracking from customer dashboard
- Remove bag barcode scanning features
- Remove lost bag reporting UI
- Keep bag purchase functionality

## Implementation Steps

### Phase 1: Analyze Dependencies
Before removing bags, check for:
1. Any business logic that depends on bag status
2. Reports that include bag information
3. Email notifications triggered by bag events
4. Any scheduled jobs related to bags

### Phase 2: Code Removal Order
1. **First**: Update Order model to remove bagIDs
2. **Second**: Remove bag references from controllers
3. **Third**: Remove bag routes and middleware
4. **Fourth**: Delete bag model and controller
5. **Fifth**: Update tests
6. **Last**: Frontend and documentation

### Phase 3: Testing Strategy
- Run tests after each phase
- Use feature flags if needed for gradual rollout
- Test bag purchase → credit flow still works
- Verify no broken references remain

## Potential Issues and Solutions

### Issue 1: Order History
**Problem**: Historical orders may reference bags
**Solution**: Keep bagIDs in database but remove from new orders

### Issue 2: Reporting
**Problem**: Reports may aggregate bag data
**Solution**: Update reports to remove bag metrics

### Issue 3: Customer Expectations
**Problem**: Customers may expect bag tracking
**Solution**: Clear communication about simplified process

### Issue 4: Affiliate Features
**Problem**: Affiliates may have bag management features
**Solution**: Remove features and update training materials

## Verification Checklist

### Before Starting
- [ ] Database backup completed
- [ ] Current test suite passing
- [ ] Feature branch created
- [ ] Stakeholders notified

### After Each Phase
- [ ] Tests passing
- [ ] No console errors
- [ ] API endpoints responding correctly
- [ ] Frontend functioning properly

### Final Verification
- [ ] All bag code removed
- [ ] Coverage targets still met
- [ ] Performance not degraded
- [ ] Documentation updated

## Rollback Plan

If issues arise:
1. Git revert to previous commit
2. Restore database backup if needed
3. Re-deploy previous version
4. Investigate issue before retry

## Migration Scripts

### Remove bagIDs from Orders
```javascript
// migration-remove-bagids.js
const Order = require('./server/models/Order');

async function removeBagIDs() {
  await Order.updateMany(
    {},
    { $unset: { bagIDs: "" } }
  );
  console.log('Removed bagIDs from all orders');
}
```

### Drop Bags Collection
```javascript
// migration-drop-bags.js
const mongoose = require('mongoose');

async function dropBagsCollection() {
  const db = mongoose.connection.db;
  await db.dropCollection('bags');
  console.log('Dropped bags collection');
}
```

## Notes
- Keep bag purchase transactions for accounting
- Customer credits remain unchanged
- Simplifies system significantly
- Reduces testing burden
- Improves maintainability
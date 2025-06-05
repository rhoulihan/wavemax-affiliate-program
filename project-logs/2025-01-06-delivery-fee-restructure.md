# Delivery Fee Restructure Implementation Log

**Project**: WaveMAX Affiliate Program - Delivery Fee Structure Change
**Start Date**: 2025-01-06
**Status**: IN PROGRESS
**Description**: Implement a new delivery fee structure with minimum charge + per-bag fee

## Overview

Currently, the system treats delivery fee as a fixed per-trip charge (multiplied by 2 for pickup + delivery). We're implementing a new structure that scales with bag count:
- **Minimum Delivery Fee**: Base charge for any delivery (e.g., $10)
- **Per-Bag Fee**: Additional charge per bag (e.g., $2/bag)
- **Total Delivery Fee**: Max(Minimum Fee, Number of Bags × Per-Bag Fee)
- **Round Trip**: Total × 2 (for pickup + delivery)

Example (one-way): 
- 1 bag: $10 (minimum applies)
- 3 bags: $10 (minimum applies, since 3 × $2 = $6)
- 6 bags: $12 (per-bag calculation, since 6 × $2 = $12)
- 10 bags: $20 (per-bag calculation, since 10 × $2 = $20)

For round trip (pickup + delivery), these amounts would be doubled.

## Detailed Implementation Plan

### Phase 1: Database & Configuration
1. **SystemConfig Updates**
   - [ ] Add `delivery_minimum_fee` config (default: $10.00)
   - [ ] Add `delivery_per_bag_fee` config (default: $2.00)
   - [ ] Keep existing `delivery_base_fee` for backward compatibility
   - [ ] Create migration script to add new configs

2. **Affiliate Model Updates**
   - [ ] Add `minimumDeliveryFee` field (optional override)
   - [ ] Add `perBagDeliveryFee` field (optional override)
   - [ ] Keep existing `deliveryFee` for backward compatibility
   - [ ] Update schema with proper defaults

### Phase 2: Backend Logic
3. **Order Controller Updates**
   - [ ] Create `calculateDeliveryFee(numberOfBags, affiliate)` helper
   - [ ] Update order creation to use new calculation
   - [ ] Update order estimates to reflect new structure
   - [ ] Ensure backward compatibility for existing orders

4. **Affiliate Controller Updates**
   - [ ] Update registration to accept new fee fields
   - [ ] Update profile editing for new fee structure
   - [ ] Add validation for reasonable fee limits

### Phase 3: Frontend Updates
5. **Customer Registration Form**
   - [ ] Update delivery fee display logic
   - [ ] Show breakdown: "Base: $X + Bags: $Y = Total: $Z"
   - [ ] Update JavaScript calculations

6. **Schedule Pickup Form**
   - [ ] Update fee calculation based on bag count
   - [ ] Show clear fee breakdown
   - [ ] Update real-time calculations

7. **Customer Dashboard**
   - [ ] Update order history to show fee breakdown
   - [ ] Update upcoming pickup fee estimates

8. **Affiliate Dashboard**
   - [ ] Show new fee structure settings
   - [ ] Allow editing of custom fee overrides
   - [ ] Show earnings calculations with new structure

### Phase 4: Testing & Validation
9. **Unit Tests**
   - [ ] Test fee calculation logic with various scenarios
   - [ ] Test affiliate fee overrides
   - [ ] Test backward compatibility

10. **Integration Tests**
    - [ ] Test order creation with new fees
    - [ ] Test API responses include fee breakdown
    - [ ] Test migration doesn't break existing orders

11. **End-to-End Testing**
    - [ ] Test customer journey with 1, 3, 6, 10 bags
    - [ ] Test affiliate custom fee settings
    - [ ] Test order confirmation emails show correct fees

## Files to Modify

### Models
- `/server/models/SystemConfig.js` - Add new fee configs
- `/server/models/Affiliate.js` - Add fee override fields
- `/server/models/Order.js` - Update fee calculation methods

### Controllers
- `/server/controllers/orderController.js` - New fee calculation logic
- `/server/controllers/affiliateController.js` - Handle new fee fields
- `/server/controllers/customerController.js` - Update dashboard data

### Frontend JavaScript
- `/public/assets/js/schedule-pickup.js` - Update fee calculations
- `/public/assets/js/customer-register.js` - Update fee display
- `/public/assets/js/affiliate-dashboard-init.js` - Fee management UI

### HTML Templates
- `/public/schedule-pickup-embed.html` - Fee breakdown display
- `/public/customer-register-embed.html` - Updated fee info
- `/public/affiliate-dashboard-embed.html` - Fee settings UI

### Tests
- `/tests/unit/orderController.test.js` - Fee calculation tests
- `/tests/integration/order.test.js` - Order creation with new fees
- `/tests/unit/models.test.js` - Model validation tests

## Progress Tracking

### Current Step: Phase 3 - Frontend Implementation
- [x] Analyzed current system
- [x] Designed new fee structure
- [x] Created detailed implementation plan
- [x] Phase 1: Added SystemConfig entries for new fees
- [x] Phase 1: Updated Affiliate model with fee override fields
- [x] Phase 2: Created calculateDeliveryFee helper function
- [x] Phase 2: Updated Order model to store numberOfBags and fee breakdown
- [x] Phase 2: Updated order creation logic to use calculateDeliveryFee
- [x] Phase 3: Updated schedule pickup form UI to show fee breakdown
- [x] Phase 3: Added dynamic fee calculation in JavaScript
- [ ] Test the new fee structure end-to-end

### Completed:
1. ✅ Migration script created and run (delivery_minimum_fee: $10, delivery_per_bag_fee: $2)
2. ✅ Affiliate model updated with minimumDeliveryFee and perBagDeliveryFee fields
3. ✅ calculateDeliveryFee helper added to orderController.js
4. ✅ Order model updated with numberOfBags and deliveryFeeBreakdown
5. ✅ Order creation in controller now uses new fee calculation
6. ✅ Schedule pickup form shows dynamic fee breakdown
7. ✅ JavaScript fetches system config and calculates fees based on bags

### Next Steps:
1. Restart the server to apply changes
2. Test with various bag quantities (1, 3, 6, 10 bags)
3. Update customer registration to show new fee structure
4. Update affiliate dashboard to manage fee overrides
5. Update order confirmation emails to show fee breakdown

## Code Snippets for Reference

### Fee Calculation Logic
```javascript
function calculateDeliveryFee(numberOfBags, affiliate = null) {
  // Get system defaults
  const minimumFee = await SystemConfig.getValue('delivery_minimum_fee', 10.00);
  const perBagFee = await SystemConfig.getValue('delivery_per_bag_fee', 2.00);
  
  // Check for affiliate overrides
  const minFee = affiliate?.minimumDeliveryFee || minimumFee;
  const bagFee = affiliate?.perBagDeliveryFee || perBagFee;
  
  // Calculate total
  const calculatedFee = numberOfBags * bagFee;
  const totalFee = Math.max(minFee, calculatedFee);
  
  return {
    minimumFee: minFee,
    perBagFee: bagFee,
    numberOfBags: numberOfBags,
    calculatedFee: calculatedFee,
    totalFee: totalFee,
    minimumApplied: totalFee === minFee
  };
}
```

### Migration Script Structure
```javascript
// scripts/add-delivery-fee-structure.js
async function migrate() {
  // Add SystemConfig entries
  await SystemConfig.create({
    key: 'delivery_minimum_fee',
    value: 10.00,
    defaultValue: 10.00,
    description: 'Minimum delivery fee regardless of bag count'
  });
  
  await SystemConfig.create({
    key: 'delivery_per_bag_fee', 
    value: 2.00,
    defaultValue: 2.00,
    description: 'Additional fee per bag for delivery'
  });
  
  // Update existing affiliates (optional)
  // Could set minimumDeliveryFee = current deliveryFee
}
```

## Notes & Considerations

1. **Backward Compatibility**: Existing orders should display correctly
2. **Affiliate Flexibility**: Affiliates can override system defaults
3. **Clear Communication**: Customers should understand fee breakdown
4. **Reasonable Limits**: Validate fees are within acceptable ranges
5. **Migration Safety**: Don't break existing data or active orders

## Session Resume Instructions

If interrupted, use this log to quickly resume:
1. Check `git status` for any uncommitted changes
2. Review "Current Step" section above
3. Check completed items in each phase
4. Continue from the last incomplete task
5. Run tests after each phase completion

## Implementation Summary

### What Was Changed:
1. **System Configuration**
   - Added `delivery_minimum_fee` ($10.00) - minimum charge regardless of bags
   - Added `delivery_per_bag_fee` ($2.00) - charge per bag
   - Both are configurable and public (visible to frontend)

2. **Affiliate Model**
   - Added `minimumDeliveryFee` field for affiliate-specific overrides
   - Added `perBagDeliveryFee` field for affiliate-specific overrides
   - Kept legacy `deliveryFee` field for backward compatibility

3. **Order Model & Controller**
   - Added `numberOfBags` field to track bags per order
   - Added `deliveryFeeBreakdown` object to store calculation details
   - Created `calculateDeliveryFee()` helper function
   - Updated order creation to use dynamic fee calculation

4. **Frontend (Schedule Pickup)**
   - Form already had numberOfBags dropdown (1-6+ bags)
   - Added fee breakdown display showing calculation method
   - JavaScript dynamically calculates fees as user selects bags
   - Fetches system config on page load for current rates
   - Shows either minimum fee or per-bag calculation

### How It Works:
- **1 bag**: $10 × 2 = $20 (minimum fee applies)
- **3 bags**: $10 × 2 = $20 (minimum still applies, as 3×$2=$6 < $10)
- **6 bags**: $12 × 2 = $24 (per-bag rate applies, as 6×$2=$12 > $10)
- **10 bags**: $20 × 2 = $40 (per-bag rate applies)

### What's Left To Do:
1. ~~**Customer Registration**: Update to show delivery fee structure~~ ✅ DONE
2. **Affiliate Dashboard**: Add UI to manage fee overrides
3. **Order Emails**: Update templates to show fee breakdown
4. **Testing**: Write unit tests for fee calculations
5. **Documentation**: Update API docs with new fields

### Additional Updates Completed:
1. **Affiliate Registration Form**
   - Added minimum delivery fee and per-bag fee fields
   - Kept legacy fixed fee field for backward compatibility
   - Clear explanation of how the fee structure works

2. **Affiliate Controller**
   - Accepts and saves new fee fields during registration
   - Update profile method handles new fields
   - Public info endpoint returns fee structure

3. **Customer Registration Display**
   - Shows affiliate's fee structure clearly
   - Displays "Starting at $X" for minimum fee
   - Shows fee breakdown (Min: $X, then $Y/bag)
   - Falls back to legacy flat fee if new fields not set

---
*Last Updated: 2025-01-06 (Affiliate Registration Updated)*
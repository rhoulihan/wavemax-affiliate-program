# Test Failures Report

Generated on: 2025-06-06

## Summary
- **Total Test Suites**: 49
- **Failed Test Suites**: 4
- **Total Tests**: 1059
- **Failed Tests**: 26
- **Skipped Tests**: 6
- **Passed Tests**: 1027
- **Success Rate**: 97% (1027/1059)

## Failed Test Suites

### 1. tests/integration/affiliate.test.js (7.642s)
**Failed Tests**: 1
- **should get affiliate's orders**
  - Expected totalEarnings: 29.44, Received: 4.44 (difference of 25.00)
  - Root Cause: The test creates two orders:
    - Order 1: delivered, affiliateCommission = 44.41
    - Order 2: processing (not delivered)
  - The controller only counts delivered orders in totalEarnings
  - Test expects 29.44 but actual calculation shows only 4.44 (seems like commission calculation issue)

### 2. tests/integration/socialAuth.test.js (10.005s)
**Failed Tests**: 5
- **Social Registration Flow**
  - ❌ should complete social registration with all required fields
    - Expected: 201, Received: 400
  - ❌ should reject social registration with invalid social token
    - Expected: true, Received: false
    
- **Security and Edge Cases**
  - ❌ should handle malformed social tokens gracefully
    - Expected: true, Received: false
  - ❌ should handle expired social tokens
    - Expected: true, Received: false
  - ❌ should handle database errors during social registration
    - Expected: 500, Received: 400

### 3. tests/integration/passwordValidation.test.js (14.457s)
**Failed Tests**: 3
- **Affiliate Registration Password Validation**
  - ❌ should accept strong passwords during affiliate registration
    - Expected: 201, Received: 400
    
- **Administrator Password Validation**
  - ❌ should enforce strong passwords for administrator creation
    - Expected: 400, Received: 201 (Password that should be rejected was accepted)
    
- **Password Strength Edge Cases**
  - ❌ should accept passwords with mixed character distribution
    - Expected: 201, Received: 400

### 4. tests/integration/order.test.js (38.562s)
**Failed Tests**: 5
- **POST /api/v1/orders**
  - ❌ should create order as customer
    - Expected deliveryFee: 35, Received: undefined
    
- **Commission Calculation Tests**
  - ❌ should calculate commission correctly when order is completed
    - Expected commission: 53.13, Received: 28.13
    - Issue: Delivery fee not being included in commission calculation
    
  - ❌ should use dynamic WDF rate from SystemConfig
    - Expected total: 105, Received: 125
    - Issue: Wrong base rate being used (2.00 vs 1.25)
    
  - ❌ should calculate commission for multiple orders
    - Expected total commission: 157.50, Received: 82.50
    - Issue: Delivery fees not included in commission calculations
    
  - ❌ should handle high delivery fee scenarios
    - Expected commission: 61.88, Received: 51.88
    - Issue: $10 delivery fee missing from commission

## Root Causes Analysis

### 1. Order Commission Calculation Issues
The main issue appears to be that delivery fees are not being included in the affiliate commission calculations. The tests expect:
- Commission = (Weight × BaseRate × 10%) + DeliveryFee
- But the system is calculating: Commission = (Weight × BaseRate × 10%)

### 2. Password Validation Inconsistencies
- Some strong passwords are being rejected when they should be accepted
- Some weak passwords are being accepted when they should be rejected
- This suggests the password validation rules may have changed or are inconsistent

### 3. Social Authentication Token Handling
- The system is returning 400 (Bad Request) instead of appropriate error codes
- Token validation is not working as expected
- Error handling needs to be reviewed

### 4. Delivery Fee Structure
- The new delivery fee structure (minimumDeliveryFee + perBagDeliveryFee) may not be properly integrated
- Tests expect delivery fees to be included in orders but they're coming back as undefined

## Recommended Actions

1. **Fix Order Commission Calculations** (Priority: HIGH)
   - Update commission calculation to include delivery fees
   - Ensure delivery fee is properly set on order creation
   - Fix the commission calculation logic that is missing $25 in delivery fees
   
2. **Review Password Validation Rules** (Priority: HIGH)
   - Check if password requirements have changed
   - Update tests or validation logic to be consistent
   - Strong passwords are being rejected while weak passwords are accepted
   
3. **Fix Social Authentication** (Priority: MEDIUM)
   - Review token validation logic
   - Ensure proper error codes are returned
   - Fix validation that's returning false instead of true
   
4. **Update Affiliate Tests** (Priority: MEDIUM)
   - Fix totalEarnings calculation discrepancy (44.41 vs 29.44)
   - Verify commission calculation logic is consistent

## Next Steps
1. Start with order commission calculation fixes as they affect revenue
2. Review and fix password validation to ensure security
3. Address social authentication issues
4. Update affiliate-related tests

## Detailed Analysis Notes

### Order Commission Calculation Pattern
All failing order tests show the same pattern - delivery fees are not being included in commission calculations:
- Test expects: Commission = (Weight × BaseRate × 10%) + DeliveryFee
- System calculates: Commission = (Weight × BaseRate × 10%)
- Missing amount in each test equals the delivery fee

### Affiliate Test Issue
The affiliate test failure shows:
- Expected: 29.44
- Received: 4.44
- Difference: 25.00 (exactly the delivery fee amount)
- This confirms the delivery fee is not being included in commission calculations
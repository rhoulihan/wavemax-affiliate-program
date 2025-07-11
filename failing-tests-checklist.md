# Failing Tests Summary

## All tests have been fixed!

## Previously Fixed Tests:

### tests/unit/wdfCredit.test.js
- [x] should apply negative WDF credit (debit) to new order
- [x] should not apply credit if customer has zero credit

### tests/integration/wdfCreditIntegration.test.js
- [x] should complete full credit cycle: create order → weigh bags → generate credit → apply to next order
- [x] should handle debit scenario when actual weight is less than estimated
- [x] should include WDF credit in order search results

### tests/unit/administrator.test.js
- [x] All 33 tests passing

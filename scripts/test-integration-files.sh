#!/bin/bash

# Test each integration test file individually
echo "Testing integration tests one by one..."

passed=0
failed=0
failed_tests=""

# Array of integration test files
tests=(
  "tests/integration/adminCreation.test.js"
  "tests/integration/administrator.test.js"
  "tests/integration/affiliate.test.js"
  "tests/integration/affiliateCustomerFiltering.test.js"
  "tests/integration/auth.test.js"
  "tests/integration/customer.test.js"
  "tests/integration/docusignW9.test.js"
  "tests/integration/oAuthFlows.test.js"
  "tests/integration/operator.test.js"
  "tests/integration/order.test.js"
  "tests/integration/passwordValidation.test.js"
  "tests/integration/payment.test.js"
  "tests/integration/quickbooks.test.js"
  "tests/integration/socialAuth.test.js"
  "tests/integration/systemConfig.test.js"
  "tests/integration/w9.test.js"
)

# Run each test
for test in "${tests[@]}"; do
  echo ""
  echo "Testing: $test"
  if npm test -- "$test" --testTimeout=30000 > /dev/null 2>&1; then
    echo "✓ PASSED: $test"
    ((passed++))
  else
    echo "✗ FAILED: $test"
    ((failed++))
    failed_tests="${failed_tests}\n  - $test"
  fi
done

echo ""
echo "==================================="
echo "Integration Test Summary:"
echo "Passed: $passed"
echo "Failed: $failed"

if [ $failed -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  echo -e "$failed_tests"
fi

echo "==================================="
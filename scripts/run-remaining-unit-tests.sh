#!/bin/bash

# List of remaining unit tests to run
tests=(
  "errorHandler.test.js"
  "fieldFilter.test.js" 
  "logger.test.js"
  "models.test.js"
  "oAuthSession.test.js"
  "operator.test.js"
  "operatorController.test.js"
  "orderController.test.js"
  "orderRoutes.test.js"
  "orderRoutesSimple.test.js"
  "orderWithSystemConfig.test.js"
  "paginationMiddleware.test.js"
  "passportConfig.test.js"
  "passportFacebookOnly.test.js"
  "passportGoogleOnly.test.js"
  "passportLinkedInOnly.test.js"
  "passwordValidator.test.js"
  "passwordValidatorEnhanced.test.js"
  "paygistixService.test.js"
  "payment.test.js"
  "paymentController.test.js"
  "paymentExport.test.js"
  "paymentMethod.test.js"
  "paymentRoutes.test.js"
  "paymentRoutesSimple.test.js"
  "quickbooksController.test.js"
  "quickbooksRoutesSimple.test.js"
  "rbac.test.js"
  "sanitization.test.js"
  "socialAuthRoutes.test.js"
  "systemConfig.test.js"
  "tokenBlacklist.test.js"
  "w9AuditLog.test.js"
  "w9AuditService.test.js"
  "w9Controller.test.js"
  "w9ControllerComprehensive.test.js"
  "w9ControllerDocuSign.test.js"
  "w9Document.test.js"
  "w9Storage.test.js"
)

# Keep track of results
passed=0
failed=0
failed_tests=()

echo "Running remaining unit tests..."
echo "=============================="

for test in "${tests[@]}"
do
  echo ""
  echo "Running: $test"
  echo "-------------------"
  
  if npm test -- "tests/unit/$test" --testTimeout=30000 > /dev/null 2>&1; then
    echo "✅ PASSED: $test"
    ((passed++))
  else
    echo "❌ FAILED: $test"
    ((failed++))
    failed_tests+=("$test")
  fi
done

echo ""
echo "=============================="
echo "Summary:"
echo "Passed: $passed"
echo "Failed: $failed"

if [ $failed -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for test in "${failed_tests[@]}"; do
    echo "  - $test"
  done
fi
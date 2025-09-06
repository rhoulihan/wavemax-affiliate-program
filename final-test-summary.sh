#!/bin/bash

echo "========================================"
echo "      FINAL TEST SUMMARY REPORT         "
echo "========================================"
echo ""
echo "Date: $(date)"
echo ""

# Arrays to track results
declare -a passed_tests
declare -a failed_tests

# Function to test and record
test_file() {
    local file=$1
    local name=$(basename "$file" .test.js)
    
    result=$(npm test -- "$file" --forceExit --silent 2>&1 | grep "Test Suites:" | head -1)
    
    if echo "$result" | grep -q "passed"; then
        passed_tests+=("$name")
        echo "✅ $name"
        return 0
    else
        failed_tests+=("$name")
        echo "❌ $name"
        return 1
    fi
}

echo "TESTING CORE UTILITY MODULES"
echo "-----------------------------"
test_file "tests/unit/controllerHelpers.test.js"
test_file "tests/unit/authorizationHelpers.test.js"
test_file "tests/unit/formatters.test.js"

echo ""
echo "TESTING KEY CONTROLLERS"
echo "-----------------------"
test_file "tests/unit/customerController.test.js"
test_file "tests/unit/orderController.test.js"
test_file "tests/unit/authController.test.js"

echo ""
echo "TESTING KEY SERVICES"
echo "--------------------"
test_file "tests/unit/emailService.test.js"
test_file "tests/unit/paymentLinkService.test.js"

echo ""
echo "TESTING V2 PAYMENT SYSTEM"
echo "-------------------------"
test_file "tests/unit/v2-payment-core.test.js"
test_file "tests/unit/v2PaymentModels.test.js"

echo ""
echo "TESTING INTEGRATION (Sample)"
echo "-----------------------------"
test_file "tests/integration/auth.test.js"

echo ""
echo "========================================"
echo "           RESULTS SUMMARY              "
echo "========================================"
echo ""
echo "✅ PASSED TESTS (${#passed_tests[@]}):"
for test in "${passed_tests[@]}"; do
    echo "   - $test"
done

echo ""
echo "❌ FAILED TESTS (${#failed_tests[@]}):"
for test in "${failed_tests[@]}"; do
    echo "   - $test"
done

echo ""
total=$((${#passed_tests[@]} + ${#failed_tests[@]}))
if [ $total -gt 0 ]; then
    rate=$(echo "scale=1; ${#passed_tests[@]} * 100 / $total" | bc)
    echo "Success Rate: $rate% (${#passed_tests[@]}/$total)"
fi

echo ""
echo "========================================"
echo ""

# Overall assessment
if [ ${#failed_tests[@]} -eq 0 ]; then
    echo "🎉 ALL TESTS PASSING!"
elif [ ${#passed_tests[@]} -gt ${#failed_tests[@]} ]; then
    echo "✅ Majority of tests passing. Some fixes still needed."
else
    echo "⚠️  Significant test failures require attention."
fi

echo ""
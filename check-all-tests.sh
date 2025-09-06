#!/bin/bash

# Comprehensive test checker

echo "======================================"
echo "   COMPREHENSIVE TEST STATUS CHECK    "
echo "======================================"
echo ""

# Counters
UNIT_PASSED=0
UNIT_FAILED=0
INTEGRATION_PASSED=0
INTEGRATION_FAILED=0
FRONTEND_PASSED=0
FRONTEND_FAILED=0

# Function to run test and count results
run_test() {
    local test_file=$1
    local test_type=$2
    local test_name=$(basename "$test_file" .test.js)
    
    # Run test and capture result
    result=$(npm test -- "$test_file" --forceExit --silent 2>&1 | grep -E "Test Suites:" | head -1)
    
    if echo "$result" | grep -q "passed"; then
        echo "✅ $test_name"
        if [ "$test_type" = "unit" ]; then
            UNIT_PASSED=$((UNIT_PASSED + 1))
        elif [ "$test_type" = "integration" ]; then
            INTEGRATION_PASSED=$((INTEGRATION_PASSED + 1))
        else
            FRONTEND_PASSED=$((FRONTEND_PASSED + 1))
        fi
    elif echo "$result" | grep -q "failed"; then
        echo "❌ $test_name"
        if [ "$test_type" = "unit" ]; then
            UNIT_FAILED=$((UNIT_FAILED + 1))
        elif [ "$test_type" = "integration" ]; then
            INTEGRATION_FAILED=$((INTEGRATION_FAILED + 1))
        else
            FRONTEND_FAILED=$((FRONTEND_FAILED + 1))
        fi
    else
        echo "⚠️  $test_name (unknown status)"
        if [ "$test_type" = "unit" ]; then
            UNIT_FAILED=$((UNIT_FAILED + 1))
        elif [ "$test_type" = "integration" ]; then
            INTEGRATION_FAILED=$((INTEGRATION_FAILED + 1))
        else
            FRONTEND_FAILED=$((FRONTEND_FAILED + 1))
        fi
    fi
}

echo "UTILITY MODULE TESTS"
echo "--------------------"
run_test "tests/unit/controllerHelpers.test.js" "unit"
run_test "tests/unit/authorizationHelpers.test.js" "unit"
run_test "tests/unit/formatters.test.js" "unit"

echo ""
echo "CONTROLLER TESTS"
echo "----------------"
run_test "tests/unit/customerController.test.js" "unit"
run_test "tests/unit/orderController.test.js" "unit"
run_test "tests/unit/affiliateController.test.js" "unit"
run_test "tests/unit/operatorController.test.js" "unit"
run_test "tests/unit/authController.test.js" "unit"
run_test "tests/unit/administratorController.test.js" "unit"

echo ""
echo "MODEL TESTS"
echo "-----------"
run_test "tests/unit/orderModel.test.js" "unit"
run_test "tests/unit/affiliateModel.test.js" "unit"
run_test "tests/unit/paymentModel.test.js" "unit"
run_test "tests/unit/wdfCreditModel.test.js" "unit"

echo ""
echo "SERVICE TESTS"
echo "-------------"
run_test "tests/unit/emailService.test.js" "unit"
run_test "tests/unit/paymentEmailScanner.test.js" "unit"
run_test "tests/unit/paymentLinkService.test.js" "unit"
run_test "tests/unit/paymentVerificationJob.test.js" "unit"
run_test "tests/unit/docusignService.test.js" "unit"

echo ""
echo "V2 PAYMENT TESTS"
echo "----------------"
run_test "tests/unit/v2-payment-core.test.js" "unit"
run_test "tests/unit/v2ControllerLogic.test.js" "unit"
run_test "tests/unit/v2PaymentModels.test.js" "unit"

echo ""
echo "INTEGRATION TESTS (Sample)"
echo "--------------------------"
run_test "tests/integration/auth.test.js" "integration"
run_test "tests/integration/customer.test.js" "integration"
run_test "tests/integration/order.test.js" "integration"
run_test "tests/integration/v2-payment-flow.test.js" "integration"
run_test "tests/integration/v2-complete-payment-flow.test.js" "integration"

echo ""
echo "FRONTEND TESTS"
echo "--------------"
run_test "tests/frontend/operatorAddOnsDisplay.test.js" "frontend"
run_test "tests/frontend/schedulePickupAddOns.test.js" "frontend"

echo ""
echo "======================================"
echo "            TEST SUMMARY              "
echo "======================================"
echo ""
echo "Unit Tests:"
echo "  Passed: $UNIT_PASSED"
echo "  Failed: $UNIT_FAILED"
echo "  Total:  $((UNIT_PASSED + UNIT_FAILED))"
echo ""
echo "Integration Tests:"
echo "  Passed: $INTEGRATION_PASSED"
echo "  Failed: $INTEGRATION_FAILED"
echo "  Total:  $((INTEGRATION_PASSED + INTEGRATION_FAILED))"
echo ""
echo "Frontend Tests:"
echo "  Passed: $FRONTEND_PASSED"
echo "  Failed: $FRONTEND_FAILED"
echo "  Total:  $((FRONTEND_PASSED + FRONTEND_FAILED))"
echo ""
TOTAL_PASSED=$((UNIT_PASSED + INTEGRATION_PASSED + FRONTEND_PASSED))
TOTAL_FAILED=$((UNIT_FAILED + INTEGRATION_FAILED + FRONTEND_FAILED))
TOTAL_TESTS=$((TOTAL_PASSED + TOTAL_FAILED))
echo "Overall:"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $TOTAL_PASSED"
echo "  Failed: $TOTAL_FAILED"
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $TOTAL_PASSED * 100 / $TOTAL_TESTS" | bc)
    echo "  Success Rate: $SUCCESS_RATE%"
fi
echo "======================================"
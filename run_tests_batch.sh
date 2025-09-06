#!/bin/bash

echo "Running Test Batch Check..."
echo "============================"
echo ""

# Run a sample of tests to check status
echo "Testing Unit Tests Sample..."
npm test -- tests/unit/controllerHelpers.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/unit/authorizationHelpers.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/unit/formatters.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/unit/customerController.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/unit/orderController.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/unit/authController.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1

echo ""
echo "Testing Integration Tests Sample..."
npm test -- tests/integration/auth.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/integration/customer.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1

echo ""
echo "Testing Frontend Tests..."
npm test -- tests/frontend/operatorAddOnsDisplay.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1
npm test -- tests/frontend/schedulePickupAddOns.test.js --forceExit --silent 2>&1 | grep -E "Test Suites:|Tests:" | head -1

echo ""
echo "============================"
echo "Quick Test Check Complete"
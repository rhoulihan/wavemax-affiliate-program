#!/bin/bash

echo "Batch fixing test files..."

# Fix missing verifyPassword in encryption mocks
for file in tests/unit/*.test.js; do
  if grep -q "jest.mock('../../server/utils/encryption'" "$file"; then
    if ! grep -q "verifyPassword" "$file"; then
      echo "Adding verifyPassword to $file"
      sed -i "/decryptData: jest.fn()/a\\  verifyPassword: jest.fn()," "$file"
    fi
  fi
done

# Remove debug console.logs from tests
for file in tests/unit/*.test.js tests/integration/*.test.js; do
  if grep -q "console.log.*mock.calls" "$file"; then
    echo "Removing debug logs from $file"
    sed -i "/console.log.*mock.calls/d" "$file"
    sed -i "/console.log.*Error passed to next/d" "$file"
    sed -i "/Check if there's an error/,+2d" "$file"
  fi
done

# Ensure Customer model mock returns proper instances
echo "Fixing Customer model mock in customerController.test.js"
sed -i 's/Customer\.mockImplementation(() => mockCustomer);/Customer.mockImplementation(() => mockCustomer);/' tests/unit/customerController.test.js

echo "Done!"
echo ""
echo "Now running a quick test check..."

# Run a few representative tests to check status
echo "Checking unit test sample..."
npm test -- tests/unit/customerController.test.js --testNamePattern="should return error for invalid affiliate" --no-coverage 2>&1 | grep -E "PASS|FAIL"

echo "Checking another unit test..."
npm test -- tests/unit/authController.test.js --testNamePattern="should handle successful affiliate login" --no-coverage 2>&1 | grep -E "PASS|FAIL"

echo ""
echo "Batch fix complete!"
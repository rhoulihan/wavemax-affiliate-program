#!/bin/bash

echo "Running coverage report for improved files..."
echo "============================================"

# Run coverage for specific test files we've improved
npm test -- --coverage \
  tests/unit/paymentCallbackRoute.test.js \
  tests/unit/helpers.test.js \
  tests/unit/callbackPool.test.js \
  tests/unit/paymentExport.test.js \
  tests/unit/generalPaymentCallback.test.js \
  tests/unit/w9ControllerDocuSign.test.js \
  --coverageReporters=text \
  --collectCoverageFrom="server/**/*.js" \
  --coveragePathIgnorePatterns="/node_modules/,/tests/,/migrations/" \
  2>&1 | grep -E "(File|Stmts|paymentCallbackRoute|helpers|CallbackPool|PaymentExport|generalPaymentCallback|w9ControllerDocuSign|All files)" | head -30
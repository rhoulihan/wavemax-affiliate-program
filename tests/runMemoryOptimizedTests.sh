#!/bin/bash

# Script to run tests with memory optimization for resource-constrained environments

echo "Running tests with memory optimization..."

# Set Node.js memory limit to 512MB
export NODE_OPTIONS="--max-old-space-size=512"

# Clear any existing test cache
npm run test -- --clearCache

# Run tests with resource optimization flags
npm test -- \
  --runInBand \
  --logHeapUsage \
  --detectOpenHandles \
  --forceExit

# Check exit code
if [ $? -eq 0 ]; then
  echo "All tests passed successfully!"
else
  echo "Tests failed. Consider running tests in smaller batches."
  echo ""
  echo "To run tests separately:"
  echo "  Unit tests: npm test -- tests/unit/"
  echo "  Integration tests: npm test -- tests/integration/"
fi
#!/bin/bash

echo "Checking all unit test files..."
echo "================================"

FAILED_FILES=""
PASSED_COUNT=0
FAILED_COUNT=0

for file in tests/unit/*.test.js; do
    filename=$(basename "$file")
    
    # Run the test and capture the result
    if npm test "$file" 2>&1 | grep -q "PASS tests/unit"; then
        PASSED_COUNT=$((PASSED_COUNT + 1))
        echo "✓ $filename"
    else
        FAILED_COUNT=$((FAILED_COUNT + 1))
        echo "✗ $filename"
        FAILED_FILES="$FAILED_FILES$filename\n"
    fi
done

echo ""
echo "================================"
echo "Summary:"
echo "Passed: $PASSED_COUNT"
echo "Failed: $FAILED_COUNT"

if [ $FAILED_COUNT -gt 0 ]; then
    echo ""
    echo "Failed files:"
    echo -e "$FAILED_FILES"
fi
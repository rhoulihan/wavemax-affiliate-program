#!/bin/bash

echo "Running Unit Test Summary..."
echo "=============================="

# Test each unit test file and capture results
PASS_COUNT=0
FAIL_COUNT=0
FAILED_FILES=""

for file in tests/unit/*.test.js; do
    echo -n "Testing $(basename $file)... "
    
    # Run test and capture exit code
    npm test "$file" > /tmp/test-output.txt 2>&1
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✓ PASSED"
        ((PASS_COUNT++))
    else
        echo "✗ FAILED"
        ((FAIL_COUNT++))
        FAILED_FILES="$FAILED_FILES\n  - $(basename $file)"
    fi
done

echo ""
echo "=============================="
echo "SUMMARY:"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "\nFailed files:$FAILED_FILES"
fi

echo "==============================" 

exit $FAIL_COUNT
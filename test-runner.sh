#!/bin/bash

# Test runner script to identify hanging/failing tests
TEST_DIR=$1
TIMEOUT_SECONDS=30

echo "Testing files in $TEST_DIR"
echo "================================"

for test_file in $(find $TEST_DIR -name "*.test.js" | sort); do
    echo -n "Testing $test_file... "
    
    # Run test with timeout
    timeout $TIMEOUT_SECONDS npm test -- "$test_file" --testTimeout=20000 > test_output.tmp 2>&1
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        # Check if test actually passed
        if grep -q "PASS" test_output.tmp; then
            echo "PASSED"
        else
            echo "FAILED (No PASS found)"
            echo "  Output: $(tail -5 test_output.tmp | tr '\n' ' ')"
        fi
    elif [ $exit_code -eq 124 ]; then
        echo "TIMEOUT (>${TIMEOUT_SECONDS}s)"
    else
        # Extract failure reason
        fail_reason=$(grep -E "FAIL|Error:|●" test_output.tmp | head -3 | tr '\n' ' ')
        if [ -z "$fail_reason" ]; then
            fail_reason=$(tail -5 test_output.tmp | tr '\n' ' ')
        fi
        echo "FAILED"
        echo "  Reason: $fail_reason"
    fi
    
    rm -f test_output.tmp
done

echo "================================"
echo "Test scan complete"
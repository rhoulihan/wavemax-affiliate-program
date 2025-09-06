#!/bin/bash

# Run all tests individually and track results

echo "Starting individual test runs..."
echo "================================="

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_FILES=""

# Function to run a single test file
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file")
    
    echo -n "Running $test_name... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Run the test with timeout and capture output
    output=$(timeout 30s npm test -- "$test_file" --forceExit 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        # Check if test actually passed by looking for test results
        if echo "$output" | grep -q "FAIL"; then
            echo "❌ FAILED"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            FAILED_FILES="$FAILED_FILES\n  - $test_file"
        elif echo "$output" | grep -q "PASS\|passed"; then
            echo "✅ PASSED"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "⚠️  UNKNOWN"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            FAILED_FILES="$FAILED_FILES\n  - $test_file (unknown result)"
        fi
    elif [ $exit_code -eq 124 ]; then
        echo "⏱️  TIMEOUT"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_FILES="$FAILED_FILES\n  - $test_file (timeout)"
    else
        echo "❌ FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_FILES="$FAILED_FILES\n  - $test_file"
    fi
}

# Run unit tests
echo ""
echo "UNIT TESTS"
echo "----------"
for test_file in tests/unit/*.test.js; do
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    fi
done

# Run integration tests
echo ""
echo "INTEGRATION TESTS"
echo "-----------------"
for test_file in tests/integration/*.test.js; do
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    fi
done

# Run frontend tests
echo ""
echo "FRONTEND TESTS"
echo "--------------"
for test_file in tests/frontend/*.test.js; do
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    fi
done

# Print summary
echo ""
echo "================================="
echo "TEST SUMMARY"
echo "================================="
echo "Total tests run: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Success rate: $(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%"

if [ $FAILED_TESTS -gt 0 ]; then
    echo ""
    echo "Failed tests:"
    echo -e "$FAILED_FILES"
fi

echo ""
echo "Test run complete!"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
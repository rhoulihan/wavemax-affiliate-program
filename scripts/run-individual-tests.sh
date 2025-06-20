#!/bin/bash

# Create results directory
mkdir -p test-results

# Function to run a test and capture its result
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file")
    echo "Running $test_name..."
    
    # Run the test and capture output
    npm test -- "$test_file" --testTimeout=30000 > "test-results/$test_name.log" 2>&1
    
    # Check if test passed or failed
    if [ $? -eq 0 ]; then
        echo "✅ PASSED: $test_name"
        echo "$test_name: PASSED" >> test-results/summary.txt
    else
        echo "❌ FAILED: $test_name"
        echo "$test_name: FAILED" >> test-results/summary.txt
        
        # Extract failure details
        grep -E "(FAIL|✕|Expected|Received|Error:|TypeError:|ReferenceError:)" "test-results/$test_name.log" | head -20 >> test-results/failures.txt
        echo "---" >> test-results/failures.txt
    fi
}

# Clear previous results
rm -f test-results/summary.txt test-results/failures.txt

echo "Starting individual test runs..."
echo "=============================="

# Run unit tests
echo "Running Unit Tests..."
for test in /var/www/wavemax/wavemax-affiliate-program/tests/unit/*.test.js; do
    run_test "$test"
done

# Run integration tests
echo ""
echo "Running Integration Tests..."
for test in /var/www/wavemax/wavemax-affiliate-program/tests/integration/*.test.js; do
    run_test "$test"
done

echo ""
echo "=============================="
echo "Test Summary:"
echo ""

# Count results
total_tests=$(find /var/www/wavemax/wavemax-affiliate-program/tests -name "*.test.js" | wc -l)
passed_tests=$(grep -c "PASSED" test-results/summary.txt 2>/dev/null || echo 0)
failed_tests=$(grep -c "FAILED" test-results/summary.txt 2>/dev/null || echo 0)

echo "Total tests: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $failed_tests"

if [ -f test-results/failures.txt ]; then
    echo ""
    echo "Failed tests:"
    grep "FAILED" test-results/summary.txt | sed 's/: FAILED//'
fi
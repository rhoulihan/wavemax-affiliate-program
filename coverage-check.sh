#!/bin/bash
# Quick coverage check script

echo "Running test coverage analysis..."
echo "================================"

# Run tests with coverage
npm run test:coverage > coverage-output.txt 2>&1

# Extract the summary
echo ""
echo "Coverage Summary:"
echo "================="
tail -50 coverage-output.txt | grep -A 20 "Coverage summary" || echo "Coverage summary not found"

echo ""
echo "Test Summary:"
echo "============="
tail -20 coverage-output.txt | grep -E "(Test Suites:|Tests:|Snapshots:|Time:)" || echo "Test summary not found"

echo ""
echo "Low Coverage Files (< 80%):"
echo "=========================="
grep -E "^\s*[^|]+\|.*\s[0-7][0-9]\.[0-9]{2}\s*\|" coverage-output.txt | head -20 || echo "No low coverage files found"

# Clean up
rm -f coverage-output.txt

echo ""
echo "Coverage check complete!"
// Custom test sequencer to optimize memory usage
// Runs unit tests first (smaller memory footprint), then integration tests

const TestSequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends TestSequencer {
  sort(tests) {
    // Sort tests: unit tests first, then integration tests
    const unitTests = tests.filter(test => test.path.includes('/unit/'));
    const integrationTests = tests.filter(test => test.path.includes('/integration/'));
    const otherTests = tests.filter(test => !test.path.includes('/unit/') && !test.path.includes('/integration/'));

    // Within each category, sort by file size (smaller first)
    const sortBySize = (a, b) => {
      const fs = require('fs');
      try {
        const sizeA = fs.statSync(a.path).size;
        const sizeB = fs.statSync(b.path).size;
        return sizeA - sizeB;
      } catch (error) {
        return 0;
      }
    };

    unitTests.sort(sortBySize);
    integrationTests.sort(sortBySize);
    otherTests.sort(sortBySize);

    return [...unitTests, ...integrationTests, ...otherTests];
  }
}

module.exports = CustomSequencer;
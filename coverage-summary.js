const fs = require('fs');
const path = require('path');

// Read coverage summary if it exists
const coveragePath = path.join(__dirname, 'coverage', 'coverage-summary.json');

if (fs.existsSync(coveragePath)) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  
  console.log('\n=== OVERALL COVERAGE SUMMARY ===');
  console.log(`Statements: ${coverage.total.statements.pct}% (Target: 80%)`);
  console.log(`Branches: ${coverage.total.branches.pct}% (Target: 80%)`);
  console.log(`Functions: ${coverage.total.functions.pct}% (Target: 80%)`);
  console.log(`Lines: ${coverage.total.lines.pct}% (Target: 80%)`);
  
  console.log('\n=== FILES WE IMPROVED ===');
  const improvedFiles = [
    'server/routes/paymentCallbackRoute.js',
    'server/utils/helpers.js',
    'server/models/CallbackPool.js',
    'server/models/PaymentExport.js',
    'server/routes/generalPaymentCallback.js',
    'server/controllers/w9ControllerDocuSign.js'
  ];
  
  improvedFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (coverage[fullPath]) {
      const fileCov = coverage[fullPath];
      console.log(`\n${path.basename(file)}:`);
      console.log(`  Statements: ${fileCov.statements.pct}%`);
      console.log(`  Branches: ${fileCov.branches.pct}%`);
      console.log(`  Functions: ${fileCov.functions.pct}%`);
      console.log(`  Lines: ${fileCov.lines.pct}%`);
    }
  });
} else {
  console.log('Coverage summary not found. Run full test suite with coverage first.');
}
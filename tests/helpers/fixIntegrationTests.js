#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix auth.test.js
function fixAuthTest() {
  const filePath = path.join(__dirname, '..', 'integration', 'auth.test.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove duplicate CSRF lines at the top
  content = content.replace(
    /const app = require\('\.\.\/\.\.\/server'\);\n\s+\.set\('X-CSRF-Token', csrfToken\)\n\s+\.set\('X-CSRF-Token', csrfToken\)\n/g,
    'const app = require(\'../../server\');\n'
  );

  // Fix logout requests missing .send()
  content = content.replace(
    /\.post\('\/api\/v1\/auth\/logout'\)\n\s+refreshToken: refreshToken/g,
    '.post(\'/api/v1/auth/logout\')\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          refreshToken: refreshToken'
  );

  content = content.replace(
    /\.post\('\/api\/v1\/auth\/logout'\)\n\s+refreshToken: refresh1\.body\.refreshToken/g,
    '.post(\'/api/v1/auth/logout\')\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          refreshToken: refresh1.body.refreshToken'
  );

  // Add missing }) for send blocks
  content = content.replace(
    /refreshToken: refreshToken\n\s+}\);/g,
    'refreshToken: refreshToken\n        });'
  );

  content = content.replace(
    /refreshToken: refresh1\.body\.refreshToken\n\s+}\);/g,
    'refreshToken: refresh1.body.refreshToken\n        });'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed auth.test.js');
}

// Fix customer.test.js
function fixCustomerTest() {
  const filePath = path.join(__dirname, '..', 'integration', 'customer.test.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove duplicate CSRF lines at the top
  content = content.replace(
    /const app = require\('\.\.\/\.\.\/server'\);\n(\s+\.set\('X-CSRF-Token', csrfToken\)\n)+/g,
    'const app = require(\'../../server\');\n'
  );

  // Fix PUT requests missing .send()
  content = content.replace(
    /\.put\('\/api\/v1\/customers\/CUST123\/profile'\)\n\s+phone:/g,
    '.put(\'/api/v1/customers/CUST123/profile\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          phone:'
  );

  content = content.replace(
    /\.put\('\/api\/v1\/customers\/CUST123\/profile'\)\n\s+customerId:/g,
    '.put(\'/api/v1/customers/CUST123/profile\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          customerId:'
  );

  content = content.replace(
    /\.put\('\/api\/v1\/customers\/CUST123\/password'\)\n\s+currentPassword:/g,
    '.put(\'/api/v1/customers/CUST123/password\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          currentPassword:'
  );

  // Fix POST requests missing .send()
  content = content.replace(
    /\.post\('\/api\/v1\/customers\/report-lost-bag'\)\n\s+bagBarcode:/g,
    '.post(\'/api/v1/customers/report-lost-bag\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          bagBarcode:'
  );

  // Fix line 50 issue
  content = content.replace(
    /expect\(bag\.status\)\.toBe\('active'\);\n\s+}\);\n\s+it\('should fail with invalid affiliate ID', async \(\) => \{/g,
    'expect(bag.status).toBe(\'active\');\n    });\n\n    it(\'should fail with invalid affiliate ID\', async () => {'
  );

  // Remove " No newline at end of file" text
  content = content.replace(/ No newline at end of file/g, '');

  fs.writeFileSync(filePath, content);
  console.log('Fixed customer.test.js');
}

// Fix order.test.js
function fixOrderTest() {
  const filePath = path.join(__dirname, '..', 'integration', 'order.test.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove duplicate CSRF lines at the top
  content = content.replace(
    /const app = require\('\.\.\/\.\.\/server'\);\n(\s+\.set\('X-CSRF-Token', csrfToken\)\n)+/g,
    'const app = require(\'../../server\');\n'
  );

  // Fix POST/PUT requests missing .send()
  content = content.replace(
    /\.post\('\/api\/v1\/orders'\)\n\s+customerId:/g,
    '.post(\'/api/v1/orders\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          customerId:'
  );

  content = content.replace(
    /\.put\('\/api\/v1\/orders\/ORD123456\/status'\)\n\s+status:/g,
    '.put(\'/api/v1/orders/ORD123456/status\')\n        .set(\'Authorization\', `Bearer ${affiliateToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          status:'
  );

  content = content.replace(
    /\.put\('\/api\/v1\/orders\/bulk\/status'\)\n\s+orderIds:/g,
    '.put(\'/api/v1/orders/bulk/status\')\n        .set(\'Authorization\', `Bearer ${affiliateToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          orderIds:'
  );

  content = content.replace(
    /\.post\('\/api\/v1\/orders\/ORD123456\/cancel'\)\n\s+expect/g,
    '.post(\'/api/v1/orders/ORD123456/cancel\')\n        .set(\'Authorization\', `Bearer ${customerToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({});\n\n      expect'
  );

  content = content.replace(
    /\.post\('\/api\/v1\/orders\/bulk\/cancel'\)\n\s+orderIds:/g,
    '.post(\'/api/v1/orders/bulk/cancel\')\n        .set(\'Authorization\', `Bearer ${affiliateToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          orderIds:'
  );

  content = content.replace(
    /\.put\('\/api\/v1\/orders\/ORD123456\/payment-status'\)\n\s+paymentStatus:/g,
    '.put(\'/api/v1/orders/ORD123456/payment-status\')\n        .set(\'Authorization\', `Bearer ${affiliateToken}`)\n        .set(\'X-CSRF-Token\', csrfToken)\n        .send({\n          paymentStatus:'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed order.test.js');
}

// Run all fixes
fixAuthTest();
fixCustomerTest();
fixOrderTest();

console.log('\nAll integration tests have been fixed!');
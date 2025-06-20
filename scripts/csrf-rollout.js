#!/usr/bin/env node

/**
 * CSRF Protection Rollout Script
 * Helps manage the gradual rollout of CSRF protection
 */

const fs = require('fs');
const path = require('path');
const { CSRF_CONFIG } = require('../server/config/csrf-config');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function printHeader(text) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

function printSection(title, items, color = colors.cyan) {
  console.log(`${colors.bright}${color}${title}:${colors.reset}`);
  items.forEach(item => console.log(`  - ${item}`));
  console.log('');
}

function getCurrentPhase() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/CSRF_PHASE=(\d+)/);
    return match ? parseInt(match[1]) : 1;
  } catch (error) {
    return 1;
  }
}

function updatePhase(newPhase) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('CSRF_PHASE=')) {
      envContent = envContent.replace(/CSRF_PHASE=\d+/, `CSRF_PHASE=${newPhase}`);
    } else {
      envContent += `\n# CSRF Protection Phase\nCSRF_PHASE=${newPhase}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`${colors.green}✓ Updated CSRF_PHASE to ${newPhase}${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}✗ Failed to update .env file: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

function showStatus() {
  const currentPhase = getCurrentPhase();

  printHeader('CSRF Protection Status');

  console.log(`${colors.bright}Current Phase: ${colors.green}${currentPhase}${colors.reset}\n`);

  // Show endpoints by category
  printSection('PUBLIC ENDPOINTS (Never Protected)', CSRF_CONFIG.PUBLIC_ENDPOINTS, colors.green);
  printSection('AUTH ENDPOINTS (Rate Limited)', CSRF_CONFIG.AUTH_ENDPOINTS, colors.yellow);
  printSection('REGISTRATION ENDPOINTS (CAPTCHA)', CSRF_CONFIG.REGISTRATION_ENDPOINTS, colors.yellow);

  // Critical endpoints
  console.log(`${colors.bright}${currentPhase >= 1 ? colors.green : colors.red}CRITICAL ENDPOINTS (Phase 1)${currentPhase >= 1 ? ' ✓' : ' ✗'}:${colors.reset}`);
  CSRF_CONFIG.CRITICAL_ENDPOINTS.forEach(endpoint => {
    console.log(`  ${currentPhase >= 1 ? colors.green + '✓' : colors.red + '✗'} ${endpoint}${colors.reset}`);
  });
  console.log('');

  // High priority endpoints
  console.log(`${colors.bright}${currentPhase >= 2 ? colors.green : colors.red}HIGH PRIORITY ENDPOINTS (Phase 2)${currentPhase >= 2 ? ' ✓' : ' ✗'}:${colors.reset}`);
  CSRF_CONFIG.HIGH_PRIORITY_ENDPOINTS.forEach(endpoint => {
    console.log(`  ${currentPhase >= 2 ? colors.green + '✓' : colors.red + '✗'} ${endpoint}${colors.reset}`);
  });
  console.log('');

  printSection('READ-ONLY ENDPOINTS (Never Protected)', CSRF_CONFIG.READ_ONLY_ENDPOINTS, colors.green);
}

function showRecommendations(phase) {
  printHeader('Recommendations');

  switch(phase) {
  case 1:
    console.log(`${colors.yellow}Phase 1 protects critical endpoints:${colors.reset}`);
    console.log('- Order creation and management');
    console.log('- Payment processing');
    console.log('- Password changes');
    console.log('- Data deletion');
    console.log('- Administrator operations\n');
    console.log(`${colors.cyan}Next steps:${colors.reset}`);
    console.log('1. Monitor for any CSRF errors in logs');
    console.log('2. Ensure all dashboards work correctly');
    console.log('3. Test order creation flow thoroughly');
    console.log('4. After 24-48 hours of stable operation, move to Phase 2\n');
    break;

  case 2:
    console.log(`${colors.yellow}Phase 2 adds protection for:${colors.reset}`);
    console.log('- Profile updates');
    console.log('- Payment method changes');
    console.log('- Bag management\n');
    console.log(`${colors.cyan}Next steps:${colors.reset}`);
    console.log('1. Test customer profile updates');
    console.log('2. Verify affiliate profile management');
    console.log('3. Check bag reporting functionality');
    console.log('4. After stable operation, consider Phase 3 for full protection\n');
    break;

  case 3:
    console.log(`${colors.green}Phase 3 provides maximum protection:${colors.reset}`);
    console.log('- All state-changing endpoints protected');
    console.log('- Only truly public/read-only endpoints exempt');
    console.log('- Full defense-in-depth with JWT + CSRF\n');
    console.log(`${colors.cyan}Maintenance:${colors.reset}`);
    console.log('1. Monitor audit logs for CSRF violations');
    console.log('2. Add rate limiting to auth endpoints');
    console.log('3. Implement CAPTCHA for registration');
    console.log('4. Regular security audits\n');
    break;
  }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch(command) {
case 'status':
  showStatus();
  break;

case 'set':
  const phase = parseInt(args[1]);
  if (![1, 2, 3].includes(phase)) {
    console.error(`${colors.red}Error: Phase must be 1, 2, or 3${colors.reset}`);
    process.exit(1);
  }
  updatePhase(phase);
  showStatus();
  showRecommendations(phase);
  break;

case 'recommendations':
  const currentPhase = getCurrentPhase();
  showRecommendations(currentPhase);
  break;

default:
  console.log(`${colors.bright}CSRF Protection Rollout Tool${colors.reset}\n`);
  console.log('Usage:');
  console.log('  node csrf-rollout.js status              - Show current CSRF protection status');
  console.log('  node csrf-rollout.js set <phase>         - Set CSRF phase (1, 2, or 3)');
  console.log('  node csrf-rollout.js recommendations     - Show recommendations for current phase');
  console.log('\nPhases:');
  console.log('  1 - Critical endpoints only (orders, payments, admin)');
  console.log('  2 - High priority endpoints (profiles, settings)');
  console.log('  3 - All state-changing endpoints');
}
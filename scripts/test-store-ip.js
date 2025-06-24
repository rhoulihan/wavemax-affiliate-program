#!/usr/bin/env node

// Test script for store IP configuration
require('dotenv').config();
const storeIPConfig = require('../server/config/storeIPs');

console.log('Store IP Configuration Test');
console.log('==========================\n');

// Display current configuration
console.log('Whitelisted IPs:', storeIPConfig.whitelistedIPs);
console.log('Whitelisted Ranges:', storeIPConfig.whitelistedRanges);
console.log('Session Renewal Settings:', storeIPConfig.sessionRenewal);
console.log('\n');

// Test IPs
const testIPs = [
  '70.114.167.145', // Store IP from env - should match
  '192.168.1.100',  // Should match if in ADDITIONAL_STORE_IPS
  '192.168.1.50',   // Should match if 192.168.1.0/24 is in ranges
  '10.0.0.50',      // Should match if in ADDITIONAL_STORE_IPS
  '10.0.1.100',     // Should match if 10.0.0.0/16 is in ranges
  '8.8.8.8',        // Should not match
  '127.0.0.1',      // localhost - should not match
];

console.log('IP Whitelist Test Results:');
console.log('-------------------------');
testIPs.forEach(ip => {
  const isWhitelisted = storeIPConfig.isWhitelisted(ip);
  console.log(`${ip.padEnd(15)} - ${isWhitelisted ? '✓ Whitelisted' : '✗ Not whitelisted'}`);
});

// Test CIDR range functionality
console.log('\n\nCIDR Range Test:');
console.log('----------------');
const testRanges = [
  { ip: '192.168.1.100', cidr: '192.168.1.0/24', expected: true },
  { ip: '192.168.2.100', cidr: '192.168.1.0/24', expected: false },
  { ip: '10.0.50.100', cidr: '10.0.0.0/16', expected: true },
  { ip: '10.0.255.255', cidr: '10.0.0.0/16', expected: true },
  { ip: '10.1.0.0', cidr: '10.0.0.0/16', expected: false },
  { ip: '11.0.50.100', cidr: '10.0.0.0/16', expected: false },
];

testRanges.forEach(({ ip, cidr, expected }) => {
  const result = storeIPConfig.isInRange(ip, cidr);
  const status = result === expected ? '✓ PASS' : '✗ FAIL';
  console.log(`${ip.padEnd(15)} in ${cidr.padEnd(15)} - ${status} (expected: ${expected}, got: ${result})`);
});

// Debug specific case
console.log('\n\nDebug 10.0.255.255 in 10.0.0.0/16:');
const debugIP = '10.0.255.255';
const debugCIDR = '10.0.0.0/16';
const [network, bits] = debugCIDR.split('/');
const maskBits = parseInt(bits);

const ipToInt = (addr) => {
  const parts = addr.split('.');
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const num = parseInt(parts[i]);
    result = (result * 256) + num;
  }
  return result >>> 0;
};

const ipInt = ipToInt(debugIP);
const netInt = ipToInt(network);
const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;

console.log('IP int:', ipInt, 'Binary:', ipInt.toString(2).padStart(32, '0'));
console.log('Net int:', netInt, 'Binary:', netInt.toString(2).padStart(32, '0'));
console.log('Mask:', mask, 'Binary:', mask.toString(2).padStart(32, '0'));
console.log('IP & mask:', (ipInt >>> 0 & mask), 'Binary:', ((ipInt >>> 0 & mask) >>> 0).toString(2).padStart(32, '0'));
console.log('Net & mask:', (netInt >>> 0 & mask), 'Binary:', ((netInt >>> 0 & mask) >>> 0).toString(2).padStart(32, '0'));

console.log('\n\nTo add store IPs, update your .env file with:');
console.log('STORE_IP_WHITELIST=192.168.1.100,10.0.0.50');
console.log('STORE_IP_RANGES=192.168.1.0/24,10.0.0.0/16');
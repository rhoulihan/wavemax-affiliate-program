// Unit tests for storeIPs configuration

describe('storeIPs configuration', () => {
  let storeIPs;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear the module cache before each test
    jest.resetModules();
    
    // Set default environment variables
    process.env = {
      STORE_IP_ADDRESS: '',
      ADDITIONAL_STORE_IPS: '',
      STORE_IP_RANGES: '',
      STORE_SESSION_CHECK_INTERVAL: '',
      STORE_SESSION_RENEW_THRESHOLD: '',
      STORE_SESSION_MAX_DURATION: ''
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('IP whitelist configuration', () => {
    it('should load single store IP from environment', () => {
      process.env.STORE_IP_ADDRESS = '192.168.1.100';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual(['192.168.1.100']);
    });

    it('should handle empty store IP', () => {
      process.env.STORE_IP_ADDRESS = '';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual([]);
    });

    it('should load additional IPs from environment', () => {
      process.env.STORE_IP_ADDRESS = '192.168.1.100';
      process.env.ADDITIONAL_STORE_IPS = '192.168.1.101,192.168.1.102,192.168.1.103';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual([
        '192.168.1.100',
        '192.168.1.101',
        '192.168.1.102',
        '192.168.1.103'
      ]);
    });

    it('should trim whitespace from IPs', () => {
      process.env.STORE_IP_ADDRESS = '  192.168.1.100  ';
      process.env.ADDITIONAL_STORE_IPS = ' 192.168.1.101 , 192.168.1.102 ';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual([
        '192.168.1.100',
        '192.168.1.101',
        '192.168.1.102'
      ]);
    });

    it('should filter out empty IP entries', () => {
      process.env.ADDITIONAL_STORE_IPS = '192.168.1.101,,192.168.1.102,  ,192.168.1.103';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual([
        '192.168.1.101',
        '192.168.1.102',
        '192.168.1.103'
      ]);
    });

    it('should load IP ranges from environment', () => {
      process.env.STORE_IP_RANGES = '192.168.1.0/24,10.0.0.0/8';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedRanges).toEqual([
        '192.168.1.0/24',
        '10.0.0.0/8'
      ]);
    });

    it('should handle empty IP ranges', () => {
      process.env.STORE_IP_RANGES = '';
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedRanges).toEqual([]);
    });
  });

  describe('Session renewal configuration', () => {
    it('should use default session renewal settings', () => {
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.sessionRenewal.checkInterval).toBe(300000); // 5 minutes
      expect(storeIPs.sessionRenewal.renewThreshold).toBe(1800000); // 30 minutes
      expect(storeIPs.sessionRenewal.maxSessionDuration).toBe(86400000); // 24 hours
    });

    it('should load custom session renewal settings from environment', () => {
      process.env.STORE_SESSION_CHECK_INTERVAL = '600000'; // 10 minutes
      process.env.STORE_SESSION_RENEW_THRESHOLD = '3600000'; // 1 hour
      process.env.STORE_SESSION_MAX_DURATION = '43200000'; // 12 hours
      
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.sessionRenewal.checkInterval).toBe(600000);
      expect(storeIPs.sessionRenewal.renewThreshold).toBe(3600000);
      expect(storeIPs.sessionRenewal.maxSessionDuration).toBe(43200000);
    });

    it('should handle invalid numeric values', () => {
      process.env.STORE_SESSION_CHECK_INTERVAL = 'invalid';
      process.env.STORE_SESSION_RENEW_THRESHOLD = 'abc';
      process.env.STORE_SESSION_MAX_DURATION = '';
      
      storeIPs = require('../../server/config/storeIPs');

      // parseInt returns NaN for invalid values
      expect(isNaN(storeIPs.sessionRenewal.checkInterval)).toBe(true);
      expect(isNaN(storeIPs.sessionRenewal.renewThreshold)).toBe(true);
      expect(storeIPs.sessionRenewal.maxSessionDuration).toBe(86400000); // Empty string uses OR operator default
    });
  });

  describe('isWhitelisted function', () => {
    beforeEach(() => {
      process.env.STORE_IP_ADDRESS = '192.168.1.100';
      process.env.ADDITIONAL_STORE_IPS = '192.168.1.101,10.0.0.50';
      process.env.STORE_IP_RANGES = '172.16.0.0/16,10.0.0.0/24';
      storeIPs = require('../../server/config/storeIPs');
    });

    it('should return true for directly whitelisted IPs', () => {
      expect(storeIPs.isWhitelisted('192.168.1.100')).toBe(true);
      expect(storeIPs.isWhitelisted('192.168.1.101')).toBe(true);
      expect(storeIPs.isWhitelisted('10.0.0.50')).toBe(true);
    });

    it('should return false for non-whitelisted IPs', () => {
      expect(storeIPs.isWhitelisted('192.168.1.200')).toBe(false);
      expect(storeIPs.isWhitelisted('8.8.8.8')).toBe(false);
    });

    it('should check IP ranges', () => {
      expect(storeIPs.isWhitelisted('172.16.10.5')).toBe(true);
      expect(storeIPs.isWhitelisted('172.16.255.255')).toBe(true);
      expect(storeIPs.isWhitelisted('10.0.0.1')).toBe(true);
      expect(storeIPs.isWhitelisted('10.0.0.254')).toBe(true);
    });

    it('should return false for IPs outside ranges', () => {
      expect(storeIPs.isWhitelisted('172.17.0.1')).toBe(false);
      expect(storeIPs.isWhitelisted('10.0.1.1')).toBe(false);
    });
  });

  describe('isInRange function', () => {
    beforeEach(() => {
      storeIPs = require('../../server/config/storeIPs');
    });

    it('should correctly check IPs in /24 subnet', () => {
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/24')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.255', '192.168.1.0/24')).toBe(true);
      expect(storeIPs.isInRange('192.168.2.1', '192.168.1.0/24')).toBe(false);
    });

    it('should correctly check IPs in /16 subnet', () => {
      expect(storeIPs.isInRange('172.16.0.1', '172.16.0.0/16')).toBe(true);
      expect(storeIPs.isInRange('172.16.255.255', '172.16.0.0/16')).toBe(true);
      expect(storeIPs.isInRange('172.17.0.1', '172.16.0.0/16')).toBe(false);
    });

    it('should correctly check IPs in /8 subnet', () => {
      expect(storeIPs.isInRange('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(storeIPs.isInRange('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(storeIPs.isInRange('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('should correctly check IPs in /32 subnet (single host)', () => {
      expect(storeIPs.isInRange('192.168.1.100', '192.168.1.100/32')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.101', '192.168.1.100/32')).toBe(false);
    });

    it('should correctly check IPs in /0 subnet (all IPs)', () => {
      expect(storeIPs.isInRange('1.2.3.4', '0.0.0.0/0')).toBe(true);
      expect(storeIPs.isInRange('255.255.255.255', '0.0.0.0/0')).toBe(true);
    });

    it('should handle invalid CIDR notation', () => {
      expect(storeIPs.isInRange('192.168.1.1', 'invalid')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '/24')).toBe(false);
    });

    it('should handle invalid mask bits', () => {
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/33')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/-1')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/abc')).toBe(false);
    });

    it('should handle invalid IP addresses', () => {
      expect(storeIPs.isInRange('invalid.ip', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', 'invalid.ip/24')).toBe(false);
      expect(storeIPs.isInRange('999.999.999.999', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.1', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1.1', '192.168.1.0/24')).toBe(false);
    });

    it('should handle IP parts out of range', () => {
      expect(storeIPs.isInRange('192.168.256.1', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.-1.1', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.256.0/24')).toBe(false);
    });

    it('should handle edge cases with console error', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Test with completely invalid input that might throw
      expect(storeIPs.isInRange(null, '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange(undefined, '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', null)).toBe(false);
      expect(storeIPs.isInRange('192.168.1.1', undefined)).toBe(false);
      
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should correctly handle boundary cases', () => {
      // Test network address
      expect(storeIPs.isInRange('192.168.1.0', '192.168.1.0/24')).toBe(true);
      // Test broadcast address
      expect(storeIPs.isInRange('192.168.1.255', '192.168.1.0/24')).toBe(true);
      // Test just outside range
      expect(storeIPs.isInRange('192.168.0.255', '192.168.1.0/24')).toBe(false);
      expect(storeIPs.isInRange('192.168.2.0', '192.168.1.0/24')).toBe(false);
    });

    it('should handle various subnet sizes correctly', () => {
      // /30 subnet (4 IPs)
      expect(storeIPs.isInRange('192.168.1.0', '192.168.1.0/30')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/30')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.2', '192.168.1.0/30')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.3', '192.168.1.0/30')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.4', '192.168.1.0/30')).toBe(false);

      // /31 subnet (2 IPs)
      expect(storeIPs.isInRange('192.168.1.0', '192.168.1.0/31')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.1', '192.168.1.0/31')).toBe(true);
      expect(storeIPs.isInRange('192.168.1.2', '192.168.1.0/31')).toBe(false);
    });
  });

  describe('Configuration export structure', () => {
    it('should export all required properties and functions', () => {
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs).toHaveProperty('whitelistedIPs');
      expect(storeIPs).toHaveProperty('whitelistedRanges');
      expect(storeIPs).toHaveProperty('sessionRenewal');
      expect(storeIPs).toHaveProperty('isWhitelisted');
      expect(storeIPs).toHaveProperty('isInRange');

      expect(Array.isArray(storeIPs.whitelistedIPs)).toBe(true);
      expect(Array.isArray(storeIPs.whitelistedRanges)).toBe(true);
      expect(typeof storeIPs.sessionRenewal).toBe('object');
      expect(typeof storeIPs.isWhitelisted).toBe('function');
      expect(typeof storeIPs.isInRange).toBe('function');
    });

    it('should have correct session renewal properties', () => {
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.sessionRenewal).toHaveProperty('checkInterval');
      expect(storeIPs.sessionRenewal).toHaveProperty('renewThreshold');
      expect(storeIPs.sessionRenewal).toHaveProperty('maxSessionDuration');

      expect(typeof storeIPs.sessionRenewal.checkInterval).toBe('number');
      expect(typeof storeIPs.sessionRenewal.renewThreshold).toBe('number');
      expect(typeof storeIPs.sessionRenewal.maxSessionDuration).toBe('number');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex whitelist configuration', () => {
      process.env.STORE_IP_ADDRESS = '192.168.1.100';
      process.env.ADDITIONAL_STORE_IPS = '192.168.1.101,192.168.1.102';
      process.env.STORE_IP_RANGES = '10.0.0.0/8,172.16.0.0/12';
      
      storeIPs = require('../../server/config/storeIPs');

      // Direct IPs
      expect(storeIPs.isWhitelisted('192.168.1.100')).toBe(true);
      expect(storeIPs.isWhitelisted('192.168.1.101')).toBe(true);
      expect(storeIPs.isWhitelisted('192.168.1.102')).toBe(true);
      
      // Range IPs
      expect(storeIPs.isWhitelisted('10.10.10.10')).toBe(true);
      expect(storeIPs.isWhitelisted('172.16.0.1')).toBe(true);
      expect(storeIPs.isWhitelisted('172.31.255.255')).toBe(true);
      
      // Non-whitelisted
      expect(storeIPs.isWhitelisted('192.168.2.100')).toBe(false);
      expect(storeIPs.isWhitelisted('11.0.0.1')).toBe(false);
      expect(storeIPs.isWhitelisted('172.32.0.1')).toBe(false);
    });

    it('should work with no configuration', () => {
      // All env vars are empty
      storeIPs = require('../../server/config/storeIPs');

      expect(storeIPs.whitelistedIPs).toEqual([]);
      expect(storeIPs.whitelistedRanges).toEqual([]);
      expect(storeIPs.isWhitelisted('192.168.1.1')).toBe(false);
    });
  });
});
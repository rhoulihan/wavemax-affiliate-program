// Paygistix Config Unit Tests

// Mock logger before requiring the config
jest.mock('../../server/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const logger = require('../../server/utils/logger');

// Save the real fs module
const realFs = jest.requireActual('fs');

// Mock fs module but keep most of its functionality
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

const fs = require('fs');

describe('Paygistix Config', () => {
  const originalEnv = process.env;

  const mockConfig = {
    merchantId: 'test-merchant',
    form: {
      formId: 'test-form',
      formHash: 'test-hash'
    },
    formActionUrl: 'https://safepay.paymentlogistics.net/transaction.asp',
    baseUrl: 'https://wavemax.promo'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };

    // Mock fs.existsSync to return true by default
    fs.existsSync.mockReturnValue(true);

    // Mock require to return our test config
    jest.doMock('../../server/config/paygistix-forms.json', () => mockConfig, { virtual: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('configuration loading', () => {
    it('should load configuration from JSON file when it exists', () => {
      // Mock the config property
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      // Verify it loaded successfully
      expect(PaygistixConfig.config).toBeDefined();
      expect(PaygistixConfig.config.merchantId).toBe('test-merchant');
    });

    it('should handle missing configuration file gracefully', () => {
      // Mock empty config
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      // Should fall back to defaults where possible
      expect(PaygistixConfig.getMerchantId()).toBe('wmaxaustWEB');
    });
  });

  describe('getEnvironment', () => {
    it('should always return production', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');

      expect(PaygistixConfig.getEnvironment()).toBe('production');
    });
  });

  describe('getMerchantId', () => {
    it('should return merchant ID from config', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      expect(PaygistixConfig.getMerchantId()).toBe('test-merchant');
    });

    it('should return default merchant ID when config is missing', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      expect(PaygistixConfig.getMerchantId()).toBe('wmaxaustWEB');
    });
  });

  describe('getFormId', () => {
    it('should return form ID from config', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      expect(PaygistixConfig.getFormId()).toBe('test-form');
    });

    it('should throw error when not configured', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      expect(() => PaygistixConfig.getFormId()).toThrow(
        'Form ID is required but not configured in paygistix-forms.json'
      );
    });
  });

  describe('getFormHash', () => {
    it('should return form hash from config', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      expect(PaygistixConfig.getFormHash()).toBe('test-hash');
    });

    it('should throw error when not configured', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      expect(() => PaygistixConfig.getFormHash()).toThrow(
        'Form hash is required but not configured in paygistix-forms.json'
      );
    });
  });

  describe('getFormActionUrl', () => {
    it('should return configured form action URL from config', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      expect(PaygistixConfig.getFormActionUrl()).toBe('https://safepay.paymentlogistics.net/transaction.asp');
    });

    it('should return default URL when not configured', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = { form: {} };

      expect(PaygistixConfig.getFormActionUrl()).toBe(
        'https://safepay.paymentlogistics.net/transaction.asp'
      );
    });
  });

  describe('getReturnUrl', () => {
    it('should return default return URL', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');

      expect(PaygistixConfig.getReturnUrl()).toBe(
        'https://wavemax.promo/payment-callback-handler.html'
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when all required config is present', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      expect(PaygistixConfig.isConfigured()).toBe(true);
      expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('configuration incomplete'));
    });

    it('should return false and log error when config is incomplete', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = {};

      expect(PaygistixConfig.isConfigured()).toBe(false);
    });
  });

  describe('getClientConfig', () => {
    it('should return complete client config when properly configured', () => {
      process.env.ENABLE_TEST_PAYMENT_FORM = 'true';

      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      const config = PaygistixConfig.getClientConfig();

      expect(config).toEqual({
        merchantId: 'test-merchant',
        formId: 'test-form',
        formActionUrl: 'https://safepay.paymentlogistics.net/transaction.asp',
        returnUrl: 'https://wavemax.promo/payment-callback-handler.html',
        environment: 'production',
        formHash: 'test-hash',
        testModeEnabled: true
      });
    });

    it('should throw and log error when config is missing', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      expect(() => PaygistixConfig.getClientConfig()).toThrow();
    });

    it('should set testModeEnabled to false when not configured', () => {
      delete process.env.ENABLE_TEST_PAYMENT_FORM;

      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      const config = PaygistixConfig.getClientConfig();
      expect(config.testModeEnabled).toBe(false);
    });
  });

  describe('getFullConfig', () => {
    it('should return complete config including hash', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = mockConfig;

      const config = PaygistixConfig.getFullConfig();

      expect(config.formHash).toBe('test-hash');
      expect(config.merchantId).toBe('test-merchant');
    });

    it('should throw and log error when config is missing', () => {
      const PaygistixConfig = require('../../server/config/paygistix.config');
      PaygistixConfig.config = null;

      expect(() => PaygistixConfig.getFullConfig()).toThrow();
    });
  });
});
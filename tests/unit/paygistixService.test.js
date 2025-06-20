const paygistixService = require('../../server/services/paygistix');
const paygistixConfig = require('../../server/config/paygistix.config');

// Mock the config module
jest.mock('../../server/config/paygistix.config');

describe('Paygistix Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return client config from paygistixConfig', () => {
      const mockConfig = {
        formUrl: 'https://test.paygistix.com',
        formHash: 'test-hash',
        merchantId: 'test-merchant'
      };

      paygistixConfig.getClientConfig.mockReturnValue(mockConfig);

      const result = paygistixService.getConfig();

      expect(paygistixConfig.getClientConfig).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      paygistixConfig.isConfigured.mockReturnValue(true);

      const result = paygistixService.isConfigured();

      expect(paygistixConfig.isConfigured).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when not configured', () => {
      paygistixConfig.isConfigured.mockReturnValue(false);

      const result = paygistixService.isConfigured();

      expect(paygistixConfig.isConfigured).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
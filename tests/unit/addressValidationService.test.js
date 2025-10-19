const axios = require('axios');
const addressValidationService = require('../../server/services/addressValidationService');

// Mock axios
jest.mock('axios');

describe('AddressValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAddress', () => {
    const validAddressData = {
      address: '123 Main Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701'
    };

    it('should return invalid if address is missing', async () => {
      const result = await addressValidationService.validateAddress({
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('All address fields are required');
    });

    it('should return invalid if city is missing', async () => {
      const result = await addressValidationService.validateAddress({
        address: '123 Main Street',
        state: 'TX',
        zipCode: '78701'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('All address fields are required');
    });

    it('should return invalid if state is missing', async () => {
      const result = await addressValidationService.validateAddress({
        address: '123 Main Street',
        city: 'Austin',
        zipCode: '78701'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('All address fields are required');
    });

    it('should return invalid if zipCode is missing', async () => {
      const result = await addressValidationService.validateAddress({
        address: '123 Main Street',
        city: 'Austin',
        state: 'TX'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('All address fields are required');
    });

    it('should return invalid for invalid ZIP code format', async () => {
      const result = await addressValidationService.validateAddress({
        ...validAddressData,
        zipCode: '1234' // Only 4 digits
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('ZIP code must be exactly 5 digits');
    });

    it('should return invalid for non-numeric ZIP code', async () => {
      const result = await addressValidationService.validateAddress({
        ...validAddressData,
        zipCode: 'ABCDE'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('ZIP code must be exactly 5 digits');
    });

    it('should successfully validate a complete address', async () => {
      const mockResponse = {
        data: [{
          lat: '30.2672',
          lon: '-97.7431',
          display_name: '123 Main Street, Austin, TX 78701, USA',
          address: {
            house_number: '123',
            road: 'Main Street',
            postcode: '78701'
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(true);
      expect(result.latitude).toBe(30.2672);
      expect(result.longitude).toBe(-97.7431);
      expect(result.displayName).toBeDefined();
      expect(result.formattedAddress).toBe('123 Main Street, Austin, TX 78701');
    });

    it('should try simplified query if full query returns no results', async () => {
      // First call returns empty array, second call returns results
      axios.get
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [{
            lat: '30.2672',
            lon: '-97.7431',
            display_name: '123 Main Street, TX 78701, USA',
            address: {
              house_number: '123',
              postcode: '78701'
            }
          }]
        });

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(true);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should return invalid when no geocoding results found', async () => {
      axios.get.mockResolvedValue({ data: [] });

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Unable to verify this address');
    });

    it('should return invalid for ZIP code mismatch', async () => {
      const mockResponse = {
        data: [{
          lat: '30.2672',
          lon: '-97.7431',
          display_name: '123 Main Street, Austin, TX 75201, USA',
          address: {
            house_number: '123',
            postcode: '75201' // Different ZIP code - different prefix (752 vs 787)
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('does not match the provided zip code');
    });

    it('should allow ZIP codes in the same general area (same prefix)', async () => {
      const mockResponse = {
        data: [{
          lat: '30.2672',
          lon: '-97.7431',
          display_name: '123 Main Street, Austin, TX 78702, USA',
          address: {
            house_number: '123',
            postcode: '78702' // Same 787xx prefix
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await addressValidationService.validateAddress({
        ...validAddressData,
        zipCode: '78705' // Different but same prefix
      });

      expect(result.valid).toBe(true);
    });

    it('should return invalid for house number mismatch', async () => {
      const mockResponse = {
        data: [{
          lat: '30.2672',
          lon: '-97.7431',
          display_name: '456 Main Street, Austin, TX 78701, USA',
          address: {
            house_number: '456',
            postcode: '78701'
          }
        }]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Unable to verify this exact address');
    });

    it('should handle rate limit errors', async () => {
      axios.get.mockRejectedValue({
        response: { status: 429 }
      });

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Too many address validation requests');
    });

    it('should handle general geocoding errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      const result = await addressValidationService.validateAddress(validAddressData);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Unable to validate address at this time');
    });
  });

  describe('validateAddressFormat', () => {
    it('should reject empty address', () => {
      const result = addressValidationService.validateAddressFormat('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('valid street address');
    });

    it('should reject very short address', () => {
      const result = addressValidationService.validateAddressFormat('123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('valid street address');
    });

    it('should reject address without house number', () => {
      const result = addressValidationService.validateAddressFormat('Main Street');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must start with a house number');
    });

    it('should accept valid address with house number', () => {
      const result = addressValidationService.validateAddressFormat('123 Main Street');
      expect(result.valid).toBe(true);
    });

    it('should accept address with letter suffix on house number', () => {
      const result = addressValidationService.validateAddressFormat('123A Main Street');
      expect(result.valid).toBe(true);
    });

    it('should reject house number zero', () => {
      const result = addressValidationService.validateAddressFormat('0 Main Street');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('valid house number');
    });

    it('should reject house number too large', () => {
      const result = addressValidationService.validateAddressFormat('100000 Main Street');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('valid house number');
    });

    it('should reject address with too short street name', () => {
      const result = addressValidationService.validateAddressFormat('123 M');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('valid street name');
    });

    it('should reject incomplete address (just street type)', () => {
      const result = addressValidationService.validateAddressFormat('123 Street');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('complete street name');
    });

    it('should reject incomplete address (just "Ave")', () => {
      const result = addressValidationService.validateAddressFormat('123 Ave');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('complete street name');
    });
  });

  describe('formatAddress', () => {
    it('should format address correctly', () => {
      const addressData = {
        address: '123 Main Street',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };

      const formatted = addressValidationService.formatAddress(addressData);
      expect(formatted).toBe('123 Main Street, Austin, TX 78701');
    });
  });

  describe('isWithinServiceArea', () => {
    it('should return true if location is within service area', () => {
      const serviceArea = {
        centerLat: 30.2672,
        centerLon: -97.7431,
        radiusMiles: 10
      };

      // Location about 5 miles away
      const result = addressValidationService.isWithinServiceArea(
        30.3,
        -97.7,
        serviceArea
      );

      expect(result).toBe(true);
    });

    it('should return false if location is outside service area', () => {
      const serviceArea = {
        centerLat: 30.2672,
        centerLon: -97.7431,
        radiusMiles: 1
      };

      // Location about 50 miles away
      const result = addressValidationService.isWithinServiceArea(
        31.0,
        -98.0,
        serviceArea
      );

      expect(result).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Austin to Dallas is approximately 182-195 miles depending on calculation
      const distance = addressValidationService.calculateDistance(
        30.2672, -97.7431, // Austin
        32.7767, -96.7970  // Dallas
      );

      expect(distance).toBeGreaterThan(180);
      expect(distance).toBeLessThan(195);
    });

    it('should return 0 for same location', () => {
      const distance = addressValidationService.calculateDistance(
        30.2672, -97.7431,
        30.2672, -97.7431
      );

      expect(distance).toBeCloseTo(0, 1);
    });
  });

  describe('toRad', () => {
    it('should convert degrees to radians', () => {
      const radians = addressValidationService.toRad(180);
      expect(radians).toBeCloseTo(Math.PI, 5);
    });

    it('should convert 0 degrees to 0 radians', () => {
      const radians = addressValidationService.toRad(0);
      expect(radians).toBe(0);
    });

    it('should convert 90 degrees to π/2 radians', () => {
      const radians = addressValidationService.toRad(90);
      expect(radians).toBeCloseTo(Math.PI / 2, 5);
    });
  });
});

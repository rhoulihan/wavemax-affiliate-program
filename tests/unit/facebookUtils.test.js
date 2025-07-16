const {
  parseSignedRequest,
  base64UrlDecode,
  generateStatusUrl,
  deleteFacebookData,
  findUsersByFacebookId,
  anonymizeUserData
} = require('../../server/utils/facebookUtils');
const crypto = require('crypto');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');

// Mock the models
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/logger');

describe('Facebook Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseSignedRequest', () => {
    const appSecret = 'test-app-secret';
    
    function createSignedRequest(payload, secret) {
      const encodedPayload = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const sig = crypto
        .createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      return `${sig}.${encodedPayload}`;
    }

    it('should parse valid signed request', () => {
      const payload = {
        user_id: '123456789',
        algorithm: 'HMAC-SHA256',
        issued_at: Date.now() / 1000
      };
      
      const signedRequest = createSignedRequest(payload, appSecret);
      const result = parseSignedRequest(signedRequest, appSecret);
      
      expect(result).toEqual(payload);
    });

    it('should return null for invalid signature', () => {
      const payload = {
        user_id: '123456789',
        algorithm: 'HMAC-SHA256'
      };
      
      const signedRequest = createSignedRequest(payload, 'wrong-secret');
      const result = parseSignedRequest(signedRequest, appSecret);
      
      expect(result).toBeNull();
    });

    it('should return null for malformed signed request', () => {
      expect(parseSignedRequest('invalid', appSecret)).toBeNull();
      expect(parseSignedRequest('only.one.dot', appSecret)).toBeNull();
      expect(parseSignedRequest('', appSecret)).toBeNull();
    });

    it('should return null when missing parameters', () => {
      const signedRequest = createSignedRequest({ user_id: '123' }, appSecret);
      
      expect(parseSignedRequest(signedRequest, null)).toBeNull();
      expect(parseSignedRequest(null, appSecret)).toBeNull();
      expect(parseSignedRequest(null, null)).toBeNull();
    });

    it('should handle invalid JSON in payload', () => {
      const invalidSignedRequest = 'validbase64.invalidjson';
      const result = parseSignedRequest(invalidSignedRequest, appSecret);
      
      expect(result).toBeNull();
    });
  });

  describe('base64UrlDecode', () => {
    it('should decode base64 URL encoded strings', () => {
      const original = 'Hello World!';
      const encoded = Buffer.from(original)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toBe(original);
    });

    it('should handle strings without padding', () => {
      const encoded = 'SGVsbG8'; // "Hello" without padding
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toBe('Hello');
    });

    it('should handle strings with URL-safe characters', () => {
      const encoded = 'SGVs-bG8_d29ybGQ'; // Contains - and _
      const decoded = base64UrlDecode(encoded);
      expect(decoded).toBeTruthy();
    });
  });

  describe('generateStatusUrl', () => {
    it('should generate correct status URL', () => {
      const code = 'ABC123';
      const baseUrl = 'https://example.com';
      
      const url = generateStatusUrl(code, baseUrl);
      expect(url).toBe('https://example.com/deletion-status?code=ABC123');
    });

    it('should handle base URL with trailing slash', () => {
      const code = 'XYZ789';
      const baseUrl = 'https://example.com/';
      
      const url = generateStatusUrl(code, baseUrl);
      expect(url).toBe('https://example.com/deletion-status?code=XYZ789');
    });

    it('should handle base URL with path', () => {
      const code = 'TEST123';
      const baseUrl = 'https://example.com/app';
      
      const url = generateStatusUrl(code, baseUrl);
      expect(url).toBe('https://example.com/app/deletion-status?code=TEST123');
    });
  });

  describe('deleteFacebookData', () => {
    let mockUser;

    beforeEach(() => {
      mockUser = {
        socialAccounts: {
          facebook: {
            id: 'fb123',
            email: 'test@facebook.com',
            name: 'Test User',
            accessToken: 'token123',
            linkedAt: new Date()
          }
        },
        registrationMethod: 'facebook',
        save: jest.fn().mockResolvedValue(true)
      };
    });

    it('should delete all Facebook data from user', async () => {
      const deletedData = await deleteFacebookData(mockUser);
      
      expect(deletedData).toEqual([
        'facebook_id',
        'facebook_email',
        'facebook_name',
        'facebook_access_token',
        'registration_method'
      ]);
      
      expect(mockUser.socialAccounts.facebook).toEqual({
        id: null,
        email: null,
        name: null,
        accessToken: null,
        linkedAt: null
      });
      
      expect(mockUser.registrationMethod).toBe('traditional');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle user without Facebook data', async () => {
      mockUser.socialAccounts.facebook = {};
      mockUser.registrationMethod = 'standard';
      
      const deletedData = await deleteFacebookData(mockUser);
      
      expect(deletedData).toEqual([]);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle user without socialAccounts', async () => {
      mockUser.socialAccounts = null;
      
      const deletedData = await deleteFacebookData(mockUser);
      
      expect(deletedData).toEqual([]);
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should only update registration method if it was facebook', async () => {
      mockUser.registrationMethod = 'google';
      
      const deletedData = await deleteFacebookData(mockUser);
      
      expect(mockUser.registrationMethod).toBe('google');
      expect(deletedData).not.toContain('registration_method');
    });
  });

  describe('findUsersByFacebookId', () => {
    it('should find both affiliate and customer', async () => {
      const facebookId = 'fb123';
      const mockAffiliate = { _id: 'aff123', name: 'Affiliate' };
      const mockCustomer = { _id: 'cust123', name: 'Customer' };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      const result = await findUsersByFacebookId(facebookId);
      
      expect(result).toEqual({
        affiliate: mockAffiliate,
        customer: mockCustomer
      });
      
      expect(Affiliate.findOne).toHaveBeenCalledWith({
        'socialAccounts.facebook.id': facebookId
      });
      expect(Customer.findOne).toHaveBeenCalledWith({
        'socialAccounts.facebook.id': facebookId
      });
    });

    it('should handle when only affiliate exists', async () => {
      const facebookId = 'fb456';
      const mockAffiliate = { _id: 'aff456' };
      
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(null);
      
      const result = await findUsersByFacebookId(facebookId);
      
      expect(result).toEqual({
        affiliate: mockAffiliate,
        customer: null
      });
    });

    it('should handle when no users exist', async () => {
      const facebookId = 'fb789';
      
      Affiliate.findOne.mockResolvedValue(null);
      Customer.findOne.mockResolvedValue(null);
      
      const result = await findUsersByFacebookId(facebookId);
      
      expect(result).toEqual({
        affiliate: null,
        customer: null
      });
    });
  });

  describe('anonymizeUserData', () => {
    let mockUser;
    const mockTimestamp = 1234567890;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      
      mockUser = {
        email: 'user@example.com',
        name: 'John Doe',
        phone: '+1234567890',
        socialAccounts: {
          facebook: {
            id: 'fb123',
            email: 'fb@example.com'
          }
        },
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should anonymize all user data', async () => {
      const anonymizedData = await anonymizeUserData(mockUser);
      
      expect(anonymizedData).toEqual([
        'email',
        'name',
        'phone',
        'facebook_data'
      ]);
      
      expect(mockUser.email).toBe(`DELETED_${mockTimestamp}_@deleted.com`);
      expect(mockUser.name).toBe(`Deleted User DELETED_${mockTimestamp}_`);
      expect(mockUser.phone).toBeNull();
      expect(mockUser.socialAccounts.facebook).toEqual({
        id: null,
        email: null,
        name: null,
        accessToken: null,
        linkedAt: null
      });
      expect(mockUser.isActive).toBe(false);
      expect(mockUser.deletedAt).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle user with partial data', async () => {
      delete mockUser.phone;
      delete mockUser.socialAccounts;
      
      const anonymizedData = await anonymizeUserData(mockUser);
      
      expect(anonymizedData).toEqual(['email', 'name']);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle user with no personal data', async () => {
      mockUser = {
        _id: '123',
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };
      
      const anonymizedData = await anonymizeUserData(mockUser);
      
      expect(anonymizedData).toEqual([]);
      expect(mockUser.isActive).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
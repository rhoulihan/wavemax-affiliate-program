const mongoose = require('mongoose');
const Affiliate = require('../../server/models/Affiliate');
const encryptionUtil = require('../../server/utils/encryption');

// Mock encryption utility
jest.mock('../../server/utils/encryption');

describe('Affiliate Model - Additional Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup encryption mocks
    encryptionUtil.hashPassword = jest.fn().mockReturnValue({
      salt: 'test-salt',
      hash: 'test-hash'
    });
    encryptionUtil.encrypt = jest.fn().mockImplementation(value => `encrypted_${value}`);
    encryptionUtil.decrypt = jest.fn().mockImplementation(value => {
      if (value && value.startsWith('encrypted_')) {
        return value.replace('encrypted_', '');
      }
      return value;
    });
  });

  describe('Payment Method Default', () => {
    it('should default payment method to check for social registration', () => {
      // Create a schema instance to test the default function
      const schema = Affiliate.schema;
      const paymentMethodPath = schema.path('paymentMethod');
      
      // Mock 'this' context for the default function
      const context = {
        registrationMethod: 'google'
      };
      
      // Call the default function with the mocked context
      const defaultValue = paymentMethodPath.options.default.call(context);
      
      expect(defaultValue).toBe('check');
    });

    it('should not set default payment method for traditional registration', () => {
      // Create a schema instance to test the default function
      const schema = Affiliate.schema;
      const paymentMethodPath = schema.path('paymentMethod');
      
      // Mock 'this' context for the default function
      const context = {
        registrationMethod: 'traditional'
      };
      
      // Call the default function with the mocked context
      const defaultValue = paymentMethodPath.options.default.call(context);
      
      expect(defaultValue).toBeUndefined();
    });

    it('should not set default payment method when registrationMethod is not set', () => {
      // Create a schema instance to test the default function
      const schema = Affiliate.schema;
      const paymentMethodPath = schema.path('paymentMethod');
      
      // Mock 'this' context for the default function
      const context = {};
      
      // Call the default function with the mocked context
      const defaultValue = paymentMethodPath.options.default.call(context);
      
      expect(defaultValue).toBeUndefined();
    });
  });

  describe('Pre-save hooks', () => {
    it('should test password hashing in pre-save hook', async () => {
      // For social registration, passwordHash/Salt are not required
      // So we can test the pre-save hook properly
      const affiliate = new Affiliate({
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        phone: '555-123-4567',
        address: '123 Test St',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        serviceLatitude: 30.0,
        serviceLongitude: -97.0,
        paymentMethod: 'check',
        registrationMethod: 'social',  // Use social registration to avoid validation error
        password: 'plainTextPassword'
      });
      
      // Clear previous mock calls
      encryptionUtil.hashPassword.mockClear();
      
      await affiliate.save();
      
      expect(encryptionUtil.hashPassword).toHaveBeenCalledWith('plainTextPassword');
      expect(affiliate.passwordSalt).toBe('test-salt');
      expect(affiliate.passwordHash).toBe('test-hash');
      expect(affiliate.password).toBeUndefined();
    });

    it('should not hash password if passwordHash already exists', async () => {
      const affiliate = new Affiliate({
        email: 'test2@example.com',
        username: 'testuser2',
        firstName: 'Test',
        lastName: 'User2',
        phone: '555-123-4568',
        address: '124 Test St',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        serviceLatitude: 30.0,
        serviceLongitude: -97.0,
        paymentMethod: 'check',
        passwordHash: 'existing-hash',
        passwordSalt: 'existing-salt'
      });
      
      affiliate.password = 'newPassword';
      affiliate.markModified('password');
      
      // Clear previous calls
      encryptionUtil.hashPassword.mockClear();
      
      await affiliate.save();
      
      expect(encryptionUtil.hashPassword).not.toHaveBeenCalled();
      expect(affiliate.passwordHash).toBe('existing-hash');
      expect(affiliate.passwordSalt).toBe('existing-salt');
    });

    it('should test account number encryption in pre-save hook', async () => {
      const affiliate = new Affiliate({
        email: 'test3@example.com',
        username: 'testuser3',
        firstName: 'Test',
        lastName: 'User3',
        phone: '555-123-4569',
        address: '125 Test St',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        serviceLatitude: 30.0,
        serviceLongitude: -97.0,
        paymentMethod: 'paypal',
        paypalEmail: 'paypal@example.com',
        venmoHandle: '@testuser-venmo',
        passwordHash: 'hash',
        passwordSalt: 'salt'
      });
      
      await affiliate.save();
      
      expect(encryptionUtil.encrypt).toHaveBeenCalledWith('paypal@example.com');
      expect(encryptionUtil.encrypt).toHaveBeenCalledWith('@testuser-venmo');
      expect(affiliate.paypalEmail).toBe('encrypted_paypal@example.com');
      expect(affiliate.venmoHandle).toBe('encrypted_@testuser-venmo');
    });

    it('should not encrypt non-string values', async () => {
      const affiliate = new Affiliate({
        email: 'test4@example.com',
        username: 'testuser4',
        firstName: 'Test',
        lastName: 'User4',
        phone: '555-123-4570',
        address: '126 Test St',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        serviceLatitude: 30.0,
        serviceLongitude: -97.0,
        paymentMethod: 'check',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paypalEmail: 123, // number instead of string
        venmoHandle: null
      });
      
      // Clear previous calls
      encryptionUtil.encrypt.mockClear();
      
      await affiliate.save();
      
      expect(encryptionUtil.encrypt).not.toHaveBeenCalled();
    });

    it('should not encrypt if fields are not modified', async () => {
      // First create an affiliate with encrypted values
      const affiliate = new Affiliate({
        email: 'test5@example.com',
        username: 'testuser5',
        firstName: 'Test',
        lastName: 'User5',
        phone: '555-123-4571',
        address: '127 Test St',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        serviceLatitude: 30.0,
        serviceLongitude: -97.0,
        paymentMethod: 'check',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        paypalEmail: 'encrypted_existing',
        venmoHandle: 'encrypted_existing'
      });
      
      await affiliate.save();
      
      // Clear previous calls
      encryptionUtil.encrypt.mockClear();
      
      // Save again without modifying the fields
      affiliate.name = 'Updated Name';
      await affiliate.save();
      
      expect(encryptionUtil.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('Instance Methods', () => {
    // Note: The getDecrypted* methods were removed as part of security updates
    // These tests are now obsolete and have been removed
  });
});
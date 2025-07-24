// Unit tests for Affiliate model methods
const Affiliate = require('../../server/models/Affiliate');
const { hashPassword } = require('../../server/utils/encryption');

describe('Affiliate Model Methods', () => {
  // Helper to create affiliate with hashed password
  const createAffiliateData = (data) => {
    if (data.password) {
      const { salt, hash } = hashPassword(data.password);
      const { password, ...rest } = data;
      return {
        ...rest,
        passwordSalt: salt,
        passwordHash: hash
      };
    }
    return data;
  };

  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  describe('Virtual Properties', () => {
    it('should calculate full name virtual property', async () => {
      const affiliate = new Affiliate(createAffiliateData({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        username: 'johndoe',
        password: 'StrongPassword123!',
        paymentMethod: 'check'
      }));

      expect(affiliate.name).toBe('John Doe');

      // Test with different names
      affiliate.firstName = 'Jane';
      affiliate.lastName = 'Smith';
      expect(affiliate.name).toBe('Jane Smith');

      // Test with empty last name
      affiliate.lastName = '';
      expect(affiliate.name).toBe('Jane ');
    });
  });

  describe('Payment Methods', () => {
    it('should determine if affiliate can receive payments', async () => {
      const affiliate = new Affiliate(createAffiliateData({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        username: 'johndoe',
        password: 'StrongPassword123!',
        paymentMethod: 'check',
        isActive: true,
        w9Information: {
          status: 'verified'
        }
      }));

      // Verified W9 and active - can receive payments
      expect(affiliate.canReceivePayments()).toBe(true);

      // Pending W9 - cannot receive payments
      affiliate.w9Information.status = 'pending_review';
      expect(affiliate.canReceivePayments()).toBe(false);

      // Not submitted W9 - cannot receive payments
      affiliate.w9Information.status = 'not_submitted';
      expect(affiliate.canReceivePayments()).toBe(false);

      // Rejected W9 - cannot receive payments
      affiliate.w9Information.status = 'rejected';
      expect(affiliate.canReceivePayments()).toBe(false);

      // Verified but inactive - cannot receive payments
      affiliate.w9Information.status = 'verified';
      affiliate.isActive = false;
      expect(affiliate.canReceivePayments()).toBe(false);
    });
  });

  describe('W9 Status Display', () => {
    it('should return correct W9 status display text', async () => {
      const affiliate = new Affiliate(createAffiliateData({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        username: 'johndoe',
        password: 'StrongPassword123!',
        paymentMethod: 'check',
        w9Information: {
          status: 'not_submitted'
        }
      }));

      // Test all W9 statuses
      expect(affiliate.getW9StatusDisplay()).toBe('Waiting for Upload');

      affiliate.w9Information.status = 'pending_review';
      expect(affiliate.getW9StatusDisplay()).toBe('Awaiting Review');

      affiliate.w9Information.status = 'verified';
      expect(affiliate.getW9StatusDisplay()).toBe('Approved');

      affiliate.w9Information.status = 'rejected';
      expect(affiliate.getW9StatusDisplay()).toBe('Rejected');

      affiliate.w9Information.status = 'expired';
      expect(affiliate.getW9StatusDisplay()).toBe('Expired - Update Required');

      // Test unknown status
      affiliate.w9Information.status = 'unknown_status';
      expect(affiliate.getW9StatusDisplay()).toBe('Unknown Status');

      // Test undefined status
      affiliate.w9Information.status = undefined;
      expect(affiliate.getW9StatusDisplay()).toBe('Unknown Status');
    });
  });
});
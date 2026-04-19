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
    it('should determine if affiliate can receive commission payouts', async () => {
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
        isActive: true
      }));

      // Active and unlocked — can receive payouts
      expect(affiliate.canReceivePayments()).toBe(true);

      // Locked — cannot receive payouts
      affiliate.paymentProcessingLocked = true;
      expect(affiliate.canReceivePayments()).toBe(false);

      // Unlocked but inactive — cannot receive payouts
      affiliate.paymentProcessingLocked = false;
      affiliate.isActive = false;
      expect(affiliate.canReceivePayments()).toBe(false);
    });
  });
});
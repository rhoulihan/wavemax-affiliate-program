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

      // Active — can receive payouts
      expect(affiliate.canReceivePayments()).toBe(true);

      // Inactive — cannot receive payouts
      affiliate.isActive = false;
      expect(affiliate.canReceivePayments()).toBe(false);
    });
  });

  describe('serviceType + order notifications', () => {
    const base = {
      firstName: 'Pat', lastName: 'Lee', phone: '555-0000',
      address: '1 A St', city: 'Austin', state: 'TX', zipCode: '78701',
      password: 'StrongPassword123!', paymentMethod: 'check'
    };

    it('defaults serviceType to pickup_location and notifications OFF', async () => {
      const a = await new Affiliate(createAffiliateData({
        ...base, email: 'pl@example.com', username: 'pl1'
      })).save();
      expect(a.serviceType).toBe('pickup_location');
      expect(a.orderNotificationsEnabled).toBe(false);
    });

    it('full_service defaults notifications ON', async () => {
      const a = await new Affiliate(createAffiliateData({
        ...base, email: 'fs@example.com', username: 'fs1', serviceType: 'full_service'
      })).save();
      expect(a.serviceType).toBe('full_service');
      expect(a.orderNotificationsEnabled).toBe(true);
    });

    it('explicit notifications setting wins over the serviceType default', async () => {
      const a = await new Affiliate(createAffiliateData({
        ...base, email: 'fs2@example.com', username: 'fs2',
        serviceType: 'full_service', orderNotificationsEnabled: false
      })).save();
      expect(a.orderNotificationsEnabled).toBe(false);

      const b = await new Affiliate(createAffiliateData({
        ...base, email: 'pl2@example.com', username: 'pl2',
        serviceType: 'pickup_location', orderNotificationsEnabled: true
      })).save();
      expect(b.orderNotificationsEnabled).toBe(true);
    });

    it('rejects an invalid serviceType', async () => {
      const a = new Affiliate(createAffiliateData({
        ...base, email: 'bad@example.com', username: 'bad1', serviceType: 'nope'
      }));
      await expect(a.save()).rejects.toThrow();
    });
  });

  describe('flat deliveryFee + deliveryInstructions', () => {
    const base = {
      firstName: 'Pat', lastName: 'Lee', phone: '555-0000',
      address: '1 A St', city: 'Austin', state: 'TX', zipCode: '78701',
      password: 'StrongPassword123!', paymentMethod: 'check'
    };

    it('defaults deliveryFee to 0 and leaves deliveryInstructions unset', async () => {
      const a = await new Affiliate(createAffiliateData({
        ...base, email: 'df0@example.com', username: 'df0'
      })).save();
      expect(a.deliveryFee).toBe(0);
      expect(a.deliveryInstructions).toBeUndefined();
    });

    it('persists a non-zero deliveryFee and trimmed deliveryInstructions', async () => {
      const a = await new Affiliate(createAffiliateData({
        ...base, email: 'df1@example.com', username: 'df1',
        deliveryFee: 9.99, deliveryInstructions: '  Ring the bell.  '
      })).save();
      expect(a.deliveryFee).toBe(9.99);
      expect(a.deliveryInstructions).toBe('Ring the bell.');
    });

    it('rejects a deliveryFee above the max', async () => {
      const a = new Affiliate(createAffiliateData({
        ...base, email: 'df2@example.com', username: 'df2', deliveryFee: 2000
      }));
      await expect(a.save()).rejects.toThrow();
    });

    it('rejects a negative deliveryFee', async () => {
      const a = new Affiliate(createAffiliateData({
        ...base, email: 'df3@example.com', username: 'df3', deliveryFee: -1
      }));
      await expect(a.save()).rejects.toThrow();
    });
  });
});
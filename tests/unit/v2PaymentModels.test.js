const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');

describe('V2 Payment System Model Updates', () => {
  // Use existing mongoose connection from setup.js
  
  // Helper function to create affiliate with required fields
  const createTestAffiliate = async (overrides = {}) => {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    
    const defaults = {
      firstName: 'Test',
      lastName: 'Affiliate',
      email: `affiliate${Date.now()}@test.com`,
      phone: '555-1234',
      address: '123 Test St',
      city: 'Test City', 
      state: 'TX',
      zipCode: '12345',
      serviceLatitude: 30.123,
      serviceLongitude: -97.456,
      username: `affiliate${Date.now()}`,
      passwordHash: hash,
      passwordSalt: salt,
      paymentMethod: 'check'
    };
    return await Affiliate.create({ ...defaults, ...overrides });
  };
  
  // Helper function to create customer with required fields
  const createTestCustomer = async (affiliate, overrides = {}) => {
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('password123', salt, 1000, 64, 'sha512').toString('hex');
    
    const defaults = {
      firstName: 'Test',
      lastName: 'Customer',
      email: `customer${Date.now()}@test.com`,
      phone: '555-5678',
      address: '123 Main St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      username: `testcustomer${Date.now()}`,
      passwordHash: hash,
      passwordSalt: salt,
      affiliateId: affiliate._id
    };
    return await Customer.create({ ...defaults, ...overrides });
  };
  
  afterAll(async () => {
    // Clean up test data
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
  });

  describe('Order Model V2 Payment Fields', () => {
    let customer, affiliate;

    beforeEach(async () => {
      affiliate = await createTestAffiliate();

      customer = await createTestCustomer(affiliate, {
        firstName: 'Order',
        lastName: 'TestCustomer',
        email: 'ordercustomer@test.com',
        phone: '555-6666',
        address: '999 Order St',
        city: 'Order City',
        state: 'OR',
        zipCode: '99999',
        registrationVersion: 'v2'
      });
    });

    it('should create order with V2 payment fields defaults', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2
      });

      // Check V2 payment defaults
      expect(order.paymentStatus).toBe('pending');
      expect(order.paymentMethod).toBe('pending');
      expect(order.paymentAmount).toBe(0);
      expect(order.paymentCheckAttempts).toBe(0);
      expect(order.paymentLinks).toEqual({});
      expect(order.paymentQRCodes).toEqual({});
      expect(order.paymentRequestedAt).toBeUndefined();
      expect(order.paymentVerifiedAt).toBeUndefined();
    });

    it('should update V2 payment status correctly', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 25,
        numberOfBags: 2,
        paymentStatus: 'awaiting',
        paymentAmount: 45.50,
        paymentRequestedAt: new Date()
      });

      expect(order.paymentStatus).toBe('awaiting');
      expect(order.paymentAmount).toBe(45.50);
      expect(order.paymentRequestedAt).toBeInstanceOf(Date);

      // Update to verified
      order.paymentStatus = 'verified';
      order.paymentMethod = 'venmo';
      order.paymentVerifiedAt = new Date();
      order.paymentTransactionId = 'VENMO123456';
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('verified');
      expect(updatedOrder.paymentMethod).toBe('venmo');
      expect(updatedOrder.paymentTransactionId).toBe('VENMO123456');
    });

    it('should store payment links and QR codes', async () => {
      const paymentLinks = {
        venmo: 'venmo://paycharge?txn=pay&recipients=test',
        paypal: 'https://paypal.me/test/50USD',
        cashapp: 'https://cash.app/$test/50'
      };

      const qrCodes = {
        venmo: 'data:image/png;base64,venmoQR',
        paypal: 'data:image/png;base64,paypalQR',
        cashapp: 'data:image/png;base64,cashappQR'
      };

      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 30,
        numberOfBags: 2,
        paymentLinks: paymentLinks,
        paymentQRCodes: qrCodes
      });

      expect(order.paymentLinks.venmo).toBe(paymentLinks.venmo);
      expect(order.paymentLinks.paypal).toBe(paymentLinks.paypal);
      expect(order.paymentLinks.cashapp).toBe(paymentLinks.cashapp);

      expect(order.paymentQRCodes.venmo).toBe(qrCodes.venmo);
      expect(order.paymentQRCodes.paypal).toBe(qrCodes.paypal);
      expect(order.paymentQRCodes.cashapp).toBe(qrCodes.cashapp);
    });

    it('should track payment check attempts', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 15,
        numberOfBags: 1,
        paymentStatus: 'awaiting',
        paymentCheckAttempts: 5,
        lastPaymentCheck: new Date()
      });

      expect(order.paymentCheckAttempts).toBe(5);
      expect(order.lastPaymentCheck).toBeInstanceOf(Date);

      // Increment attempts
      order.paymentCheckAttempts += 1;
      order.lastPaymentCheck = new Date();
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentCheckAttempts).toBe(6);
    });

    it('should validate V2 payment status enum', async () => {
      const order = new Order({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '8:00 PM - 10:00 PM',
        estimatedWeight: 20,
        numberOfBags: 2,
        paymentStatus: 'invalid_status' // Invalid enum value
      });

      await expect(order.save()).rejects.toThrow(/validation failed/);
    });

    it('should validate V2 payment method enum', async () => {
      const order = new Order({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 18,
        numberOfBags: 2,
        paymentMethod: 'bitcoin' // Invalid enum value
      });

      await expect(order.save()).rejects.toThrow(/validation failed/);
    });

    it('should store payment notes', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 22,
        numberOfBags: 2,
        paymentNotes: 'Payment verified via email confirmation from Venmo'
      });

      expect(order.paymentNotes).toBe('Payment verified via email confirmation from Venmo');
    });
  });

});
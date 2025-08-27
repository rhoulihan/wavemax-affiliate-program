const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');

describe('V2 Payment System Model Updates', () => {
  // Use existing mongoose connection from setup.js
  
  // Helper function to create affiliate with required fields
  const createTestAffiliate = async (overrides = {}) => {
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
      password: 'testpass123',
      paymentMethod: 'check'
    };
    return await Affiliate.create({ ...defaults, ...overrides });
  };
  
  afterAll(async () => {
    // Clean up test data
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
  });

  describe('Customer Model V2 Fields', () => {
    it('should create customer with V1 registration by default', async () => {
      const affiliate = await createTestAffiliate();

      const customer = await Customer.create({
        name: 'Test Customer',
        email: 'customer@test.com',
        phoneNumber: '555-5678',
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345'
        },
        username: 'testcustomer',
        password: 'password123',
        affiliateId: affiliate._id
      });

      expect(customer.registrationVersion).toBe('v1');
      expect(customer.initialBagsRequested).toBe(1);
    });

    it('should create V2 customer with custom bag count', async () => {
      const affiliate = await createTestAffiliate();

      const customer = await Customer.create({
        name: 'V2 Customer',
        email: 'v2customer@test.com',
        phoneNumber: '555-6789',
        address: {
          street: '456 Oak St',
          city: 'Test Town',
          state: 'CA',
          zipCode: '54321'
        },
        username: 'v2customer',
        password: 'password123',
        affiliateId: affiliate._id,
        registrationVersion: 'v2',
        initialBagsRequested: 2
      });

      expect(customer.registrationVersion).toBe('v2');
      expect(customer.initialBagsRequested).toBe(2);
    });

    it('should validate registrationVersion enum values', async () => {
      const affiliate = await createTestAffiliate();

      const invalidCustomer = new Customer({
        name: 'Invalid Customer',
        email: 'invalid@test.com',
        phoneNumber: '555-7890',
        address: {
          street: '789 Pine St',
          city: 'Error City',
          state: 'NY',
          zipCode: '67890'
        },
        username: 'invalidcustomer',
        password: 'password123',
        affiliateId: affiliate._id,
        registrationVersion: 'v3' // Invalid value
      });

      await expect(invalidCustomer.save()).rejects.toThrow(/validation failed/);
    });

    it('should validate initialBagsRequested range', async () => {
      const affiliate = await createTestAffiliate();

      // Test max value
      const customer1 = new Customer({
        name: 'Max Bags Customer',
        email: 'maxbags@test.com',
        phoneNumber: '555-8901',
        address: {
          street: '100 Max St',
          city: 'Max City',
          state: 'FL',
          zipCode: '11111'
        },
        username: 'maxbags',
        password: 'password123',
        affiliateId: affiliate._id,
        registrationVersion: 'v2',
        initialBagsRequested: 3 // Above max
      });

      await expect(customer1.save()).rejects.toThrow(/validation failed/);

      // Test min value
      const customer2 = new Customer({
        name: 'Min Bags Customer',
        email: 'minbags@test.com',
        phoneNumber: '555-9012',
        address: {
          street: '200 Min St',
          city: 'Min City',
          state: 'GA',
          zipCode: '22222'
        },
        username: 'minbags',
        password: 'password123',
        affiliateId: affiliate._id,
        registrationVersion: 'v2',
        initialBagsRequested: 0 // Below min
      });

      await expect(customer2.save()).rejects.toThrow(/validation failed/);
    });
  });

  describe('Order Model V2 Payment Fields', () => {
    let customer, affiliate;

    beforeEach(async () => {
      affiliate = await createTestAffiliate();

      customer = await Customer.create({
        name: 'Order Test Customer',
        email: 'ordercustomer@test.com',
        phoneNumber: '555-6666',
        address: {
          street: '999 Order St',
          city: 'Order City',
          state: 'OR',
          zipCode: '99999'
        },
        username: `ordercustomer${Date.now()}`,
        password: 'password123',
        affiliateId: affiliate._id,
        registrationVersion: 'v2'
      });
    });

    it('should create order with V2 payment fields defaults', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '10:00 AM - 12:00 PM',
        estimatedWeight: 20,
        numberOfBags: 2
      });

      // Check V2 payment defaults
      expect(order.v2PaymentStatus).toBe('pending');
      expect(order.v2PaymentMethod).toBe('pending');
      expect(order.v2PaymentAmount).toBe(0);
      expect(order.v2PaymentCheckAttempts).toBe(0);
      expect(order.v2PaymentLinks).toBeUndefined();
      expect(order.v2PaymentQRCodes).toBeUndefined();
      expect(order.v2PaymentRequestedAt).toBeUndefined();
      expect(order.v2PaymentVerifiedAt).toBeUndefined();
    });

    it('should update V2 payment status correctly', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '2:00 PM - 4:00 PM',
        estimatedWeight: 25,
        numberOfBags: 2,
        v2PaymentStatus: 'awaiting',
        v2PaymentAmount: 45.50,
        v2PaymentRequestedAt: new Date()
      });

      expect(order.v2PaymentStatus).toBe('awaiting');
      expect(order.v2PaymentAmount).toBe(45.50);
      expect(order.v2PaymentRequestedAt).toBeInstanceOf(Date);

      // Update to verified
      order.v2PaymentStatus = 'verified';
      order.v2PaymentMethod = 'venmo';
      order.v2PaymentVerifiedAt = new Date();
      order.v2PaymentTransactionId = 'VENMO123456';
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.v2PaymentStatus).toBe('verified');
      expect(updatedOrder.v2PaymentMethod).toBe('venmo');
      expect(updatedOrder.v2PaymentTransactionId).toBe('VENMO123456');
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
        pickupTime: '4:00 PM - 6:00 PM',
        estimatedWeight: 30,
        numberOfBags: 2,
        v2PaymentLinks: paymentLinks,
        v2PaymentQRCodes: qrCodes
      });

      expect(order.v2PaymentLinks.venmo).toBe(paymentLinks.venmo);
      expect(order.v2PaymentLinks.paypal).toBe(paymentLinks.paypal);
      expect(order.v2PaymentLinks.cashapp).toBe(paymentLinks.cashapp);

      expect(order.v2PaymentQRCodes.venmo).toBe(qrCodes.venmo);
      expect(order.v2PaymentQRCodes.paypal).toBe(qrCodes.paypal);
      expect(order.v2PaymentQRCodes.cashapp).toBe(qrCodes.cashapp);
    });

    it('should track payment check attempts', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '6:00 PM - 8:00 PM',
        estimatedWeight: 15,
        numberOfBags: 1,
        v2PaymentStatus: 'awaiting',
        v2PaymentCheckAttempts: 5,
        v2LastPaymentCheck: new Date()
      });

      expect(order.v2PaymentCheckAttempts).toBe(5);
      expect(order.v2LastPaymentCheck).toBeInstanceOf(Date);

      // Increment attempts
      order.v2PaymentCheckAttempts += 1;
      order.v2LastPaymentCheck = new Date();
      await order.save();

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.v2PaymentCheckAttempts).toBe(6);
    });

    it('should validate V2 payment status enum', async () => {
      const order = new Order({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '8:00 PM - 10:00 PM',
        estimatedWeight: 20,
        numberOfBags: 2,
        v2PaymentStatus: 'invalid_status' // Invalid enum value
      });

      await expect(order.save()).rejects.toThrow(/validation failed/);
    });

    it('should validate V2 payment method enum', async () => {
      const order = new Order({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '10:00 PM - 12:00 AM',
        estimatedWeight: 18,
        numberOfBags: 2,
        v2PaymentMethod: 'bitcoin' // Invalid enum value
      });

      await expect(order.save()).rejects.toThrow(/validation failed/);
    });

    it('should store payment notes', async () => {
      const order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '12:00 AM - 2:00 AM',
        estimatedWeight: 22,
        numberOfBags: 2,
        v2PaymentNotes: 'Payment verified via email confirmation from Venmo'
      });

      expect(order.v2PaymentNotes).toBe('Payment verified via email confirmation from Venmo');
    });
  });

  describe('V1 Compatibility', () => {
    it('should not affect existing V1 customers', async () => {
      const affiliate = await createTestAffiliate();

      const v1Customer = await Customer.create({
        name: 'V1 Customer',
        email: 'v1customer@test.com',
        phoneNumber: '555-8888',
        address: {
          street: '111 Legacy St',
          city: 'Old City',
          state: 'TX',
          zipCode: '11111'
        },
        username: 'v1customer',
        password: 'password123',
        affiliateId: affiliate._id,
        numberOfBags: 3,
        bagCredit: 50.00
      });

      expect(v1Customer.registrationVersion).toBe('v1');
      expect(v1Customer.numberOfBags).toBe(3);
      expect(v1Customer.bagCredit).toBe(50.00);
      expect(v1Customer.bagCreditApplied).toBe(false);
    });

    it('should not affect existing V1 orders', async () => {
      const affiliate = await createTestAffiliate();

      const customer = await Customer.create({
        name: 'V1 Order Customer',
        email: 'v1ordercustomer@test.com',
        phoneNumber: '555-0000',
        address: {
          street: '222 Legacy Ave',
          city: 'Old Town',
          state: 'CA',
          zipCode: '22222'
        },
        username: 'v1ordercustomer',
        password: 'password123',
        affiliateId: affiliate._id
      });

      const v1Order = await Order.create({
        customerId: customer._id,
        affiliateId: affiliate._id,
        pickupDate: new Date(),
        pickupTime: '10:00 AM - 12:00 PM',
        estimatedWeight: 25,
        numberOfBags: 2,
        paymentStatus: 'completed',
        paymentMethod: 'card',
        paymentDate: new Date(),
        paymentReference: 'PAYGISTIX123'
      });

      // V1 payment fields should work as before
      expect(v1Order.paymentStatus).toBe('completed');
      expect(v1Order.paymentMethod).toBe('card');
      expect(v1Order.paymentReference).toBe('PAYGISTIX123');

      // V2 fields should have defaults
      expect(v1Order.v2PaymentStatus).toBe('pending');
      expect(v1Order.v2PaymentMethod).toBe('pending');
    });
  });
});
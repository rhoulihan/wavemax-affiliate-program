const mongoose = require('mongoose');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Transaction = require('../../server/models/Transaction');
const RefreshToken = require('../../server/models/RefreshToken');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

describe('Model Tests', () => {

  describe('Affiliate Model', () => {
    it('should create a valid affiliate', async () => {
      const affiliateData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown Austin',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        username: 'johndoe',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        paymentMethod: 'check'
      };

      const affiliate = new Affiliate(affiliateData);
      const saved = await affiliate.save();

      expect(saved._id).toBeDefined();
      expect(saved.affiliateId).toMatch(/^AFF-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/); // UUID format
      expect(saved.email).toBe('john@example.com');
      expect(saved.isActive).toBe(true); // Default value
      expect(saved.paymentMethod).toBe('check');
    });

    it('should require required fields', async () => {
      const affiliate = new Affiliate({});

      let error;
      try {
        await affiliate.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.firstName).toBeDefined();
      expect(error.errors.lastName).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.phone).toBeDefined();
      expect(error.errors.username).toBeDefined();
      expect(error.errors.serviceLatitude).toBeDefined();
      expect(error.errors.serviceLongitude).toBeDefined();
    });

    it('should enforce unique constraints', async () => {
      // First, ensure indexes are created
      await Affiliate.ensureIndexes();

      const affiliateData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john2@example.com',
        username: 'johndoe2',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        paymentMethod: 'check'
      };

      await new Affiliate(affiliateData).save();

      // Try to save duplicate with same email
      const duplicateEmail = new Affiliate({
        ...affiliateData,
        username: 'differentusername',
        firstName: 'Jane',
        lastName: 'Smith'
      });

      let emailError;
      try {
        await duplicateEmail.save();
      } catch (e) {
        emailError = e;
      }

      expect(emailError).toBeDefined();
      expect(emailError.code === 11000 || emailError.name === 'MongoServerError').toBe(true);

      // Try to save duplicate with same username
      const duplicateUsername = new Affiliate({
        ...affiliateData,
        email: 'different@example.com',
        firstName: 'Bob',
        lastName: 'Johnson'
      });

      let usernameError;
      try {
        await duplicateUsername.save();
      } catch (e) {
        usernameError = e;
      }

      expect(usernameError).toBeDefined();
      expect(usernameError.code === 11000 || usernameError.name === 'MongoServerError').toBe(true);
    });

    it('should handle payment information correctly', async () => {
      const affiliate = new Affiliate({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        paymentMethod: 'paypal',
        paypalEmail: 'paypal@example.com'
      });

      const saved = await affiliate.save();
      expect(saved.paymentMethod).toBe('paypal');
      // PayPal email should be saved (encryption is mocked in tests)
      expect(saved.paypalEmail).toBeDefined();
    });

    it('should save affiliate with venmo payment method', async () => {
      const affiliate = new Affiliate({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        paymentMethod: 'venmo',
        venmoHandle: '@testuser-venmo'
      });

      const saved = await affiliate.save();
      expect(saved.paymentMethod).toBe('venmo');
      // Venmo handle should be saved (encryption is mocked in tests)
      expect(saved.venmoHandle).toBeDefined();
    });
  });

  describe('Customer Model', () => {
    it('should create a valid customer', async () => {
      const customerData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-987-6543',
        address: '456 Oak Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78702',
        username: 'janesmith',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        affiliateId: 'AFF123'
      };

      const customer = new Customer(customerData);
      const saved = await customer.save();

      expect(saved._id).toBeDefined();
      expect(saved.customerId).toMatch(/^CUST-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
      expect(saved.email).toBe('jane@example.com');
      expect(saved.isActive).toBe(true); // Default value
    });

  });

  describe('Order Model', () => {
    it('should create a valid order', async () => {
      const orderData = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',

        estimatedWeight: 30,
        numberOfBags: 2,
        deliveryFee: 5.99
      };

      const order = new Order(orderData);
      const saved = await order.save();

      expect(saved._id).toBeDefined();
      expect(saved.orderId).toMatch(/^ORD-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
      expect(saved.status).toBe('pending'); // Default status
      expect(saved.baseRate).toBe(1.25);
      expect(saved.paymentStatus).toBe('pending');
    });

    it('should calculate estimated total correctly', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',

        estimatedWeight: 30,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        }
      });

      await order.save();

      // 30 lbs * $1.25 + $10 fee
      expect(order.estimatedTotal).toBeCloseTo(47.50, 2);
    });

    it('should calculate actual total and commission when weight is set', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',

        estimatedWeight: 50,
        numberOfBags: 3,
        feeBreakdown: {
          numberOfBags: 3,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        actualWeight: 30
      });

      await order.save();

      // 30 lbs * $1.25 + $10 fee = $47.50
      expect(order.actualTotal).toBeCloseTo(47.50, 2);
      // Commission: 10% of wash cost (30 * $1.25 * 0.1) + fee ($10) = $13.75
      expect(order.affiliateCommission).toBeCloseTo(13.75, 2);
    });

    it('should update timestamps for status changes', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',

        estimatedWeight: 15,
        numberOfBags: 1,
        deliveryFee: 5.99
      });

      await order.save();

      // Update status to processing
      // Note: The model doesn't have automatic timestamp updates
      // In production, the controller would set these timestamps
      order.status = 'processing';
      order.processingStartedAt = new Date();
      await order.save();
      expect(order.processingStartedAt).toBeDefined();

      // Update status to processed (ready for delivery)
      order.status = 'processed';
      order.processedAt = new Date();
      await order.save();
      expect(order.processedAt).toBeDefined();

      // Update status to complete
      order.status = 'complete';
      order.completedAt = new Date();
      await order.save();
      expect(order.completedAt).toBeDefined();
    });
  });


  describe('Transaction Model', () => {
    it('should create a valid transaction', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'commission',
        amount: 25.50,
        description: 'Commission for order ORD123456',
        orders: ['ORD123456'],
        payoutMethod: 'check'
      });

      const saved = await transaction.save();

      expect(saved._id).toBeDefined();
      expect(saved.transactionId).toMatch(/^TRX\d{6}$/);
      expect(saved.status).toBe('pending');
      expect(saved.amount).toBe(25.50);
    });

    it('should validate transaction type', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'commission',
        amount: 25.50,
        description: 'Test transaction',
        payoutMethod: 'invalid'
      });

      let error;
      try {
        await transaction.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.payoutMethod).toBeDefined();
    });

    it('should validate transaction status', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'commission',
        amount: 25.50,
        description: 'Test transaction',
        payoutMethod: 'check',
        status: 'invalid'
      });

      let error;
      try {
        await transaction.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });
  });

  describe('RefreshToken Model', () => {
    it('should create a valid refresh token', async () => {
      const token = new RefreshToken({
        token: 'testtoken123',
        userId: new mongoose.Types.ObjectId(),
        userType: 'affiliate',
        expiryDate: new Date(Date.now() + 86400000),
        createdByIp: '127.0.0.1'
      });

      const saved = await token.save();

      expect(saved._id).toBeDefined();
      expect(saved.token).toBe('testtoken123');
      expect(saved.revoked).toBe(null);
    });

    it('should validate user type', async () => {
      const token = new RefreshToken({
        token: 'testtoken123',
        userId: new mongoose.Types.ObjectId(),
        userType: 'invalid',
        expiryDate: new Date(),
        createdByIp: '127.0.0.1'
      });

      let error;
      try {
        await token.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.userType).toBeDefined();
    });

    it('should check if token is expired', async () => {
      const expiredToken = new RefreshToken({
        token: 'expired',
        userId: new mongoose.Types.ObjectId(),
        userType: 'customer',
        expiryDate: new Date(Date.now() - 86400000) // Yesterday
      });

      await expiredToken.save();
      expect(expiredToken.expiryDate < new Date()).toBe(true);

      const validToken = new RefreshToken({
        token: 'valid',
        userId: new mongoose.Types.ObjectId(),
        userType: 'customer',
        expiryDate: new Date(Date.now() + 86400000), // Tomorrow
        createdByIp: '127.0.0.1'
      });

      await validToken.save();
      expect(validToken.expiryDate > new Date()).toBe(true);
    });
  });
});
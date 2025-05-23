const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Bag = require('../../server/models/Bag');
const Transaction = require('../../server/models/Transaction');
const RefreshToken = require('../../server/models/RefreshToken');

describe('Model Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Affiliate Model', () => {
    it('should create a valid affiliate', async () => {
      const affiliateData = {
        affiliateId: 'AFF123456',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown Austin',
        deliveryFee: 5.99,
        username: 'johndoe',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit'
      };

      const affiliate = new Affiliate(affiliateData);
      const saved = await affiliate.save();

      expect(saved._id).toBeDefined();
      expect(saved.affiliateId).toBe('AFF123456');
      expect(saved.email).toBe('john@example.com');
      expect(saved.commissionRate).toBe(0.1); // Default value
      expect(saved.status).toBe('active'); // Default value
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
      expect(error.errors.affiliateId).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.username).toBeDefined();
    });

    it('should enforce unique constraints', async () => {
      const affiliateData = {
        affiliateId: 'AFF123456',
        email: 'john@example.com',
        username: 'johndoe',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'directDeposit'
      };

      await new Affiliate(affiliateData).save();

      // Try to save duplicate
      const duplicate = new Affiliate({
        ...affiliateData,
        affiliateId: 'AFF999999' // Different ID but same email/username
      });

      let error;
      try {
        await duplicate.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });

    it('should handle payment information correctly', async () => {
      const affiliate = new Affiliate({
        affiliateId: 'AFF123',
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
        deliveryFee: 5.99,
        paymentMethod: 'paypal',
        paymentInfo: {
          paypalEmail: 'paypal@example.com'
        }
      });

      const saved = await affiliate.save();
      expect(saved.paymentMethod).toBe('paypal');
      expect(saved.paymentInfo.paypalEmail).toBe('paypal@example.com');
    });
  });

  describe('Customer Model', () => {
    it('should create a valid customer', async () => {
      const customerData = {
        customerId: 'CUST123456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-987-6543',
        address: '456 Oak Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78702',
        serviceFrequency: 'weekly',
        username: 'janesmith',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        affiliateId: 'AFF123'
      };

      const customer = new Customer(customerData);
      const saved = await customer.save();

      expect(saved._id).toBeDefined();
      expect(saved.customerId).toBe('CUST123456');
      expect(saved.email).toBe('jane@example.com');
      expect(saved.status).toBe('active'); // Default value
      expect(saved.preferredPickupDay).toBe('flexible'); // Default value
    });

    it('should validate service frequency', async () => {
      const customer = new Customer({
        customerId: 'CUST123',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        phone: '555-123-4567',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        affiliateId: 'AFF123',
        serviceFrequency: 'invalid'
      });

      let error;
      try {
        await customer.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.serviceFrequency).toBeDefined();
    });
  });

  describe('Order Model', () => {
    it('should create a valid order', async () => {
      const orderData = {
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date('2025-05-25'),
        pickupTime: 'morning',
        deliveryDate: new Date('2025-05-27'),
        deliveryTime: 'afternoon',
        estimatedSize: 'medium',
        deliveryFee: 5.99
      };

      const order = new Order(orderData);
      const saved = await order.save();

      expect(saved._id).toBeDefined();
      expect(saved.orderId).toMatch(/^ORD\d{6}$/);
      expect(saved.status).toBe('scheduled');
      expect(saved.baseRate).toBe(1.89);
      expect(saved.paymentStatus).toBe('pending');
    });

    it('should calculate estimated total correctly', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        deliveryDate: new Date(),
        deliveryTime: 'afternoon',
        estimatedSize: 'medium',
        deliveryFee: 5.99
      });

      await order.save();

      // Medium size estimate: 23 lbs * $1.89 + $5.99 delivery
      expect(order.estimatedTotal).toBeCloseTo(49.46, 2);
    });

    it('should calculate actual total and commission when weight is set', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        deliveryDate: new Date(),
        deliveryTime: 'afternoon',
        estimatedSize: 'large',
        deliveryFee: 5.99,
        actualWeight: 30
      });

      await order.save();

      // 30 lbs * $1.89 + $5.99 delivery = $62.69
      expect(order.actualTotal).toBeCloseTo(62.69, 2);
      // Commission: 10% of wash cost (30 * $1.89 * 0.1) = $5.67
      expect(order.affiliateCommission).toBeCloseTo(5.67, 2);
    });

    it('should update timestamps for status changes', async () => {
      const order = new Order({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        deliveryDate: new Date(),
        deliveryTime: 'afternoon',
        estimatedSize: 'small',
        deliveryFee: 5.99
      });

      await order.save();

      // Update status to picked_up
      order.status = 'picked_up';
      await order.save();
      expect(order.pickedUpAt).toBeDefined();

      // Update status to processing
      order.status = 'processing';
      await order.save();
      expect(order.processedAt).toBeDefined();

      // Update status to ready_for_delivery
      order.status = 'ready_for_delivery';
      await order.save();
      expect(order.readyForDeliveryAt).toBeDefined();

      // Update status to delivered
      order.status = 'delivered';
      await order.save();
      expect(order.deliveredAt).toBeDefined();
    });
  });

  describe('Bag Model', () => {
    it('should create a valid bag', async () => {
      const bag = new Bag({
        customerId: 'CUST123'
      });

      const saved = await bag.save();

      expect(saved._id).toBeDefined();
      expect(saved.bagBarcode).toMatch(/^BAG[A-Z0-9]{6}$/);
      expect(saved.status).toBe('active');
      expect(saved.customerId).toBe('CUST123');
    });

    it('should generate unique barcodes', async () => {
      const bag1 = new Bag({ customerId: 'CUST123' });
      const bag2 = new Bag({ customerId: 'CUST123' });

      await bag1.save();
      await bag2.save();

      expect(bag1.bagBarcode).not.toBe(bag2.bagBarcode);
    });
  });

  describe('Transaction Model', () => {
    it('should create a valid transaction', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'commission',
        amount: 25.50,
        description: 'Commission for order ORD123456',
        orderId: 'ORD123456'
      });

      const saved = await transaction.save();

      expect(saved._id).toBeDefined();
      expect(saved.transactionId).toMatch(/^TXN\d{10}$/);
      expect(saved.status).toBe('pending');
      expect(saved.amount).toBe(25.50);
    });

    it('should validate transaction type', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'invalid',
        amount: 25.50,
        description: 'Test transaction'
      });

      let error;
      try {
        await transaction.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should validate transaction status', async () => {
      const transaction = new Transaction({
        affiliateId: 'AFF123',
        type: 'commission',
        amount: 25.50,
        description: 'Test transaction',
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
        userId: 'user123',
        userType: 'affiliate',
        expiryDate: new Date(Date.now() + 86400000),
        createdByIp: '127.0.0.1'
      });

      const saved = await token.save();

      expect(saved._id).toBeDefined();
      expect(saved.token).toBe('testtoken123');
      expect(saved.isActive).toBe(true);
    });

    it('should validate user type', async () => {
      const token = new RefreshToken({
        token: 'testtoken123',
        userId: 'user123',
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
        userId: 'user123',
        userType: 'customer',
        expiryDate: new Date(Date.now() - 86400000), // Yesterday
        createdByIp: '127.0.0.1'
      });

      await expiredToken.save();
      expect(expiredToken.isExpired).toBe(true);

      const validToken = new RefreshToken({
        token: 'valid',
        userId: 'user123',
        userType: 'customer',
        expiryDate: new Date(Date.now() + 86400000), // Tomorrow
        createdByIp: '127.0.0.1'
      });

      await validToken.save();
      expect(validToken.isExpired).toBe(false);
    });
  });
});
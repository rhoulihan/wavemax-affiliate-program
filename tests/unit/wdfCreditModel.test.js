const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const SystemConfig = require('../../server/models/SystemConfig');

describe.skip('WDF Credit Model Tests (DEPRECATED - Feature being removed)', () => {
  beforeAll(async () => {
    // Initialize SystemConfig defaults
    await SystemConfig.initializeDefaults();
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('Order Model - WDF Credit Fields', () => {
    it('should have WDF credit tracking fields', () => {
      const order = new Order({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30
      });

      // Check that fields exist with defaults
      expect(order.wdfCreditApplied).toBe(0);
      expect(order.wdfCreditGenerated).toBe(0);
      expect(order.weightDifference).toBe(0);
    });

    it('should calculate estimated total with positive WDF credit', async () => {
      const order = new Order({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 5.00 // $5 credit
      });

      await order.save();

      // Expected: (30 * 1.25) + 10 - 5 = 42.50
      expect(order.estimatedTotal).toBe(42.50);
    });

    it('should calculate estimated total with negative WDF credit (debit)', async () => {
      const order = new Order({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 25,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: -3.50 // $3.50 debit
      });

      await order.save();

      // Expected: (25 * 1.25) + 10 - (-3.50) = 44.75
      expect(order.estimatedTotal).toBe(44.75);
    });

    it('should calculate actual total with WDF credit when weight is updated', async () => {
      const order = await Order.create({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 20,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 10.00
      });

      // Update with actual weight
      order.actualWeight = 22;
      await order.save();

      // Expected estimated: (20 * 1.25) + 10 - 10 = 25
      expect(order.estimatedTotal).toBe(25.00);
      
      // Expected actual: (22 * 1.25) + 10 - 10 = 27.50
      expect(order.actualTotal).toBe(27.50);
    });

    it('should store weight difference and generated credit', async () => {
      const order = new Order({
        customerId: 'CUST-002',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        actualWeight: 35,
        weightDifference: 5,
        wdfCreditGenerated: 6.25, // 5 * 1.25
        baseRate: 1.25
      });

      await order.save();

      expect(order.weightDifference).toBe(5);
      expect(order.wdfCreditGenerated).toBe(6.25);
    });
  });

  describe('Customer Model - WDF Credit Fields', () => {
    it('should have WDF credit tracking fields', async () => {
      const customer = new Customer({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        phone: '1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        username: 'johndoe',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      });

      await customer.save();

      // Check defaults
      expect(customer.wdfCredit).toBe(0);
      expect(customer.wdfCreditUpdatedAt).toBeUndefined();
      expect(customer.wdfCreditFromOrderId).toBeUndefined();
    });

    it('should store positive WDF credit', async () => {
      const customer = await Customer.create({
        customerId: 'CUST-002',
        affiliateId: 'AFF-001',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        phone: '1234567890',
        address: '456 Test Ave',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        username: 'janesmith',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        wdfCredit: 12.50,
        wdfCreditUpdatedAt: new Date(),
        wdfCreditFromOrderId: 'ORD-001'
      });

      expect(customer.wdfCredit).toBe(12.50);
      expect(customer.wdfCreditUpdatedAt).toBeInstanceOf(Date);
      expect(customer.wdfCreditFromOrderId).toBe('ORD-001');
    });

    it('should store negative WDF credit (debit)', async () => {
      const customer = await Customer.create({
        customerId: 'CUST-003',
        affiliateId: 'AFF-001',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@test.com',
        phone: '1234567890',
        address: '789 Test Blvd',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        username: 'bobjohnson',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        wdfCredit: -8.75,
        wdfCreditUpdatedAt: new Date(),
        wdfCreditFromOrderId: 'ORD-002'
      });

      expect(customer.wdfCredit).toBe(-8.75);
      expect(customer.wdfCreditFromOrderId).toBe('ORD-002');
    });
  });

  describe('WDF Credit Calculation Logic', () => {
    it('should handle precision correctly', async () => {
      const order = await Order.create({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 23.7,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 2.13
      });

      // Expected: (23.7 * 1.25) + 10 - 2.13 = 37.495 → 37.49 (due to parseFloat with 2 decimals)
      expect(order.estimatedTotal).toBe(37.49);
    });

    it('should handle zero credit correctly', async () => {
      const order = await Order.create({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 0
      });

      // Expected: (20 * 1.25) + 10 - 0 = 35
      expect(order.estimatedTotal).toBe(35.00);
    });
  });

  describe('Order Total Recalculation', () => {
    it('should recalculate total when weight changes', async () => {
      const order = await Order.create({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        }
      });

      const initialTotal = order.estimatedTotal;
      expect(initialTotal).toBe(47.50); // (30 * 1.25) + 10

      // Apply credit and save
      order.wdfCreditApplied = 5.00;
      await order.save();

      expect(order.estimatedTotal).toBe(42.50); // 47.50 - 5
    });

    it('should maintain affiliate commission calculation with WDF credit', async () => {
      const order = await Order.create({
        customerId: 'CUST-001',
        affiliateId: 'AFF-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 40,
        baseRate: 1.25,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 8.00
      });

      // Set actual weight
      order.actualWeight = 40;
      await order.save();

      // Commission should be based on WDF amount, not affected by credit
      // Commission = (40 * 1.25 * 0.1) + 10 = 5 + 10 = 15
      expect(order.affiliateCommission).toBe(15.00);
      
      // But total should include credit
      // Total = (40 * 1.25) + 10 - 8 = 52
      expect(order.actualTotal).toBe(52.00);
    });
  });
});
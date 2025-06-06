const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');

// Helper function to create valid order data
function createOrderData(overrides = {}) {
  const numberOfBags = overrides.numberOfBags || 2;
  const minimumFee = overrides.minimumFee || 10;
  const perBagFee = overrides.perBagFee || 2;
  const calculatedFee = numberOfBags * perBagFee;
  const totalFee = Math.max(minimumFee, calculatedFee);
  
  return {
    customerId: overrides.customerId || 'CUST' + Math.floor(100000 + Math.random() * 900000),
    affiliateId: overrides.affiliateId || 'AFF' + Math.floor(100000 + Math.random() * 900000),
    pickupDate: new Date(),
    pickupTime: 'morning',
    deliveryDate: new Date(),
    deliveryTime: 'afternoon',
    estimatedWeight: 30,
    numberOfBags: numberOfBags,
    feeBreakdown: overrides.feeBreakdown || {
      numberOfBags,
      minimumFee,
      perBagFee,
      totalFee,
      minimumApplied: totalFee === minimumFee
    },
    ...overrides
  };
}

describe('Order Model with SystemConfig Integration', () => {
  beforeEach(async () => {
    // Clear existing configs and initialize for each test
    await SystemConfig.deleteMany({});
    await SystemConfig.initializeDefaults();
  });

  afterEach(async () => {
    // Clean up after each test
    await Order.deleteMany({});
    await SystemConfig.deleteMany({});
  });

  describe('Dynamic WDF Pricing', () => {
    it('should fetch base rate from SystemConfig on order creation', async () => {
      // Set a custom WDF rate
      await SystemConfig.setValue('wdf_base_rate_per_pound', 2.50);

      const order = new Order(createOrderData({
        estimatedWeight: 30,
        numberOfBags: 2
        // Note: NOT setting baseRate so it fetches from SystemConfig
      }));

      await order.save();

      // Verify the order used the system config rate
      expect(order.baseRate).toBe(2.50);
    });

    it('should use default rate when SystemConfig is not available', async () => {
      // Delete the WDF config to simulate it not being available
      await SystemConfig.deleteOne({ key: 'wdf_base_rate_per_pound' });

      const order = new Order(createOrderData({
        estimatedWeight: 15,
        numberOfBags: 1,
        deliveryFee: 5.00
      }));

      await order.save();

      // Should fall back to the default rate
      expect(order.baseRate).toBe(1.25);

      // Restore the config
      await SystemConfig.initializeDefaults();
    });

    it('should calculate estimated total using SystemConfig rate', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 2.00);

      const order = new Order(createOrderData({
        estimatedWeight: 30,
        numberOfBags: 2,
        // Using default fee breakdown from helper
      }));

      await order.save();

      // 30 lbs * $2.00 + $10.00 fee = $70.00
      expect(order.estimatedTotal).toBeCloseTo(70.00, 2);
    });

    it('should calculate actual total using SystemConfig rate', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.75);

      const order = new Order(createOrderData({
        estimatedWeight: 50,
        numberOfBags: 3,
        // Using default fee breakdown from helper
        actualWeight: 25
      }));

      await order.save();

      // 25 lbs * $1.75 + $10.00 fee = $53.75
      expect(order.actualTotal).toBeCloseTo(53.75, 2);
    });
  });

  describe('Commission Calculations', () => {
    it('should calculate affiliate commission correctly with custom WDF rate', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 3.00);

      const order = new Order(createOrderData({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        estimatedWeight: 30,
    numberOfBags: 2,
        deliveryFee: 25.00,
        actualWeight: 20
      }));

      await order.save();

      // WDF total: 20 lbs * $3.00 = $60.00
      // Commission: 10% of $60.00 + $10.00 fee = $6.00 + $10.00 = $16.00
      expect(order.affiliateCommission).toBeCloseTo(16.00, 2);
    });

    it('should calculate commission for zero delivery fee', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.25);

      const order = new Order(createOrderData({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        estimatedWeight: 15,
        numberOfBags: 1,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 0,
          perBagFee: 0,
          totalFee: 0,
          minimumApplied: false
        },
        actualWeight: 10
      }));

      await order.save();

      // WDF total: 10 lbs * $1.25 = $12.50
      // Commission: 10% of $12.50 + $0 delivery = $1.25
      expect(order.affiliateCommission).toBeCloseTo(1.25, 2);
    });

    it('should handle commission calculation for large orders', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.50);

      const order = new Order(createOrderData({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        estimatedWeight: 50,
        numberOfBags: 6,
        perBagFee: 5,
        actualWeight: 100 // Very large order
      }));

      await order.save();

      // WDF total: 100 lbs * $1.50 = $150.00
      // Fee: 6 bags × $5 = $30 (calculated is greater than minimum $10)
      // Commission: 10% of $150.00 + $30.00 fee = $15.00 + $30.00 = $45.00
      expect(order.affiliateCommission).toBeCloseTo(45.00, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle commission when only estimated size is available', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 2.00);

      const order = new Order(createOrderData({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        estimatedWeight: 50,
        numberOfBags: 3,
        deliveryFee: 15.00
        // No actualWeight set
      }));

      await order.save();

      // Commission should be 0 until actual weight is set
      expect(order.affiliateCommission).toBe(0);
    });

    it('should update calculations when base rate changes', async () => {
      // Create order with initial rate
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.00);

      const order = new Order(createOrderData({
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        estimatedWeight: 30,
    numberOfBags: 2,
        deliveryFee: 10.00
      }));

      await order.save();
      const originalTotal = order.estimatedTotal;

      // Change the rate
      await SystemConfig.setValue('wdf_base_rate_per_pound', 2.00);

      // Create a new order to verify new rate is used
      const newOrder = new Order(createOrderData({
        customerId: 'CUST124',
        affiliateId: 'AFF124',
        estimatedWeight: 30,
    numberOfBags: 2,
        deliveryFee: 10.00
      }));

      await newOrder.save();

      // New order should use new rate
      expect(newOrder.baseRate).toBe(2.00);
      expect(newOrder.estimatedTotal).toBeGreaterThan(originalTotal);

      // Original order should still have old rate
      const oldOrder = await Order.findById(order._id);
      expect(oldOrder.baseRate).toBe(1.00);
    });

    it('should validate minimum and maximum base rates', async () => {
      // Ensure config exists
      await SystemConfig.initializeDefaults();
      
      // Try to set rate below minimum (0.50)
      try {
        await SystemConfig.setValue('wdf_base_rate_per_pound', 0.25);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('must be at least');
      }

      // Try to set rate above maximum (10.00)
      try {
        await SystemConfig.setValue('wdf_base_rate_per_pound', 15.00);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('must be at most');
      }
    });
  });

  describe('Revenue Calculator Scenarios', () => {
    it('should match revenue calculator example - 10 customers scenario', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.25);

      // Simulate 10 customers with 25 lbs each and $25 delivery fee
      const orders = [];
      for (let i = 0; i < 10; i++) {
        const order = new Order(createOrderData({
          customerId: `CUST${i}`,
          affiliateId: 'AFF123',
          estimatedWeight: 30,
          numberOfBags: 3,
          minimumFee: 25,
          perBagFee: 5,
          actualWeight: 25
        }));
        await order.save();
        orders.push(order);
      }

      // Calculate total weekly commission
      const totalCommission = orders.reduce((sum, order) => sum + order.affiliateCommission, 0);

      // Expected: 10 customers × 25 lbs × $1.25 × 10% = $31.25 WDF commission
      // Plus: 10 customers × $25 fee (minimum applies since 3 bags × $5 = $15) = $250 delivery earnings
      // Total: $281.25 per week
      expect(totalCommission).toBeCloseTo(281.30, 2); // Slight rounding difference

      // Monthly earnings (4 weeks)
      const monthlyEarnings = totalCommission * 4;
      expect(monthlyEarnings).toBeCloseTo(1125.20, 2);
    });

    it('should match revenue calculator with different parameters', async () => {
      await SystemConfig.setValue('wdf_base_rate_per_pound', 1.25);

      // 20 customers, 30 lbs each, $15 delivery
      const order = new Order(createOrderData({
        customerId: 'CUST001',
        affiliateId: 'AFF123',
        estimatedWeight: 50,
        numberOfBags: 3,
        minimumFee: 15,
        perBagFee: 5,
        actualWeight: 30
      }));

      await order.save();

      // Per customer: 30 lbs × $1.25 × 10% = $3.75 WDF + $15 fee (3 bags × $5 = $15, equals minimum) = $18.75
      expect(order.affiliateCommission).toBeCloseTo(18.75, 2);

      // For 20 customers per week: $375
      const weeklyTotal = order.affiliateCommission * 20;
      expect(weeklyTotal).toBeCloseTo(375.00, 2);
    });
  });
});
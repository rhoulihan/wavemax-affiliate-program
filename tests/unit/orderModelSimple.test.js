const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');

describe('Order Model - Line Coverage', () => {
  beforeAll(async () => {
    // Initialize SystemConfig defaults
    await SystemConfig.initializeDefaults();
  });

  afterEach(async () => {
    await Order.deleteMany({});
  });

  describe('SystemConfig Error Handling (Line 110)', () => {
    it('should use default base rate when SystemConfig.getValue throws error', async () => {
      // Mock SystemConfig to throw error
      const originalGetValue = SystemConfig.getValue;
      SystemConfig.getValue = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const order = new Order({
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30
      });

      await order.save();

      // Line 110 should be executed - using default base rate
      expect(order.baseRate).toBe(1.25);
      expect(SystemConfig.getValue).toHaveBeenCalledWith('wdf_base_rate_per_pound', 1.25);
      
      // Restore original function
      SystemConfig.getValue = originalGetValue;
    });
  });

  describe('Status Timestamp Updates (Lines 132-148)', () => {
    it('should set processingStartedAt when status changes to processing', async () => {
      const order = new Order({
        customerId: 'CUST002',
        affiliateId: 'AFF002',
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 20,
        status: 'pending'
      });
      
      await order.save();
      expect(order.processingStartedAt).toBeUndefined();
      
      // Change status to processing
      order.status = 'processing';
      await order.save();
      
      // Line 136 should be executed
      expect(order.processingStartedAt).toBeDefined();
      expect(order.processingStartedAt).toBeInstanceOf(Date);
    });

    it('should set processedAt when status changes to processed', async () => {
      const order = new Order({
        customerId: 'CUST003',
        affiliateId: 'AFF003',
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 25,
        status: 'processing'
      });
      
      await order.save();
      expect(order.processedAt).toBeUndefined();
      
      // Change status to processed
      order.status = 'processed';
      await order.save();
      
      // Line 139 should be executed
      expect(order.processedAt).toBeDefined();
      expect(order.processedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt when status changes to complete', async () => {
      const order = new Order({
        customerId: 'CUST004',
        affiliateId: 'AFF004',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 15,
        status: 'processed'
      });
      
      await order.save();
      expect(order.completedAt).toBeUndefined();
      
      // Change status to complete
      order.status = 'complete';
      await order.save();
      
      // Line 142 should be executed
      expect(order.completedAt).toBeDefined();
      expect(order.completedAt).toBeInstanceOf(Date);
    });

    it('should set cancelledAt when status changes to cancelled', async () => {
      const order = new Order({
        customerId: 'CUST005',
        affiliateId: 'AFF005',
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 20,
        status: 'pending'
      });
      
      await order.save();
      expect(order.cancelledAt).toBeUndefined();
      
      // Change status to cancelled
      order.status = 'cancelled';
      await order.save();
      
      // Line 145 should be executed
      expect(order.cancelledAt).toBeDefined();
      expect(order.cancelledAt).toBeInstanceOf(Date);
    });

    it('should not overwrite existing timestamps', async () => {
      const existingTimestamp = new Date('2024-01-01T10:00:00Z');
      const order = new Order({
        customerId: 'CUST006',
        affiliateId: 'AFF006',
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 30,
        status: 'processing',
        processingStartedAt: existingTimestamp
      });
      
      await order.save();
      
      // Modify something else to trigger save
      order.estimatedWeight = 35;
      await order.save();
      
      // processingStartedAt should remain unchanged
      expect(order.processingStartedAt.getTime()).toBe(existingTimestamp.getTime());
    });
  });

  describe('Actual Weight and Commission Calculations', () => {
    it('should calculate actualTotal and commission when actualWeight is set', async () => {
      const order = new Order({
        customerId: 'CUST007',
        affiliateId: 'AFF007',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        feeBreakdown: {
          totalFee: 25
        }
      });
      
      await order.save();
      expect(order.estimatedTotal).toBe(50); // (20 * 1.25) + 25
      expect(order.actualTotal).toBeUndefined();
      expect(order.affiliateCommission).toBe(0);
      
      // Set actual weight
      order.actualWeight = 30;
      await order.save();
      
      // Check calculations
      expect(order.actualTotal).toBe(62.5); // (30 * 1.25) + 25
      expect(order.affiliateCommission).toBe(28.75); // (30 * 1.25 * 0.1) + 25
    });
  });
});
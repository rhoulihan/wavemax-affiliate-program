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

  describe('SystemConfig Error Handling (Line 113)', () => {
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

      // Line 113 should be executed - using default base rate
      expect(order.baseRate).toBe(1.25);
      expect(SystemConfig.getValue).toHaveBeenCalledWith('wdf_base_rate_per_pound', 1.25);
      
      // Restore original function
      SystemConfig.getValue = originalGetValue;
    });
  });

  describe('Scheduled Status Timestamp (Lines 139-140)', () => {
    it('should set scheduledAt when saving with scheduled status', async () => {
      // First create and save order
      const order = new Order({
        customerId: 'CUST002',
        affiliateId: 'AFF002',
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 20,
        status: 'pending'
      });
      
      // Temporarily override the status enum validation
      const statusPath = order.schema.path('status');
      const originalEnum = statusPath.enumValues;
      statusPath.enumValues = [...originalEnum, 'scheduled'];
      
      await order.save();
      expect(order.scheduledAt).toBeUndefined();
      
      // Now update status to scheduled
      order.status = 'scheduled';
      await order.save();
      
      // Lines 139-140 should be executed
      expect(order.scheduledAt).toBeDefined();
      expect(order.scheduledAt).toBeInstanceOf(Date);
      
      // Restore original enum
      statusPath.enumValues = originalEnum;
    });
  });

  describe('Order Processing Status (Lines 158-174)', () => {
    it('should handle orderProcessingStatus changes', async () => {
      // Create an order with dynamic orderProcessingStatus field
      const orderData = {
        customerId: 'CUST003',
        affiliateId: 'AFF003',
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 25,
        status: 'processing'
      };
      
      // Create order and add orderProcessingStatus dynamically
      const order = new Order(orderData);
      order.orderProcessingStatus = 'pending';
      await order.save();
      
      // Test washing status (lines 160-165)
      order.orderProcessingStatus = 'washing';
      await order.save();
      expect(order.processingStarted).toBeDefined();
      const washingStartTime = order.processingStarted;
      
      // Test drying status (should not overwrite processingStarted)
      order.orderProcessingStatus = 'drying';
      await order.save();
      expect(order.processingStarted.getTime()).toBe(washingStartTime.getTime());
      
      // Test folding status (should not overwrite processingStarted)
      order.orderProcessingStatus = 'folding';
      await order.save();
      expect(order.processingStarted.getTime()).toBe(washingStartTime.getTime());
      
      // Test completed status (lines 167-174)
      const completedTime = new Date();
      jest.spyOn(Date, 'now').mockReturnValue(completedTime.getTime());
      
      order.orderProcessingStatus = 'completed';
      await order.save();
      
      expect(order.processingCompleted).toBeDefined();
      expect(order.processingTimeMinutes).toBeDefined();
      expect(order.processingTimeMinutes).toBeGreaterThan(0);
      
      Date.now.mockRestore();
    });
    
    it('should handle completed status without processingStarted', async () => {
      const order = new Order({
        customerId: 'CUST004',
        affiliateId: 'AFF004',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 15,
        status: 'processing'
      });
      
      // Add orderProcessingStatus dynamically
      order.orderProcessingStatus = 'pending';
      await order.save();
      
      // Change directly to completed without setting processingStarted
      order.orderProcessingStatus = 'completed';
      await order.save();
      
      expect(order.processingCompleted).toBeDefined();
      expect(order.processingTimeMinutes).toBeUndefined(); // No start time to calculate from
    });
  });
});
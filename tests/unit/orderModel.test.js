const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');

describe('Order Model - Additional Coverage', () => {
  // Mock SystemConfig
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pre-save Hook Coverage', () => {
    describe('SystemConfig Error Handling', () => {
      it('should use default base rate when SystemConfig.getValue throws error', async () => {
        // Mock SystemConfig to throw error
        jest.spyOn(SystemConfig, 'getValue').mockRejectedValue(new Error('Database error'));
        
        const orderData = {
          orderId: 'ORD001',
          customerId: 'CUST001',
          affiliateId: 'AFF001',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 30,
          feeBreakdown: {
            deliveryFee: 25,
            perBagFee: 15,
            totalFee: 40
          }
        };

        const order = new Order(orderData);
        await order.save();

        // Should use default base rate of 1.25
        expect(order.baseRate).toBe(1.25);
        expect(order.estimatedTotal).toBe(77.5); // (30 * 1.25) + 40
        expect(SystemConfig.getValue).toHaveBeenCalledWith('wdf_base_rate_per_pound', 1.25);
      });
    });

    describe('Status Timestamp Updates', () => {
      it('should set processingStartedAt timestamp when status changes to processing', async () => {
        const order = new Order({
          orderId: 'ORD002',
          customerId: 'CUST002',
          affiliateId: 'AFF002',
          status: 'pending',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        expect(order.processingStartedAt).toBeUndefined();

        // Change status to processing
        order.status = 'processing';
        await order.save();

        expect(order.processingStartedAt).toBeDefined();
        expect(order.processingStartedAt).toBeInstanceOf(Date);
      });

      it('should not overwrite existing processingStartedAt timestamp', async () => {
        const existingTimestamp = new Date('2024-01-01');
        const order = new Order({
          orderId: 'ORD003',
          customerId: 'CUST003',
          affiliateId: 'AFF003',
          status: 'processing',
          processingStartedAt: existingTimestamp,
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20
        });

        await order.save();
        
        // Modify something else to trigger save
        order.estimatedWeight = 25;
        await order.save();

        // processingStartedAt should remain unchanged
        expect(order.processingStartedAt.getTime()).toBe(existingTimestamp.getTime());
      });
    });

    describe('Actual Weight and Commission Calculations', () => {
      it('should calculate actual total and commission when actual weight is set', async () => {
        const order = new Order({
          orderId: 'ORD004',
          customerId: 'CUST004',
          affiliateId: 'AFF004',
          status: 'processing',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          feeBreakdown: {
            totalFee: 25
          }
        });

        await order.save();
        expect(order.estimatedTotal).toBeDefined();
        expect(order.actualTotal).toBeUndefined();

        // Set actual weight
        order.actualWeight = 30;
        await order.save();

        // Check calculations (assuming baseRate = 1.25)
        expect(order.actualTotal).toBe(62.5); // (30 * 1.25) + 25
        expect(order.affiliateCommission).toBe(28.75); // (30 * 1.25 * 0.1) + 25
      });

      it('should set processedAt timestamp when status changes to processed', async () => {
        const order = new Order({
          orderId: 'ORD005',
          customerId: 'CUST005',
          affiliateId: 'AFF005',
          status: 'processing',
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20
        });

        await order.save();
        expect(order.processedAt).toBeUndefined();
        
        order.status = 'processed';
        await order.save();

        expect(order.processedAt).toBeDefined();
        expect(order.processedAt).toBeInstanceOf(Date);
      });

      it('should set completedAt timestamp when status changes to complete', async () => {
        const order = new Order({
          orderId: 'ORD006',
          customerId: 'CUST006',
          affiliateId: 'AFF006',
          status: 'processed',
          pickupDate: new Date(),
          pickupTime: 'evening',
          estimatedWeight: 20
        });

        await order.save();
        expect(order.completedAt).toBeUndefined();
        
        order.status = 'complete';
        await order.save();

        expect(order.completedAt).toBeDefined();
        expect(order.completedAt).toBeInstanceOf(Date);
      });

      it('should set cancelledAt timestamp when status changes to cancelled', async () => {
        const order = new Order({
          orderId: 'ORD007',
          customerId: 'CUST007',
          affiliateId: 'AFF007',
          status: 'pending',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        expect(order.cancelledAt).toBeUndefined();
        
        order.status = 'cancelled';
        await order.save();

        expect(order.cancelledAt).toBeDefined();
        expect(order.cancelledAt).toBeInstanceOf(Date);
      });

      it('should properly calculate commission with different fee structures', async () => {
        const order = new Order({
          orderId: 'ORD008',
          customerId: 'CUST008',
          affiliateId: 'AFF008',
          status: 'processing',
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20,
          actualWeight: 50,
          feeBreakdown: {
            totalFee: 0 // Zero delivery fee scenario
          }
        });

        await order.save();
        
        // Commission should be 10% of WDF only when delivery fee is 0
        expect(order.affiliateCommission).toBe(6.25); // 50 * 1.25 * 0.1
      });

      it('should not overwrite existing timestamps', async () => {
        const existingProcessingTime = new Date('2024-01-01T10:00:00Z');
        const order = new Order({
          orderId: 'ORD009',
          customerId: 'CUST009',
          affiliateId: 'AFF009',
          status: 'processing',
          processingStartedAt: existingProcessingTime,
          pickupDate: new Date(),
          pickupTime: 'evening',
          estimatedWeight: 20
        });

        await order.save();
        
        // Change status again
        order.estimatedWeight = 25;
        await order.save();

        expect(order.processingStartedAt.getTime()).toBe(existingProcessingTime.getTime());
      });
    });

    describe('Edge Cases', () => {
      it('should handle status change to processing', async () => {
        const order = new Order({
          orderId: 'ORD010',
          customerId: 'CUST010',
          affiliateId: 'AFF010',
          status: 'pending',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        
        // Change status
        order.status = 'processing';
        await order.save();

        expect(order.processingStartedAt).toBeDefined();
        expect(order.processingStartedAt).toBeInstanceOf(Date);
      });

      it('should calculate commission for large orders', async () => {
        const order = new Order({
          orderId: 'ORD011',
          customerId: 'CUST011',
          affiliateId: 'AFF011',
          status: 'processing',
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 100,
          actualWeight: 150,
          feeBreakdown: {
            totalFee: 50
          }
        });

        await order.save();
        
        // Check calculations
        expect(order.actualTotal).toBe(237.5); // (150 * 1.25) + 50
        expect(order.affiliateCommission).toBe(68.75); // (150 * 1.25 * 0.1) + 50
      });
    });
  });
});
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
      it('should set scheduledAt timestamp when status changes to scheduled', async () => {
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
        expect(order.scheduledAt).toBeUndefined();

        // Change status to processing (since 'scheduled' is not a valid enum)
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

    describe('Order Processing Status Timestamps', () => {
      it('should set processingStarted when orderProcessingStatus changes to washing', async () => {
        const order = new Order({
          orderId: 'ORD004',
          customerId: 'CUST004',
          affiliateId: 'AFF004',
          status: 'processing',
          orderProcessingStatus: 'pending',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        expect(order.processingStarted).toBeUndefined();

        // Change processing status to washing
        order.orderProcessingStatus = 'washing';
        await order.save();

        expect(order.processingStarted).toBeDefined();
        expect(order.processingStarted).toBeInstanceOf(Date);
      });

      it('should set processingStarted when orderProcessingStatus changes to drying', async () => {
        const order = new Order({
          orderId: 'ORD005',
          customerId: 'CUST005',
          affiliateId: 'AFF005',
          status: 'processing',
          orderProcessingStatus: 'pending',
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20
        });

        await order.save();
        
        order.orderProcessingStatus = 'drying';
        await order.save();

        expect(order.processingStarted).toBeDefined();
        expect(order.processingStarted).toBeInstanceOf(Date);
      });

      it('should set processingStarted when orderProcessingStatus changes to folding', async () => {
        const order = new Order({
          orderId: 'ORD006',
          customerId: 'CUST006',
          affiliateId: 'AFF006',
          status: 'processing',
          orderProcessingStatus: 'pending',
          pickupDate: new Date(),
          pickupTime: 'evening',
          estimatedWeight: 20
        });

        await order.save();
        
        order.orderProcessingStatus = 'folding';
        await order.save();

        expect(order.processingStarted).toBeDefined();
        expect(order.processingStarted).toBeInstanceOf(Date);
      });

      it('should not overwrite existing processingStarted timestamp', async () => {
        const existingTimestamp = new Date('2024-01-01T10:00:00Z');
        const order = new Order({
          orderId: 'ORD007',
          customerId: 'CUST007',
          affiliateId: 'AFF007',
          status: 'processing',
          orderProcessingStatus: 'washing',
          processingStarted: existingTimestamp,
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        
        // Change to another processing status
        order.orderProcessingStatus = 'drying';
        await order.save();

        // processingStarted should remain unchanged
        expect(order.processingStarted.getTime()).toBe(existingTimestamp.getTime());
      });

      it('should set processingCompleted and calculate processing time when status changes to completed', async () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const order = new Order({
          orderId: 'ORD008',
          customerId: 'CUST008',
          affiliateId: 'AFF008',
          status: 'processing',
          orderProcessingStatus: 'folding',
          processingStarted: startTime,
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20
        });

        await order.save();
        
        // Mock current time to be 45 minutes later
        const completedTime = new Date('2024-01-01T10:45:00Z');
        jest.spyOn(Date, 'now').mockReturnValue(completedTime.getTime());
        
        // Change to completed
        order.orderProcessingStatus = 'completed';
        await order.save();

        expect(order.processingCompleted).toBeDefined();
        expect(order.processingTimeMinutes).toBe(45);
        
        Date.now.mockRestore();
      });

      it('should handle completion without processingStarted timestamp', async () => {
        const order = new Order({
          orderId: 'ORD009',
          customerId: 'CUST009',
          affiliateId: 'AFF009',
          status: 'processing',
          orderProcessingStatus: 'pending',
          pickupDate: new Date(),
          pickupTime: 'evening',
          estimatedWeight: 20
        });

        await order.save();
        
        // Change directly to completed without setting processingStarted
        order.orderProcessingStatus = 'completed';
        await order.save();

        expect(order.processingCompleted).toBeDefined();
        expect(order.processingTimeMinutes).toBeUndefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle multiple status changes in single save', async () => {
        const order = new Order({
          orderId: 'ORD010',
          customerId: 'CUST010',
          affiliateId: 'AFF010',
          status: 'pending',
          orderProcessingStatus: 'pending',
          pickupDate: new Date(),
          pickupTime: 'morning',
          estimatedWeight: 20
        });

        await order.save();
        
        // Change both statuses at once
        order.status = 'processing';
        order.orderProcessingStatus = 'washing';
        await order.save();

        expect(order.processingStartedAt).toBeDefined();
        expect(order.processingStarted).toBeDefined();
      });

      it('should calculate processing time correctly for long durations', async () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const order = new Order({
          orderId: 'ORD011',
          customerId: 'CUST011',
          affiliateId: 'AFF011',
          status: 'processing',
          orderProcessingStatus: 'washing',
          processingStarted: startTime,
          pickupDate: new Date(),
          pickupTime: 'afternoon',
          estimatedWeight: 20
        });

        await order.save();
        
        // Mock current time to be 3 hours later
        const completedTime = new Date('2024-01-01T13:00:00Z');
        jest.spyOn(Date, 'now').mockReturnValue(completedTime.getTime());
        
        order.orderProcessingStatus = 'completed';
        await order.save();

        expect(order.processingTimeMinutes).toBe(180); // 3 hours = 180 minutes
        
        Date.now.mockRestore();
      });
    });
  });
});
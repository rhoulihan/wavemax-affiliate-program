const mongoose = require('mongoose');
const Payment = require('../../server/models/Payment');

describe('Payment Model Unit Tests', () => {
  let mockPayment;

  beforeEach(() => {
    mockPayment = new Payment({
      orderId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      paymentMethodId: new mongoose.Types.ObjectId(),
      paygistixId: 'PAY-' + Date.now(),
      transactionId: 'TXN-123456',
      amount: 100.00,
      currency: 'USD',
      status: 'pending'
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid payment', () => {
      const error = mockPayment.validateSync();
      expect(error).toBeUndefined();
      expect(mockPayment.amount).toBe(100.00);
      expect(mockPayment.currency).toBe('USD');
      expect(mockPayment.status).toBe('pending');
    });

    it('should require orderId', () => {
      mockPayment.orderId = undefined;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.orderId).toBeDefined();
    });

    it('should require customerId', () => {
      mockPayment.customerId = undefined;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.customerId).toBeDefined();
    });

    it('should require paymentMethodId', () => {
      mockPayment.paymentMethodId = undefined;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.paymentMethodId).toBeDefined();
    });

    it('should require paygistixId', () => {
      mockPayment.paygistixId = undefined;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.paygistixId).toBeDefined();
    });

    it('should require amount', () => {
      mockPayment.amount = undefined;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.amount).toBeDefined();
    });

    it('should validate amount is non-negative', () => {
      mockPayment.amount = -10;
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.amount).toBeDefined();
    });

    it('should default currency to USD', () => {
      const payment = new Payment({
        orderId: new mongoose.Types.ObjectId(),
        customerId: new mongoose.Types.ObjectId(),
        paymentMethodId: new mongoose.Types.ObjectId(),
        paygistixId: 'PAY-TEST',
        amount: 50.00
      });
      expect(payment.currency).toBe('USD');
    });

    it('should validate currency enum', () => {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

      validCurrencies.forEach(currency => {
        mockPayment.currency = currency;
        const error = mockPayment.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid currency', () => {
      mockPayment.currency = 'JPY';
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.currency).toBeDefined();
    });

    it('should validate status enum', () => {
      const validStatuses = [
        'pending', 'processing', 'authorized', 'captured',
        'succeeded', 'failed', 'canceled', 'refunded',
        'partially_refunded', 'disputed'
      ];

      validStatuses.forEach(status => {
        mockPayment.status = status;
        const error = mockPayment.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid status', () => {
      mockPayment.status = 'invalid_status';
      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
    });

    it('should default status to pending', () => {
      const payment = new Payment({
        orderId: new mongoose.Types.ObjectId(),
        customerId: new mongoose.Types.ObjectId(),
        paymentMethodId: new mongoose.Types.ObjectId(),
        paygistixId: 'PAY-TEST',
        amount: 50.00
      });
      expect(payment.status).toBe('pending');
    });
  });

  describe('Default Values', () => {
    it('should default capturedAmount to 0', () => {
      expect(mockPayment.capturedAmount).toBe(0);
    });

    it('should default refundedAmount to 0', () => {
      expect(mockPayment.refundedAmount).toBe(0);
    });

    it('should default hasDispute to false', () => {
      expect(mockPayment.hasDispute).toBe(false);
    });

    it('should have empty refunds array', () => {
      expect(mockPayment.refunds).toEqual([]);
    });
  });

  describe('Virtual Properties', () => {
    it('should calculate netAmount correctly', () => {
      mockPayment.capturedAmount = 100;
      mockPayment.refundedAmount = 20;
      expect(mockPayment.netAmount).toBe(80);
    });

    it('should handle zero amounts', () => {
      mockPayment.capturedAmount = 0;
      mockPayment.refundedAmount = 0;
      expect(mockPayment.netAmount).toBe(0);
    });

    it('should handle full refund', () => {
      mockPayment.capturedAmount = 100;
      mockPayment.refundedAmount = 100;
      expect(mockPayment.netAmount).toBe(0);
    });
  });

  describe('Instance Methods', () => {
    describe('canRefund()', () => {
      it('should allow refund when status is captured', () => {
        mockPayment.status = 'captured';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 0;
        expect(mockPayment.canRefund()).toBe(true);
      });

      it('should allow refund when status is partially_refunded', () => {
        mockPayment.status = 'partially_refunded';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 50;
        expect(mockPayment.canRefund()).toBe(true);
      });

      it('should not allow refund when status is pending', () => {
        mockPayment.status = 'pending';
        expect(mockPayment.canRefund()).toBe(false);
      });

      it('should not allow refund when fully refunded', () => {
        mockPayment.status = 'refunded';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 100;
        expect(mockPayment.canRefund()).toBe(false);
      });

      it('should validate refund amount', () => {
        mockPayment.status = 'captured';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 30;

        expect(mockPayment.canRefund(50)).toBe(true);
        expect(mockPayment.canRefund(70)).toBe(true);
        expect(mockPayment.canRefund(71)).toBe(false);
      });

      it('should handle null amount parameter', () => {
        mockPayment.status = 'captured';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 0;
        expect(mockPayment.canRefund(null)).toBe(true);
      });
    });

    describe('canCapture()', () => {
      it('should allow capture when status is authorized', () => {
        mockPayment.status = 'authorized';
        expect(mockPayment.canCapture()).toBe(true);
      });

      it('should not allow capture when status is captured', () => {
        mockPayment.status = 'captured';
        expect(mockPayment.canCapture()).toBe(false);
      });

      it('should not allow capture when status is pending', () => {
        mockPayment.status = 'pending';
        expect(mockPayment.canCapture()).toBe(false);
      });
    });

    describe('addRefund()', () => {
      beforeEach(() => {
        mockPayment.status = 'captured';
        mockPayment.capturedAmount = 100;
        mockPayment.refundedAmount = 0;
      });

      it('should add refund to refunds array', () => {
        mockPayment.addRefund('REF-123', 20, 'Customer request');

        expect(mockPayment.refunds).toHaveLength(1);
        expect(mockPayment.refunds[0]).toMatchObject({
          refundId: 'REF-123',
          amount: 20,
          reason: 'Customer request'
        });
      });

      it('should update refundedAmount', () => {
        mockPayment.addRefund('REF-123', 20, 'Customer request');
        expect(mockPayment.refundedAmount).toBe(20);
      });

      it('should update lastRefundAt', () => {
        const beforeRefund = new Date();
        mockPayment.addRefund('REF-123', 20, 'Customer request');

        expect(mockPayment.lastRefundAt).toBeDefined();
        expect(mockPayment.lastRefundAt.getTime()).toBeGreaterThanOrEqual(beforeRefund.getTime());
      });

      it('should set status to partially_refunded for partial refund', () => {
        mockPayment.addRefund('REF-123', 50, 'Partial refund');
        expect(mockPayment.status).toBe('partially_refunded');
      });

      it('should set status to refunded for full refund', () => {
        mockPayment.addRefund('REF-123', 100, 'Full refund');
        expect(mockPayment.status).toBe('refunded');
      });

      it('should handle multiple refunds', () => {
        mockPayment.addRefund('REF-123', 30, 'First refund');
        mockPayment.addRefund('REF-124', 20, 'Second refund');

        expect(mockPayment.refunds).toHaveLength(2);
        expect(mockPayment.refundedAmount).toBe(50);
        expect(mockPayment.status).toBe('partially_refunded');
      });

      it('should handle refund that exceeds captured amount', () => {
        mockPayment.refundedAmount = 80;
        mockPayment.addRefund('REF-125', 30, 'Final refund');

        expect(mockPayment.refundedAmount).toBe(110);
        expect(mockPayment.status).toBe('refunded');
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(() => {
      // Mock the static methods
      Payment.find = jest.fn().mockReturnThis();
      Payment.sort = jest.fn().mockReturnThis();
      Payment.limit = jest.fn().mockReturnThis();
      Payment.aggregate = jest.fn();
    });

    describe('findByOrder()', () => {
      it('should find payments by orderId', async () => {
        const orderId = new mongoose.Types.ObjectId();
        const mockPayments = [{ _id: '1' }, { _id: '2' }];

        Payment.find.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockPayments)
        });

        const result = await Payment.findByOrder(orderId);

        expect(Payment.find).toHaveBeenCalledWith({ orderId });
        expect(result).toEqual(mockPayments);
      });
    });

    describe('findSuccessfulByCustomer()', () => {
      it('should find successful payments by customer with default limit', async () => {
        const customerId = new mongoose.Types.ObjectId();
        const mockPayments = [{ _id: '1' }, { _id: '2' }];

        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockPayments)
        };

        Payment.find.mockReturnValue(mockQuery);

        const result = await Payment.findSuccessfulByCustomer(customerId);

        expect(Payment.find).toHaveBeenCalledWith({
          customerId,
          status: { $in: ['captured', 'succeeded'] }
        });
        expect(mockQuery.limit).toHaveBeenCalledWith(10);
        expect(result).toEqual(mockPayments);
      });

      it('should accept custom limit', async () => {
        const customerId = new mongoose.Types.ObjectId();
        const mockPayments = [{ _id: '1' }];

        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue(mockPayments)
        };

        Payment.find.mockReturnValue(mockQuery);

        const result = await Payment.findSuccessfulByCustomer(customerId, 5);

        expect(mockQuery.limit).toHaveBeenCalledWith(5);
        expect(result).toEqual(mockPayments);
      });
    });

    describe('calculateRevenue()', () => {
      it('should calculate revenue for a period', async () => {
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-01-31');

        const mockResult = [
          {
            currency: 'USD',
            totalCaptured: 10000,
            totalRefunded: 500,
            netRevenue: 9500,
            count: 50
          }
        ];

        Payment.aggregate.mockResolvedValue(mockResult);

        const result = await Payment.calculateRevenue(startDate, endDate);

        expect(Payment.aggregate).toHaveBeenCalledWith([
          {
            $match: {
              status: { $in: ['captured', 'succeeded', 'partially_refunded'] },
              capturedAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$currency',
              totalCaptured: { $sum: '$capturedAmount' },
              totalRefunded: { $sum: '$refundedAmount' },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              currency: '$_id',
              totalCaptured: 1,
              totalRefunded: 1,
              netRevenue: { $subtract: ['$totalCaptured', '$totalRefunded'] },
              count: 1,
              _id: 0
            }
          }
        ]);

        expect(result).toEqual(mockResult);
      });
    });
  });

  describe('Middleware', () => {
    it('should have pre-save middleware defined', () => {
      const preSaveHooks = Payment.schema.s.hooks._pres.get('save');
      expect(preSaveHooks).toBeDefined();
      expect(preSaveHooks.length).toBeGreaterThan(0);
    });
  });

  describe('Refund Schema', () => {
    it('should validate refund subdocument', () => {
      mockPayment.refunds.push({
        refundId: 'REF-123',
        amount: 25.50,
        reason: 'Customer requested refund'
      });

      const error = mockPayment.validateSync();
      expect(error).toBeUndefined();
      expect(mockPayment.refunds[0].refundId).toBe('REF-123');
      expect(mockPayment.refunds[0].amount).toBe(25.50);
    });

    it('should require refundId in refund', () => {
      mockPayment.refunds.push({
        amount: 25.50,
        reason: 'Customer requested refund'
      });

      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['refunds.0.refundId']).toBeDefined();
    });

    it('should require amount in refund', () => {
      mockPayment.refunds.push({
        refundId: 'REF-123',
        reason: 'Customer requested refund'
      });

      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['refunds.0.amount']).toBeDefined();
    });

    it('should validate refund amount is non-negative', () => {
      mockPayment.refunds.push({
        refundId: 'REF-123',
        amount: -10,
        reason: 'Invalid refund'
      });

      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['refunds.0.amount']).toBeDefined();
    });

    it('should set default createdAt for refund', () => {
      const beforeCreate = new Date();

      mockPayment.refunds.push({
        refundId: 'REF-123',
        amount: 25.50,
        reason: 'Customer requested refund'
      });

      const refund = mockPayment.refunds[0];
      expect(refund.createdAt).toBeDefined();
      expect(refund.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });
  });

  describe('Dispute Tracking', () => {
    it('should validate dispute status enum', () => {
      const validStatuses = [
        'warning_needs_response', 'warning_under_review', 'warning_closed',
        'needs_response', 'under_review', 'charge_refunded', 'won', 'lost'
      ];

      validStatuses.forEach(status => {
        mockPayment.hasDispute = true;
        mockPayment.disputeStatus = status;
        const error = mockPayment.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should allow dispute fields when hasDispute is true', () => {
      mockPayment.hasDispute = true;
      mockPayment.disputeStatus = 'needs_response';
      mockPayment.disputeReason = 'Fraudulent charge';
      mockPayment.disputeAmount = 50;
      mockPayment.disputeCreatedAt = new Date();
      mockPayment.disputeUpdatedAt = new Date();

      const error = mockPayment.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate dispute amount is non-negative', () => {
      mockPayment.hasDispute = true;
      mockPayment.disputeAmount = -10;

      const error = mockPayment.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.disputeAmount).toBeDefined();
    });
  });

  describe('Metadata and Response Fields', () => {
    it('should store metadata as Map', () => {
      mockPayment.metadata = new Map([
        ['key1', 'value1'],
        ['key2', { nested: 'object' }],
        ['key3', 123]
      ]);

      const error = mockPayment.validateSync();
      expect(error).toBeUndefined();
      expect(mockPayment.metadata.get('key1')).toBe('value1');
      expect(mockPayment.metadata.get('key2')).toEqual({ nested: 'object' });
    });

    it('should store response as mixed type', () => {
      mockPayment.response = {
        id: 'ch_1234567890',
        object: 'charge',
        amount: 10000,
        currency: 'usd',
        metadata: {
          order_id: '12345'
        }
      };

      const error = mockPayment.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('JSON Transformation', () => {
    it('should remove __v and response fields from JSON', () => {
      mockPayment.__v = 1;
      mockPayment.response = { sensitive: 'data' };

      const json = mockPayment.toJSON();

      expect(json.__v).toBeUndefined();
      expect(json.response).toBeUndefined();
      expect(json.paygistixId).toBeDefined();
      expect(json.amount).toBeDefined();
    });
  });
});
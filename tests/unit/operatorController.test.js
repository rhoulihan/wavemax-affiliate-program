// Import all controller functions
const operatorController = require('../../server/controllers/operatorController');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/controllerHelpers', () => ({
  asyncWrapper: (fn) => fn,
  sendSuccess: (res, data, message, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, ...data });
  },
  sendError: (res, message, statusCode = 400) => {
    return res.status(statusCode).json({ success: false, message });
  },
  calculatePagination: (total, page, limit) => ({
    total,
    page,
    pages: Math.ceil(total / limit)
  }),
  parsePagination: (query, defaults = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || defaults.limit || 10;
    return {
      page,
      limit,
      skip: (page - 1) * limit
    };
  }
}));
jest.mock('../../server/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../server/utils/emailService', () => ({
  sendOrderReadyNotification: jest.fn(),
  sendOrderPickedUpNotification: jest.fn()
}));
jest.mock('../../server/utils/formatters', () => ({
  fullName: (first, last) => `${first} ${last}`,
  phone: (phone) => phone,
  datetime: (date) => date,
  date: (date) => date,
  currency: (amount) => `$${amount}`,
  orderId: (id) => id,
  weight: (weight) => weight ? `${weight} lbs` : 'N/A'
}));

describe('Operator Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { _id: 'op123', id: 'op123', email: 'operator@example.com', role: 'operator', operatorId: 'OPR001' },
      params: {},
      body: {},
      query: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getOrderQueue', () => {
    it('should return available orders for operator workstation', async () => {
      const mockOperator = {
        _id: 'op123',
        workStation: 'WS001'
      };

      const mockOrders = [
        { 
          _id: '1', 
          orderNumber: 'ORD001', 
          scheduledPickup: new Date(),
          toObject: jest.fn().mockReturnValue({ 
            _id: '1', 
            orderNumber: 'ORD001', 
            scheduledPickup: new Date() 
          }),
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            phone: '555-1234',
            toObject: jest.fn().mockReturnValue({
              firstName: 'John',
              lastName: 'Doe',
              phone: '555-1234'
            })
          }
        }
      ];

      Operator.findById = jest.fn().mockResolvedValue(mockOperator);
      Order.find = createFindMock([]);
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(1);

      const handler = operatorController.getOrderQueue;
      await handler(req, res, next);

      expect(Order.find).toHaveBeenCalledWith({
        orderProcessingStatus: 'pending'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order queue retrieved successfully',
        orders: expect.any(Array),
        pagination: {
          total: 1,
          page: 1,
          pages: 1
        }
      });
    });

    it('should handle order not found in confirmPickup', async () => {
      const next = jest.fn();
      req.body = { orderId: 'NONEXISTENT', numberOfBags: 1 };
      Order.findOne.mockResolvedValue(null);

      await operatorController.confirmPickup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order not found'
      });
    });

    it('should handle error in confirmPickup', async () => {
      req.body = { orderId: 'ORD123', numberOfBags: 1 };
      Order.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.confirmPickup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to confirm pickup'
      });
    });

    it('should handle error in getTodayStats', async () => {
      Order.countDocuments.mockRejectedValue(new Error('Database error'));

      await operatorController.getTodayStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch stats'
      });
    });

    it('should handle markOrderReady (deprecated function)', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        orderProcessingStatus: 'quality_check',
        numberOfBags: 2,
 save: jest.fn().mockResolvedValue(true)};

      req.params.orderId = 'ORD123';
      Order.findOne.mockResolvedValue(mockOrder);

      const handler = operatorController.markOrderReady;
      await handler(req, res, next);

      // Note: markOrderReady is deprecated and doesn't update orderProcessingStatus
      expect(mockOrder.orderProcessingStatus).toBe('quality_check'); // Unchanged
      expect(mockOrder.status).toBe('processed');
      expect(mockOrder.bagsProcessed).toBe(2);
      expect(mockOrder.processedAt).toBeDefined();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order marked as ready for pickup',
        order: mockOrder
      });
    });

    it('should handle markOrderReady with affiliate notification', async () => {
      const mockOrder = {
        orderId: 'ORD123',
        affiliateId: 'AFF123',
        customerId: 'CUST123',
        numberOfBags: 2,
        actualWeight: 25,
 save: jest.fn().mockResolvedValue(true)};

      const mockAffiliate = {
        affiliateId: 'AFF123',
        email: 'affiliate@example.com',
        businessName: 'Test Affiliate',
 save: jest.fn().mockResolvedValue(true)};

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
 save: jest.fn().mockResolvedValue(true)};

      req.params.orderId = 'ORD123';
      Order.findOne.mockResolvedValue(mockOrder);
      
      const Affiliate = require('../../server/models/Affiliate');
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const emailService = require('../../server/utils/emailService');
      emailService.sendOrderReadyNotification.mockResolvedValue();

      await operatorController.markOrderReady(req, res, next);

      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledWith(
        'affiliate@example.com',
        expect.objectContaining({
          affiliateName: 'Test Affiliate',
          orderId: 'ORD123',
          customerName: 'John Doe',
          numberOfBags: 2,
          totalWeight: 25
        })
      );
    });

    it('should handle errors in markOrderReady', async () => {
      req.params.orderId = 'ORD123';
      Order.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.markOrderReady(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to mark order as ready'
      });
    });
  });
});
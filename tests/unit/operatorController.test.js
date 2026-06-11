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

    // confirmPickup / completePickup / markOrderReady / markBagProcessed were
    // deleted in PR 9 (legacy pickup paths; markOrderReady was a payment-gate
    // bypass). Coverage for the replacement lives in
    // tests/integration/kioskAdvance.test.js + operatorScanOut.test.js.

    it('should handle error in getTodayStats', async () => {
      Order.countDocuments.mockRejectedValue(new Error('Database error'));

      await operatorController.getTodayStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch stats'
      });
    });

  });
});
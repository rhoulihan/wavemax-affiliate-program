const {
  getDashboard,
  getOrderQueue,
  claimOrder,
  updateOrderStatus,
  performQualityCheck,
  getMyOrders,
  getWorkstationStatus,
  updateShiftStatus,
  getPerformanceStats,
  getCustomerDetails,
  addCustomerNote
} = require('../../server/controllers/operatorController');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const { auditLogger } = require('../../server/utils/auditLogger');

jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');

describe('Operator Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { _id: 'op123', email: 'operator@example.com', role: 'operator', operatorId: 'OPR001' },
      params: {},
      body: {},
      query: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return operator dashboard data', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        currentStation: 'washing',
        shiftStatus: 'active'
      };

      const mockOrders = [
        { _id: '1', orderNumber: 'ORD001', status: 'processing' },
        { _id: '2', orderNumber: 'ORD002', status: 'processing' }
      ];

      Operator.findById.mockResolvedValue(mockOperator);
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockOrders)
        })
      });
      Order.countDocuments.mockResolvedValue(5);

      await getDashboard(req, res);

      expect(Operator.findById).toHaveBeenCalledWith(req.user._id);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          operator: expect.any(Object),
          activeOrders: expect.any(Array),
          stats: expect.any(Object)
        })
      });
    });
  });

  describe('getOrderQueue', () => {
    it('should return available orders for operator workstation', async () => {
      const mockOperator = {
        workStation: 'washing'
      };

      const mockOrders = [
        { _id: '1', orderNumber: 'ORD001', status: 'ready_for_washing' },
        { _id: '2', orderNumber: 'ORD002', status: 'ready_for_washing' }
      ];

      Operator.findById.mockResolvedValue(mockOperator);
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockOrders)
          })
        })
      });

      await getOrderQueue(req, res);

      expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({
        status: expect.stringContaining('ready_for')
      }));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        orders: mockOrders
      });
    });
  });

  describe('claimOrder', () => {
    it('should allow operator to claim an order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        status: 'ready_for_washing',
        claimedBy: null,
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      Order.findById.mockResolvedValue(mockOrder);

      await claimOrder(req, res);

      expect(mockOrder.claimedBy).toBe(req.user._id);
      expect(mockOrder.status).toBe('washing');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('order_claimed', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order claimed successfully',
        order: mockOrder
      });
    });

    it('should fail if order is already claimed', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        status: 'washing',
        claimedBy: 'otherOperator123'
      };

      req.params.orderId = 'order123';
      Order.findById.mockResolvedValue(mockOrder);

      await claimOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Order is already claimed by another operator'
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        status: 'washing',
        claimedBy: 'op123',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = { status: 'drying' };

      Order.findById.mockResolvedValue(mockOrder);

      await updateOrderStatus(req, res);

      expect(mockOrder.status).toBe('drying');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('order_status_updated', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order status updated successfully'
      });
    });
  });

  describe('performQualityCheck', () => {
    it('should record quality check results', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        status: 'quality_check',
        qualityCheck: {},
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = {
        passed: true,
        notes: 'All items clean and properly folded'
      };

      Order.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrder)
      });

      await performQualityCheck(req, res);

      expect(mockOrder.qualityCheck).toMatchObject({
        passed: true,
        performedBy: req.user._id,
        notes: 'All items clean and properly folded'
      });
      expect(mockOrder.status).toBe('ready_for_pickup');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Quality check completed'
      });
    });
  });

  describe('getMyOrders', () => {
    it('should return orders assigned to operator', async () => {
      const mockOrders = [
        { _id: '1', orderNumber: 'ORD001', status: 'processing' },
        { _id: '2', orderNumber: 'ORD002', status: 'drying' }
      ];

      req.query = { page: 1, limit: 10 };

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockOrders)
            })
          })
        })
      });
      Order.countDocuments.mockResolvedValue(2);

      await getMyOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({ claimedBy: req.user._id });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        orders: mockOrders,
        total: 2,
        page: 1,
        pages: 1
      });
    });
  });

  describe('updateShiftStatus', () => {
    it('should update operator shift status', async () => {
      const mockOperator = {
        _id: 'op123',
        shiftStatus: 'inactive',
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = { status: 'active' };
      Operator.findById.mockResolvedValue(mockOperator);

      await updateShiftStatus(req, res);

      expect(mockOperator.shiftStatus).toBe('active');
      expect(mockOperator.lastStatusUpdate).toBeDefined();
      expect(mockOperator.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('shift_status_updated', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Shift status updated successfully'
      });
    });
  });

  describe('getPerformanceStats', () => {
    it('should return operator performance statistics', async () => {
      req.query = { period: 'week' };

      const mockStats = {
        totalOrders: 50,
        completedOrders: 48,
        avgProcessingTime: 120,
        qualityScore: 95
      };

      Order.aggregate.mockResolvedValue([mockStats]);

      await getPerformanceStats(req, res);

      expect(Order.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stats: mockStats,
        period: 'week'
      });
    });
  });

  describe('getCustomerDetails', () => {
    it('should return customer details for an order', async () => {
      const mockCustomer = {
        _id: 'cust123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234'
      };

      req.params.customerId = 'cust123';
      Customer.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });

      await getCustomerDetails(req, res);

      expect(Customer.findById).toHaveBeenCalledWith('cust123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        customer: mockCustomer
      });
    });
  });

  describe('addCustomerNote', () => {
    it('should add a note to an order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        notes: [],
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = { note: 'Customer requested extra starch' };

      Order.findById.mockResolvedValue(mockOrder);

      await addCustomerNote(req, res);

      expect(mockOrder.notes).toHaveLength(1);
      expect(mockOrder.notes[0]).toMatchObject({
        text: 'Customer requested extra starch',
        addedBy: req.user._id
      });
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Note added successfully'
      });
    });
  });
});
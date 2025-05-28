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
const { logger } = require('../../server/utils/logger');

jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Operator Controller', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return operator dashboard data', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        firstName: 'John',
        lastName: 'Doe',
        workStation: 'WS001',
        shiftStart: '08:00',
        shiftEnd: '16:00',
        totalOrdersProcessed: 100,
        averageProcessingTime: 45,
        qualityScore: 98
      };

      const mockTodayStats = [{
        totalOrders: 10,
        completedOrders: 8,
        totalWeight: 50.5,
        avgProcessingTime: 42
      }];

      const mockCurrentShiftOrders = [
        { _id: '1', orderNumber: 'ORD001', orderProcessingStatus: 'washing' }
      ];

      Operator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockOperator)
      });
      Order.aggregate.mockResolvedValue(mockTodayStats);
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockCurrentShiftOrders)
      });
      Order.countDocuments.mockResolvedValue(5);

      await getDashboard(req, res);

      expect(Operator.findById).toHaveBeenCalledWith('op123');
      expect(res.json).toHaveBeenCalledWith({
        operator: {
          name: 'John Doe',
          operatorId: 'OPR001',
          workStation: 'WS001',
          shiftStart: '08:00',
          shiftEnd: '16:00'
        },
        todayStats: mockTodayStats[0],
        currentShiftOrders: mockCurrentShiftOrders,
        pendingOrdersCount: 5,
        performance: {
          ordersProcessed: 100,
          avgProcessingTime: 45,
          qualityScore: 98
        }
      });
    });
  });

  describe('getOrderQueue', () => {
    it('should return available orders for operator workstation', async () => {
      const mockOperator = {
        _id: 'op123',
        workStation: 'WS001'
      };

      const mockOrders = [
        { _id: '1', orderNumber: 'ORD001', scheduledPickup: new Date() }
      ];

      Operator.findById.mockResolvedValue(mockOperator);
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(1);

      await getOrderQueue(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        orderProcessingStatus: 'pending'
      });
      expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: expect.any(Object)
      });
    });
  });

  describe('claimOrder', () => {
    it('should allow operator to claim an order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';

      Order.findById.mockResolvedValue(mockOrder);
      Operator.findById.mockResolvedValue({ _id: 'op123', save: jest.fn() });
      Order.countDocuments.mockResolvedValue(0);
      
      // Mock the populate method
      mockOrder.populate = jest.fn().mockResolvedValue(mockOrder);

      await claimOrder(req, res);

      expect(mockOrder.assignedOperator).toBe('op123');
      expect(mockOrder.orderProcessingStatus).toBe('assigned');
      expect(mockOrder.processingStarted).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order claimed successfully',
        order: expect.any(Object)
      });
    });

    it('should fail if order is already claimed', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'assigned',
        assignedOperator: 'other-operator'
      };

      req.params.orderId = 'order123';

      Order.findById.mockResolvedValue(mockOrder);

      await claimOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order already assigned'
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'washing',
        assignedOperator: 'op123',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          _id: 'order123',
          orderNumber: 'ORD001',
          orderProcessingStatus: 'drying',
          customer: { firstName: 'John', lastName: 'Doe' }
        })
      };

      req.params.orderId = 'order123';
      req.body = { status: 'drying' };

      Order.findById.mockResolvedValue(mockOrder);

      await updateOrderStatus(req, res);

      expect(mockOrder.orderProcessingStatus).toBe('drying');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('operator', 'op123', 'order.status_updated', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order status updated',
        order: expect.any(Object)
      });
    });
  });

  describe('performQualityCheck', () => {
    it('should record quality check results', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'quality_check',
        assignedOperator: 'op123',
        processingStarted: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = {
        passed: true,
        notes: 'All items clean and properly folded'
      };

      Order.findById.mockResolvedValue(mockOrder);
      Operator.findById.mockResolvedValue({ _id: 'op456', save: jest.fn() });
      
      // Mock the populate method
      mockOrder.populate = jest.fn().mockResolvedValue(mockOrder);

      await performQualityCheck(req, res);

      expect(mockOrder.qualityCheckPassed).toBe(true);
      expect(mockOrder.qualityCheckBy).toBe('op123');
      expect(mockOrder.qualityCheckNotes).toBe('All items clean and properly folded');
      expect(mockOrder.orderProcessingStatus).toBe('ready');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quality check passed',
        order: expect.any(Object)
      });
    });
  });

  describe('getMyOrders', () => {
    it('should return orders assigned to operator', async () => {
      const mockOrders = [
        { _id: '1', orderNumber: 'ORD001', orderProcessingStatus: 'processing' },
        { _id: '2', orderNumber: 'ORD002', orderProcessingStatus: 'ready' }
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(2);

      await getMyOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({ assignedOperator: 'op123' });
      expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: expect.any(Object)
      });
    });
  });

  describe('updateShiftStatus', () => {
    it('should update operator shift status', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        workStation: null,
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = { action: 'start', workstation: 'W1' };

      Operator.findById.mockResolvedValue(mockOperator);
      Operator.findOne.mockResolvedValue(null);

      await updateShiftStatus(req, res);

      expect(mockOperator.workStation).toBe('W1');
      expect(mockOperator.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('operator', 'op123', 'shift.start', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Shift started successfully',
        operator: expect.any(Object)
      });
    });
  });

  describe('getPerformanceStats', () => {
    it('should return operator performance statistics', async () => {
      const mockStats = [
        {
          _id: null,
          totalOrders: 50,
          completedOrders: 48,
          averageProcessingTime: 45,
          totalQualityChecks: 48,
          passedQualityChecks: 47
        }
      ];

      const mockOperator = {
        _id: 'op123',
        firstName: 'John',
        lastName: 'Doe',
        operatorId: 'OPR001',
        qualityScore: 98
      };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.aggregate.mockResolvedValue(mockStats);

      await getPerformanceStats(req, res);

      expect(Order.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        operator: expect.any(Object),
        period: expect.any(Object),
        summary: expect.any(Object),
        efficiency: expect.any(Object)
      }));
    });
  });

  describe('getCustomerDetails', () => {
    it('should return customer details for an order', async () => {
      const mockCustomer = {
        _id: 'cust123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-1234',
        address: '123 Main St'
      };

      const mockOrders = [{
        orderNumber: 'ORD001',
        scheduledPickup: new Date(),
        weight: 10,
        totalAmount: 50,
        orderProcessingStatus: 'processing'
      }];

      req.params.customerId = 'cust123';

      Customer.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomer)
      });
      Order.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });

      await getCustomerDetails(req, res);

      expect(Customer.findById).toHaveBeenCalledWith('cust123');
      expect(res.json).toHaveBeenCalledWith({
        customer: mockCustomer,
        recentOrders: mockOrders
      });
    });
  });

  describe('addCustomerNote', () => {
    it('should add a note to an order', async () => {
      const mockCustomer = {
        _id: 'cust123',
        notes: [],
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.customerId = 'cust123';
      req.body = {
        note: 'Customer requested extra starch'
      };

      Customer.findById.mockResolvedValue(mockCustomer);

      await addCustomerNote(req, res);

      expect(mockCustomer.notes).toHaveLength(1);
      expect(mockCustomer.notes[0]).toMatchObject({
        note: 'Customer requested extra starch',
        addedBy: 'op123',
        addedAt: expect.any(Date)
      });
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Note added successfully',
        customer: expect.any(Object)
      });
    });
  });
});
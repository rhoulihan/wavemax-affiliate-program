// Import all controller functions
const operatorController = require('../../server/controllers/operatorController');
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

      await operatorController.getDashboard(req, res);

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

      await operatorController.getOrderQueue(req, res);

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

      await operatorController.claimOrder(req, res);

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

      await operatorController.claimOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order already assigned'
      });
    });

    it('should fail if order not found', async () => {
      req.params.orderId = 'nonexistent';

      Order.findById.mockResolvedValue(null);

      await operatorController.claimOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order not found'
      });
    });

    it('should handle database error during claim', async () => {
      req.params.orderId = 'order123';

      Order.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.claimOrder(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error claiming order:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to claim order'
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

      await operatorController.updateOrderStatus(req, res);

      expect(mockOrder.orderProcessingStatus).toBe('drying');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('operator', 'op123', 'order.status_updated', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order status updated',
        order: expect.any(Object)
      });
    });

    it('should handle invalid status transition', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'assigned',
        assignedOperator: 'op123'
      };

      req.params.orderId = 'order123';
      req.body = { status: 'drying' }; // Invalid: can't go from assigned to drying

      Order.findById.mockResolvedValue(mockOrder);

      await operatorController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid status transition from assigned to drying'
      });
    });

    it('should handle order not found', async () => {
      req.params.orderId = 'nonexistent';
      req.body = { status: 'drying' };

      Order.findById.mockResolvedValue(null);

      await operatorController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order not found'
      });
    });

    it('should handle unauthorized operator', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        assignedOperator: 'other-operator'
      };

      req.params.orderId = 'order123';
      req.body = { status: 'drying' };

      Order.findById.mockResolvedValue(mockOrder);

      await operatorController.updateOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not authorized to update this order'
      });
    });

    it('should update workstation when washing status with new workstation', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'assigned',
        assignedOperator: 'op123',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          _id: 'order123',
          orderNumber: 'ORD001',
          orderProcessingStatus: 'washing',
          customer: { firstName: 'John', lastName: 'Doe' }
        })
      };

      const mockOperator = {
        _id: 'op123',
        workStation: 'W1',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = { status: 'washing', workstation: 'W2' };

      Order.findById.mockResolvedValue(mockOrder);
      Operator.findById.mockResolvedValue(mockOperator);

      await operatorController.updateOrderStatus(req, res);

      expect(mockOperator.workStation).toBe('W2');
      expect(mockOperator.save).toHaveBeenCalled();
      expect(mockOrder.orderProcessingStatus).toBe('washing');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Order status updated',
        order: expect.any(Object)
      });
    });

    it('should set processingCompleted when status is ready', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'quality_check',
        assignedOperator: 'op123',
        processingStarted: new Date(Date.now() - 3600000), // 1 hour ago
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          _id: 'order123',
          orderNumber: 'ORD001',
          orderProcessingStatus: 'ready',
          processingCompleted: new Date(),
          processingTimeMinutes: 60,
          customer: { firstName: 'John', lastName: 'Doe' }
        })
      };

      req.params.orderId = 'order123';
      req.body = { status: 'ready' };

      Order.findById.mockResolvedValue(mockOrder);

      await operatorController.updateOrderStatus(req, res);

      expect(mockOrder.orderProcessingStatus).toBe('ready');
      expect(mockOrder.processingCompleted).toBeDefined();
      expect(mockOrder.processingTimeMinutes).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      req.params.orderId = 'order123';
      req.body = { status: 'drying' };

      Order.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.updateOrderStatus(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error updating order status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to update order status'
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

      await operatorController.performQualityCheck(req, res);

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

    it('should handle order not found', async () => {
      req.params.orderId = 'nonexistent';
      req.body = { passed: true, notes: 'Test' };

      Order.findById.mockResolvedValue(null);

      await operatorController.performQualityCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order not found'
      });
    });

    it('should handle order not ready for quality check', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'washing' // Wrong status
      };

      req.params.orderId = 'order123';
      req.body = { passed: true, notes: 'Test' };

      Order.findById.mockResolvedValue(mockOrder);

      await operatorController.performQualityCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Order not ready for quality check'
      });
    });

    it('should handle database error during quality check', async () => {
      req.params.orderId = 'order123';
      req.body = { passed: true, notes: 'Test' };

      Order.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.performQualityCheck(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error performing quality check:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to perform quality check'
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

      await operatorController.getMyOrders(req, res);

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

      await operatorController.updateShiftStatus(req, res);

      expect(mockOperator.workStation).toBe('W1');
      expect(mockOperator.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('operator', 'op123', 'shift.start', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Shift started successfully',
        operator: expect.any(Object)
      });
    });

    it('should handle operator not found', async () => {
      req.body = { action: 'start', workstation: 'W1' };

      Operator.findById.mockResolvedValue(null);

      await operatorController.updateShiftStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Operator not found'
      });
    });

    it('should end shift successfully', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        workStation: 'W1',
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = { action: 'end' };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.countDocuments.mockResolvedValue(0); // No incomplete orders

      await operatorController.updateShiftStatus(req, res);

      expect(mockOperator.workStation).toBe(null);
      expect(mockOperator.save).toHaveBeenCalled();
      expect(auditLogger.log).toHaveBeenCalledWith('operator', 'op123', 'shift.end', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Shift ended successfully',
        operator: expect.any(Object)
      });
    });

    it('should handle database error', async () => {
      req.body = { action: 'start', workstation: 'W1' };

      Operator.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.updateShiftStatus(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error updating shift status:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to update shift status'
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

      await operatorController.getPerformanceStats(req, res);

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

      await operatorController.getCustomerDetails(req, res);

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

      await operatorController.addCustomerNote(req, res);

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

    it('should handle customer not found', async () => {
      req.params.customerId = 'nonexistent';
      req.body = { note: 'Test note' };

      Customer.findById.mockResolvedValue(null);

      await operatorController.addCustomerNote(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Customer not found'
      });
    });

    it('should handle errors during note addition', async () => {
      req.params.customerId = 'cust123';
      req.body = { note: 'Test note' };

      Customer.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.addCustomerNote(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error adding customer note:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to add customer note'
      });
    });
  });

  // Additional error handling tests
  describe('Error handling in existing functions', () => {
    it('should handle error in getDashboard when operator not found', async () => {
      Operator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await operatorController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Operator not found' });
    });

    it('should handle database error in getDashboard', async () => {
      Operator.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await operatorController.getDashboard(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error fetching operator dashboard:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch dashboard' });
    });

    it('should handle error in getOrderQueue', async () => {
      req.query = { status: 'pending' };

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await operatorController.getOrderQueue(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error fetching order queue:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch order queue' });
    });

    it('should handle different filters in getOrderQueue', async () => {
      req.query = {
        status: 'processing',
        priority: 'high',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        page: 2,
        limit: 10
      };

      const mockOrders = [{ _id: '1', orderNumber: 'ORD001' }];

      Operator.findById.mockResolvedValue({ workStation: 'WS001' });
      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(15);

      await operatorController.getOrderQueue(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        orderProcessingStatus: 'processing',
        priority: 'high',
        scheduledPickup: {
          $gte: new Date('2025-01-01'),
          $lte: new Date('2025-01-31')
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: {
          total: 15,
          page: 2,
          pages: 2
        }
      });
    });

    it('should handle operator at max capacity in claimOrder', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'pending'
      };

      req.params.orderId = 'order123';

      Order.findById.mockResolvedValue(mockOrder);
      Operator.findById.mockResolvedValue({ _id: 'op123' });
      Order.countDocuments.mockResolvedValue(3); // Max capacity

      await operatorController.claimOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Maximum concurrent orders reached'
      });
    });

    it('should handle quality check failure in performQualityCheck', async () => {
      const mockOrder = {
        _id: 'order123',
        orderNumber: 'ORD001',
        orderProcessingStatus: 'quality_check',
        assignedOperator: 'op456',
        processingStarted: new Date(Date.now() - 60 * 60 * 1000),
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.orderId = 'order123';
      req.body = {
        passed: false,
        notes: 'Items need rewashing',
        issues: 'Stains still visible'
      };

      Order.findById.mockResolvedValue(mockOrder);
      Operator.findById.mockResolvedValue({ _id: 'op456', save: jest.fn() });

      mockOrder.populate = jest.fn().mockResolvedValue(mockOrder);

      await operatorController.performQualityCheck(req, res);

      expect(mockOrder.qualityCheckPassed).toBe(false);
      expect(mockOrder.orderProcessingStatus).toBe('washing');
      expect(mockOrder.operatorNotes).toContain('Quality issues: Stains still visible');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quality check failed',
        order: expect.any(Object)
      });
    });

    it('should handle workstation conflict in updateShiftStatus', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        workStation: null,
        save: jest.fn()
      };

      req.body = { action: 'start', workstation: 'W1' };

      Operator.findById.mockResolvedValue(mockOperator);
      Operator.findOne.mockResolvedValue({ _id: 'other-op', operatorId: 'OPR002' }); // Workstation occupied

      await operatorController.updateShiftStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workstation already occupied'
      });
    });

    it('should handle incomplete orders when ending shift', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001',
        workStation: 'W1',
        save: jest.fn()
      };

      req.body = { action: 'end' };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.countDocuments.mockResolvedValue(2); // Has incomplete orders

      await operatorController.updateShiftStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot end shift with 2 incomplete orders'
      });
    });

    it('should handle invalid action in updateShiftStatus', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001'
      };

      req.body = { action: 'invalid' };

      Operator.findById.mockResolvedValue(mockOperator);

      await operatorController.updateShiftStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid action'
      });
    });

    it('should handle missing workstation when starting shift', async () => {
      const mockOperator = {
        _id: 'op123',
        operatorId: 'OPR001'
      };

      req.body = { action: 'start' }; // No workstation provided

      Operator.findById.mockResolvedValue(mockOperator);

      await operatorController.updateShiftStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Workstation required to start shift'
      });
    });

    it('should handle different time periods in getPerformanceStats', async () => {
      const mockOperator = {
        _id: 'op123',
        firstName: 'John',
        lastName: 'Doe',
        operatorId: 'OPR001',
        qualityScore: 95
      };

      const mockStats = [{
        _id: null,
        totalOrders: 100,
        completedOrders: 95,
        totalWeight: 500,
        avgProcessingTime: 40,
        minProcessingTime: 20,
        maxProcessingTime: 60,
        qualityChecksPassed: 90,
        qualityChecksFailed: 5
      }];

      const mockDailyStats = [
        { _id: '2025-01-01', orders: 10, weight: 50, avgTime: 35 },
        { _id: '2025-01-02', orders: 15, weight: 75, avgTime: 45 }
      ];

      // Test with 'month' period
      req.query = { period: 'month' };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.aggregate.mockResolvedValueOnce(mockStats).mockResolvedValueOnce(mockDailyStats);

      await operatorController.getPerformanceStats(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        operator: expect.objectContaining({
          name: 'John Doe',
          operatorId: 'OPR001',
          qualityScore: 95
        }),
        period: expect.objectContaining({
          days: expect.any(Number)
        }),
        summary: mockStats[0],
        dailyBreakdown: mockDailyStats,
        efficiency: expect.objectContaining({
          ordersPerDay: expect.any(Number),
          weightPerDay: expect.any(Number),
          qualityRate: expect.any(Number)
        })
      }));
    });

    it('should handle operator not found in getPerformanceStats', async () => {
      Operator.findById.mockResolvedValue(null);

      await operatorController.getPerformanceStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Operator not found'
      });
    });

    it('should handle customer not found in getCustomerDetails', async () => {
      req.params.customerId = 'nonexistent';

      Customer.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await operatorController.getCustomerDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Customer not found'
      });
    });


    it('should handle filters in getMyOrders', async () => {
      req.query = {
        status: 'completed',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        page: 2,
        limit: 10
      };

      const mockOrders = [{ _id: '1', orderNumber: 'ORD001' }];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      });
      Order.countDocuments.mockResolvedValue(25);

      await operatorController.getMyOrders(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        assignedOperator: 'op123',
        orderProcessingStatus: 'completed',
        processingStarted: {
          $gte: new Date('2025-01-01'),
          $lte: new Date('2025-01-31')
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        orders: mockOrders,
        pagination: {
          total: 25,
          page: 2,
          pages: 3
        }
      });
    });
  });
});
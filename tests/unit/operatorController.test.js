// Import all controller functions
const operatorController = require('../../server/controllers/operatorController');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const { logAuditEvent } = require('../../server/utils/auditLogger');

jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/utils/auditLogger');
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

      const logger = require('../../server/utils/logger');
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
      // Audit logging is currently commented out in the controller
      // expect(logAuditEvent).toHaveBeenCalledWith('ORDER_STATUS_CHANGED', expect.any(Object));
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

      const logger = require('../../server/utils/logger');
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

      const logger = require('../../server/utils/logger');
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
      // Audit logging is currently commented out in the controller
      // expect(logAuditEvent).toHaveBeenCalledWith('SHIFT_STARTED', expect.any(Object));
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
      // Audit logging is currently commented out in the controller
      // expect(logAuditEvent).toHaveBeenCalledWith('SHIFT_ENDED', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'Shift ended successfully',
        operator: expect.any(Object)
      });
    });

    it('should handle database error', async () => {
      req.body = { action: 'start', workstation: 'W1' };

      Operator.findById.mockRejectedValue(new Error('Database error'));

      await operatorController.updateShiftStatus(req, res);

      const logger = require('../../server/utils/logger');
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

      const logger = require('../../server/utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Error adding customer note:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to add customer note'
      });
    });
  });

  // Additional error handling tests
  describe('Error handling in existing functions', () => {
    it('should handle error in getOrderQueue', async () => {
      req.query = { status: 'pending' };

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await operatorController.getOrderQueue(req, res);

      const logger = require('../../server/utils/logger');
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

  describe('scanCustomer', () => {
    it('should scan customer and return current order', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        status: 'pending',
        numberOfBags: 2,
        estimatedWeight: 30,
        bagsWeighed: 0,
        bagsProcessed: 0,
        bagsPickedUp: 0,
        actualWeight: undefined,
        bags: []
      };

      req.body = { customerId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder)
      });

      await operatorController.scanCustomer(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST123' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        currentOrder: true,
        action: 'weight_input',
        order: {
          orderId: 'ORD123',
          customerName: 'John Doe',
          affiliateName: 'N/A',
          numberOfBags: 2,
          bagsWeighed: 0,
          bagsProcessed: 0,
          bagsPickedUp: 0,
          estimatedWeight: 30,
          actualWeight: undefined,
          status: 'pending',
          bags: []
        }
      });
    });

    it('should handle customer not found', async () => {
      req.body = { customerId: 'INVALID' };
      Customer.findOne.mockResolvedValue(null);

      await operatorController.scanCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Customer not found',
        message: 'Invalid customer ID'
      });
    });
  });

  describe('scanBag', () => {
    it('should redirect to scanCustomer', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        status: 'pending',
        numberOfBags: 2,
        bagsWeighed: 0,
        bagsProcessed: 0,
        bagsPickedUp: 0
      };

      req.body = { bagId: 'CUST123' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder)
      });

      await operatorController.scanBag(req, res);

      // It should call scanCustomer internally
      expect(Customer.findOne).toHaveBeenCalled();
    });

    it('should handle error in scanBag', async () => {
      req.body = { bagId: 'INVALID' };
      
      // Force an error by making scanCustomer throw
      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.scanBag(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to scan customer card',
        message: 'An error occurred while processing the scan'
      });
    });
  });

  describe('receiveOrder', () => {
    it('should receive order and update status', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'ORD123',
        status: 'pending',
        bagsWeighed: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      req.params = { orderId: 'ORD123' };
      req.body = { 
        bagWeights: [
          { bagNumber: 1, weight: 10 },
          { bagNumber: 2, weight: 15 }
        ],
        totalWeight: 25
      };

      Order.findOne.mockResolvedValue(mockOrder);

      await operatorController.receiveOrder(req, res);

      expect(mockOrder.status).toBe('processing');
      expect(mockOrder.actualWeight).toBe(25);
      expect(mockOrder.assignedOperator).toBe('op123');
      expect(mockOrder.processingStarted).toBeDefined();
      expect(mockOrder.bagsWeighed).toBe(2);
      expect(mockOrder.bagWeights).toHaveLength(2);
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order received and marked as in progress',
        order: mockOrder
      });
    });

    it('should handle order not found', async () => {
      req.params = { orderId: 'ORD999' };
      req.body = { bagWeights: [], totalWeight: 0 };
      
      Order.findOne.mockResolvedValue(null);

      await operatorController.receiveOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order not found'
      });
    });
  });

  describe('markBagProcessed', () => {
    it('should mark bag as processed', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'ORD123',
        status: 'processing',
        numberOfBags: 2,
        bagsProcessed: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      req.params = { orderId: 'ORD123' };

      Order.findOne.mockResolvedValue(mockOrder);

      await operatorController.markBagProcessed(req, res);

      expect(mockOrder.bagsProcessed).toBe(1);
      expect(mockOrder.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag 1 of 2 marked as processed',
        bagsProcessed: 1,
        totalBags: 2,
        orderReady: false
      });
    });

    it('should update order status when all bags processed', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'processing',
        numberOfBags: 2,
        bagsProcessed: 1,
        actualWeight: 25,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        email: 'affiliate@example.com',
        contactPerson: 'John Doe'
      };

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      req.params = { orderId: 'ORD123' };

      Order.findOne.mockResolvedValue(mockOrder);
      
      // Mock the require for Affiliate model
      const Affiliate = require('../../server/models/Affiliate');
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(mockCustomer);
      
      // Mock email service
      const emailService = require('../../server/utils/emailService');
      emailService.sendOrderReadyNotification = jest.fn().mockResolvedValue(true);

      await operatorController.markBagProcessed(req, res);

      expect(mockOrder.bagsProcessed).toBe(2);
      expect(mockOrder.status).toBe('processed');
      expect(mockOrder.processedAt).toBeDefined();
      expect(emailService.sendOrderReadyNotification).toHaveBeenCalledWith(
        'affiliate@example.com',
        expect.objectContaining({
          affiliateName: 'John Doe',
          orderId: 'ORD123',
          customerName: 'Jane Smith',
          numberOfBags: 2,
          totalWeight: 25
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag 2 of 2 marked as processed',
        bagsProcessed: 2,
        totalBags: 2,
        orderReady: true
      });
    });
  });

  describe('confirmPickup', () => {
    it('should confirm pickup and complete order', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'ORD123',
        customerId: 'CUST123',
        status: 'processed',
        numberOfBags: 2,
        bagsPickedUp: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      };

      req.body = { orderId: 'ORD123', numberOfBags: 2 };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);

      // Mock email service
      const emailService = require('../../server/utils/emailService');
      emailService.sendOrderPickedUpNotification = jest.fn().mockResolvedValue(true);

      await operatorController.confirmPickup(req, res);

      expect(mockOrder.bagsPickedUp).toBe(2);
      expect(mockOrder.status).toBe('complete');
      expect(mockOrder.completedAt).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
      expect(emailService.sendOrderPickedUpNotification).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({
          customerName: 'Jane Smith',
          orderId: 'ORD123',
          numberOfBags: 2
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Pickup confirmed',
        bagsPickedUp: 2,
        totalBags: 2,
        orderComplete: true
      });
    });

    it('should handle partial pickup', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'ORD123',
        status: 'processed',
        numberOfBags: 2,
        bagsPickedUp: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      req.body = { orderId: 'ORD123', numberOfBags: 1 };

      Order.findOne.mockResolvedValue(mockOrder);

      await operatorController.confirmPickup(req, res);

      expect(mockOrder.bagsPickedUp).toBe(1);
      expect(mockOrder.status).toBe('processed'); // Should remain processed
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Pickup confirmed',
        bagsPickedUp: 1,
        totalBags: 2,
        orderComplete: false
      });
    });
  });

  describe('getTodayStats', () => {
    it('should return today\'s operator statistics', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mockOrders = [
        { bagsWeighed: 3 },
        { bagsWeighed: 2 },
        { bagsWeighed: 4 }
      ];

      Order.countDocuments.mockImplementation((query) => {
        if (query.status === 'processed') {
          return Promise.resolve(5); // Orders ready
        }
        return Promise.resolve(3); // Orders processed today
      });
      
      Order.find.mockResolvedValue(mockOrders);

      await operatorController.getTodayStats(req, res);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      expect(Order.countDocuments).toHaveBeenCalledWith({
        $or: [
          {
            assignedOperator: 'op123',
            processingStarted: { $gte: today }
          },
          {
            bagsWeighed: { $gt: 0 },
            updatedAt: { $gte: today, $lt: tomorrow }
          }
        ]
      });
      
      expect(res.json).toHaveBeenCalledWith({
        ordersProcessed: 3,
        bagsScanned: 9, // 3 + 2 + 4
        ordersReady: 5
      });
    });

    it('should handle no orders for today', async () => {
      Order.countDocuments.mockResolvedValue(0);
      Order.find.mockResolvedValue([]);

      await operatorController.getTodayStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ordersProcessed: 0,
        bagsScanned: 0,
        ordersReady: 0
      });
    });
  });

  describe('getWorkstationStatus', () => {
    it('should return workstation status for all workstations', async () => {
      const mockOperator = {
        _id: 'op123',
        firstName: 'John',
        lastName: 'Doe',
        operatorId: 'OPR001'
      };

      Operator.findOne.mockImplementation(({ workStation }) => {
        if (workStation === 'W1') {
          return {
            select: jest.fn().mockResolvedValue(mockOperator)
          };
        }
        return {
          select: jest.fn().mockResolvedValue(null)
        };
      });
      
      Order.countDocuments.mockResolvedValue(2);

      await operatorController.getWorkstationStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        workstations: expect.arrayContaining([
          expect.objectContaining({
            workstation: 'W1',
            type: 'washing',
            operator: expect.objectContaining({
              name: 'John Doe',
              operatorId: 'OPR001'
            }),
            activeOrders: 2,
            available: true
          })
        ])
      });
    });

    it('should handle database error', async () => {
      Operator.findOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      await operatorController.getWorkstationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch workstation status'
      });
    });
  });

  describe('Additional coverage tests', () => {
    it('should handle error in getMyOrders', async () => {
      Order.find.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await operatorController.getMyOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch orders'
      });
    });

    it('should handle different performance stat periods', async () => {
      const mockOperator = {
        _id: 'op123',
        firstName: 'John',
        lastName: 'Doe',
        operatorId: 'OPR001',
        qualityScore: 95
      };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.aggregate.mockResolvedValue([]);

      // Test day period
      req.query = { period: 'day' };
      await operatorController.getPerformanceStats(req, res);
      expect(res.json).toHaveBeenCalled();

      // Test month period
      req.query = { period: 'month' };
      await operatorController.getPerformanceStats(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle error in getPerformanceStats', async () => {
      req.query = { period: 'week' };
      Operator.findById.mockResolvedValue({ _id: 'op123' });
      Order.aggregate.mockRejectedValue(new Error('Aggregation error'));

      await operatorController.getPerformanceStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch performance stats'
      });
    });

    it('should handle error in getCustomerDetails', async () => {
      req.params.customerId = 'cust123';
      Customer.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await operatorController.getCustomerDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch customer details'
      });
    });

    it('should handle no active order in scanCustomer', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe'
      };

      req.body = { customerId: 'CUST123' };
      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null)
      });

      await operatorController.scanCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No active order',
        message: 'No active order found for this customer',
        customer: {
          name: 'John Doe',
          customerId: 'CUST123'
        }
      });
    });

    it('should handle different scan actions in scanCustomer', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Test process_complete action
      const mockOrderProcessComplete = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        status: 'processing',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 1,
        bagsPickedUp: 0,
        estimatedWeight: 30
      };

      req.body = { customerId: 'CUST123' };
      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrderProcessComplete)
      });

      await operatorController.scanCustomer(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        action: 'process_complete'
      }));

      // Test pickup_scan action
      const mockOrderPickupScan = {
        orderId: 'ORD124',
        customerId: 'CUST123',
        status: 'processed',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 2,
        bagsPickedUp: 1,
        estimatedWeight: 30
      };

      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrderPickupScan)
      });

      await operatorController.scanCustomer(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        action: 'pickup_scan'
      }));
    });

    it('should handle affiliate lookup in scanCustomer', async () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        affiliateId: 'AFF123',
        status: 'pending',
        numberOfBags: 2,
        bagsWeighed: 0,
        bagsProcessed: 0,
        bagsPickedUp: 0,
        estimatedWeight: 30
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        businessName: 'Test Affiliate'
      };

      req.body = { customerId: 'CUST123' };
      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrder)
      });
      
      const Affiliate = require('../../server/models/Affiliate');
      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await operatorController.scanCustomer(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        order: expect.objectContaining({
          affiliateName: 'Test Affiliate'
        })
      }));
    });

    it('should handle error in scanCustomer', async () => {
      req.body = { customerId: 'CUST123' };
      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.scanCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to scan customer card',
        message: 'An error occurred while processing the scan'
      });
    });

    it('should handle error in receiveOrder', async () => {
      req.params.orderId = 'ORD123';
      req.body = { bagWeights: [], totalWeight: 25 };
      Order.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.receiveOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to receive order'
      });
    });

    it('should handle order not found in markBagProcessed', async () => {
      req.params.orderId = 'NONEXISTENT';
      Order.findOne.mockResolvedValue(null);

      await operatorController.markBagProcessed(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order not found'
      });
    });

    it('should handle error in markBagProcessed', async () => {
      req.params.orderId = 'ORD123';
      Order.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.markBagProcessed(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to mark bag as processed'
      });
    });

    it('should handle order not found in confirmPickup', async () => {
      req.body = { orderId: 'NONEXISTENT', numberOfBags: 1 };
      Order.findOne.mockResolvedValue(null);

      await operatorController.confirmPickup(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Order not found'
      });
    });

    it('should handle error in confirmPickup', async () => {
      req.body = { orderId: 'ORD123', numberOfBags: 1 };
      Order.findOne.mockRejectedValue(new Error('Database error'));

      await operatorController.confirmPickup(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to confirm pickup'
      });
    });

    it('should handle error in getTodayStats', async () => {
      Order.countDocuments.mockRejectedValue(new Error('Database error'));

      await operatorController.getTodayStats(req, res);

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
        save: jest.fn()
      };

      req.params.orderId = 'ORD123';
      Order.findOne.mockResolvedValue(mockOrder);

      await operatorController.markOrderReady(req, res);

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
        save: jest.fn()
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        email: 'affiliate@example.com',
        businessName: 'Test Affiliate'
      };

      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'John',
        lastName: 'Doe'
      };

      req.params.orderId = 'ORD123';
      Order.findOne.mockResolvedValue(mockOrder);
      
      const Affiliate = require('../../server/models/Affiliate');
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const emailService = require('../../server/utils/emailService');
      emailService.sendOrderReadyNotification.mockResolvedValue();

      await operatorController.markOrderReady(req, res);

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

      await operatorController.markOrderReady(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to mark order as ready'
      });
    });
  });
});
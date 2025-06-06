// Administrator Controller Unit Tests
// Focus on key uncovered functions for coverage improvement

jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/SystemConfig');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/passwordValidator');
jest.mock('../../server/utils/fieldFilter');
jest.mock('express-validator');
jest.mock('mongoose', () => ({
  Schema: jest.fn().mockImplementation(() => ({
    pre: jest.fn(),
    virtual: jest.fn().mockReturnValue({ get: jest.fn() }),
    index: jest.fn(),
    methods: {},
    statics: {}
  })),
  model: jest.fn().mockReturnValue({}),
  Types: {
    ObjectId: {
      isValid: jest.fn(id => /^[0-9a-fA-F]{24}$/.test(id))
    }
  },
  connection: {
    db: {
      admin: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue(true)
      })
    }
  }
}));

const administratorController = require('../../server/controllers/administratorController');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const SystemConfig = require('../../server/models/SystemConfig');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const emailService = require('../../server/utils/emailService');
const { validatePasswordStrength } = require('../../server/utils/passwordValidator');
const { fieldFilter } = require('../../server/utils/fieldFilter');
const { validationResult } = require('express-validator');

describe('Administrator Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: '507f1f77bcf86cd799439011', adminId: 'ADM001', role: 'administrator' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    // Default mocks
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
    
    fieldFilter.mockImplementation((data) => data);
    
    jest.clearAllMocks();
  });

  describe('getAdministrators', () => {
    test('should get administrators with pagination', async () => {
      req.query = { page: 1, limit: 20 };
      
      const mockAdmins = [{
        _id: '507f1f77bcf86cd799439011',
        adminId: 'ADM001',
        firstName: 'John',
        toObject: jest.fn().mockReturnValue({ adminId: 'ADM001', firstName: 'John' })
      }];
      
      Administrator.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockAdmins)
      });
      Administrator.countDocuments.mockResolvedValue(1);

      await administratorController.getAdministrators(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        administrators: expect.any(Array),
        pagination: expect.objectContaining({
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 20
        })
      });
    });

    test('should handle errors', async () => {
      Administrator.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getAdministrators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch administrators'
      });
    });
  });

  describe('createAdministrator', () => {
    test('should create administrator', async () => {
      req.body = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'SecurePass123!',
        permissions: ['administrators.read']
      };

      Administrator.findOne.mockResolvedValue(null);
      Administrator.countDocuments.mockResolvedValue(1);
      
      const mockAdmin = {
        _id: 'new-id',
        adminId: 'ADM002',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ adminId: 'ADM002' })
      };
      Administrator.mockImplementation(() => mockAdmin);

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Administrator created successfully',
        administrator: expect.any(Object)
      });
    });

    test('should handle validation errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid email' }])
      });

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email',
        errors: expect.any(Array)
      });
    });
  });

  describe('updateAdministrator', () => {
    test('should update administrator', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { firstName: 'Updated' };

      const mockAdmin = {
        _id: '507f1f77bcf86cd799439011',
        toObject: jest.fn().mockReturnValue({ adminId: 'ADM001' })
      };
      
      Administrator.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      });

      await administratorController.updateAdministrator(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Administrator updated successfully',
        administrator: expect.any(Object)
      });
    });

    test('should prevent self-deactivation', async () => {
      req.params.id = req.user.id;
      req.body = { isActive: false };

      await administratorController.updateAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    });
  });

  describe('deleteAdministrator', () => {
    test('should delete administrator', async () => {
      req.params.id = '507f1f77bcf86cd799439012';

      Administrator.find.mockResolvedValue([{ permissions: ['all'] }]);
      Administrator.findById.mockResolvedValue({ permissions: [] });
      Administrator.findByIdAndDelete.mockResolvedValue({
        adminId: 'ADM002',
        email: 'deleted@example.com'
      });

      await administratorController.deleteAdministrator(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Administrator deleted successfully'
      });
    });

    test('should prevent self-deletion', async () => {
      req.params.id = req.user.id;

      await administratorController.deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete your own account'
      });
    });
  });

  describe('resetAdministratorPassword', () => {
    test('should reset password', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { newPassword: 'NewPass123!' };

      validatePasswordStrength.mockReturnValue({ success: true });
      
      const mockAdmin = {
        _id: '507f1f77bcf86cd799439011',
        save: jest.fn().mockResolvedValue(true)
      };
      Administrator.findById.mockResolvedValue(mockAdmin);

      await administratorController.resetAdministratorPassword(req, res);

      expect(mockAdmin.password).toBe('NewPass123!');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });
  });

  describe('Operator Management', () => {
    test('createOperator should create new operator', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Operator',
        email: 'operator@example.com',
        password: 'Pass123!',
        workStation: 'Station1',
        shiftStart: '09:00',
        shiftEnd: '17:00'
      };

      Operator.findOne.mockResolvedValue(null);
      const mockOperator = {
        _id: 'op-id',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };
      Operator.mockImplementation(() => mockOperator);
      emailService.sendOperatorWelcomeEmail.mockResolvedValue(true);

      await administratorController.createOperator(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator created successfully',
        operator: expect.any(Object)
      });
    });

    test('getOperators should return operators list', async () => {
      req.query = { page: 1, limit: 20 };
      
      const mockOperators = [{
        _id: 'op1',
        operatorId: 'OP001',
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      }];

      Operator.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockOperators)
      });
      Operator.countDocuments.mockResolvedValue(1);

      await administratorController.getOperators(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operators: expect.any(Array),
        pagination: expect.any(Object)
      });
    });

    test('updateOperator should update operator details', async () => {
      req.params.id = 'op-id';
      req.body = { firstName: 'Updated' };

      Operator.findById.mockResolvedValue({ _id: 'op-id' });
      Operator.findByIdAndUpdate.mockResolvedValue({
        _id: 'op-id',
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      });

      await administratorController.updateOperator(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator updated successfully',
        operator: expect.any(Object)
      });
    });

    test('deactivateOperator should deactivate operator', async () => {
      req.params.id = 'op-id';

      Operator.findByIdAndUpdate.mockResolvedValue({ _id: 'op-id' });
      Order.updateMany.mockResolvedValue({ modifiedCount: 2 });

      await administratorController.deactivateOperator(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator deactivated successfully'
      });
    });
  });

  describe('Analytics Functions', () => {
    test('getDashboard should return dashboard data', async () => {
      Order.aggregate.mockResolvedValue([{
        today: [{ count: 10 }],
        thisWeek: [{ count: 50 }],
        thisMonth: [{ count: 200 }],
        statusDistribution: [],
        processingStatusDistribution: [],
        averageProcessingTime: [{ avg: 45 }]
      }]);
      
      Operator.aggregate.mockResolvedValue([]);
      Affiliate.aggregate.mockResolvedValue([]);
      Operator.countDocuments.mockResolvedValue(10);
      Operator.findOnShift = jest.fn().mockResolvedValue([]);
      Affiliate.countDocuments.mockResolvedValue(20);
      Customer.countDocuments.mockResolvedValue(100);
      Order.countDocuments.mockResolvedValue(5);

      await administratorController.getDashboard(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          orderStats: expect.any(Object),
          operatorPerformance: expect.any(Array),
          affiliatePerformance: expect.any(Array),
          systemHealth: expect.any(Object)
        })
      });
    });

    test('getOrderAnalytics should return order analytics', async () => {
      req.query = { startDate: '2025-01-01', endDate: '2025-01-31' };

      Order.aggregate.mockResolvedValue([
        { _id: '2025-01-01', totalOrders: 10, totalRevenue: 500 }
      ]);

      await administratorController.getOrderAnalytics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          timeline: expect.any(Array),
          processingTimeDistribution: expect.any(Array),
          summary: expect.any(Object)
        })
      });
    });
  });

  describe('System Configuration', () => {
    test('getSystemConfig should return configurations', async () => {
      SystemConfig.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { key: 'wdf_base_rate', value: 1.25 }
        ])
      });

      await administratorController.getSystemConfig(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        configurations: expect.any(Array)
      });
    });

    test('updateSystemConfig should update configuration', async () => {
      req.body = { key: 'wdf_base_rate', value: 1.50 };

      SystemConfig.setValue.mockResolvedValue({
        key: 'wdf_base_rate',
        value: 1.50
      });

      await administratorController.updateSystemConfig(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Configuration updated successfully',
        configuration: expect.any(Object)
      });
    });
  });

  describe('getPermissions', () => {
    test('should return available permissions', async () => {
      await administratorController.getPermissions(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        permissions: expect.arrayContaining([
          'all',
          'administrators.read',
          'administrators.create',
          'operators.manage'
        ])
      });
    });
  });
});
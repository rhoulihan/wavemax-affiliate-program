// Administrator Controller Unit Tests
// Focus on key uncovered functions for coverage improvement

jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/SystemConfig');
jest.mock('../../server/models/Transaction');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/passwordValidator');
jest.mock('../../server/utils/fieldFilter');
jest.mock('../../server/utils/encryption');
jest.mock('express-validator');
jest.mock('mongoose', () => {
  const SchemaClass = jest.fn().mockImplementation(() => {
    const instance = {
      virtual: jest.fn().mockReturnValue({ get: jest.fn() }),
      pre: jest.fn(),
      methods: {},
      statics: {},
      index: jest.fn(),
      set: jest.fn()
    };
    return instance;
  });
  
  SchemaClass.Types = {
    ObjectId: 'ObjectId'
  };
  
  return {
    Schema: SchemaClass,
    model: jest.fn(),
    connection: {
      readyState: 1,
      db: {
        stats: jest.fn()
      }
    },
    Types: {
      ObjectId: jest.fn()
    }
  };
});
jest.mock('crypto');

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
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
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

      expect(mockAdmin.passwordHash).toBeDefined();
      expect(mockAdmin.passwordSalt).toBeDefined();
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
        username: 'johnoperator',
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

      // Mock for recent activity
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });

      await administratorController.getDashboard(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        dashboard: expect.objectContaining({
          orderStats: expect.any(Object),
          operatorPerformance: expect.any(Array),
          affiliatePerformance: expect.any(Array),
          systemHealth: expect.any(Object),
          recentActivity: expect.any(Array)
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

  describe('getAdministratorById', () => {
    test('should get administrator by id', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      const mockAdmin = {
        _id: '507f1f77bcf86cd799439011',
        adminId: 'ADM001',
        firstName: 'John',
        toObject: jest.fn().mockReturnValue({ adminId: 'ADM001', firstName: 'John' })
      };

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      });

      await administratorController.getAdministratorById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        administrator: expect.any(Object)
      });
    });

    test('should handle not found', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await administratorController.getAdministratorById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrator not found'
      });
    });

    test('should handle errors', async () => {
      req.params.id = '507f1f77bcf86cd799439011';

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getAdministratorById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch administrator'
      });
    });
  });

  describe('changeAdministratorPassword', () => {
    test('should change password successfully', async () => {
      req.body = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!'
      };

      const mockAdmin = {
        _id: req.user.id,
        passwordHash: 'hashedOldPassword',
        passwordSalt: 'salt',
        save: jest.fn().mockResolvedValue(true)
      };

      Administrator.findById.mockResolvedValue(mockAdmin);
      validatePasswordStrength.mockReturnValue({ success: true });

      // Mock bcrypt comparison
      const encryptionUtil = require('../../server/utils/encryption');
      encryptionUtil.comparePassword = jest.fn().mockResolvedValue(true);
      encryptionUtil.hashPassword = jest.fn().mockResolvedValue('hashedNewPassword');

      await administratorController.changeAdministratorPassword(req, res);

      expect(mockAdmin.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
    });

    test('should reject incorrect current password', async () => {
      req.body = {
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!'
      };

      const mockAdmin = {
        _id: req.user.id,
        passwordHash: 'hashedOldPassword',
        passwordSalt: 'salt'
      };

      Administrator.findById.mockResolvedValue(mockAdmin);

      const encryptionUtil = require('../../server/utils/encryption');
      encryptionUtil.comparePassword = jest.fn().mockResolvedValue(false);

      await administratorController.changeAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });

    test('should validate new password strength', async () => {
      req.body = {
        currentPassword: 'OldPass123!',
        newPassword: 'weak'
      };

      validatePasswordStrength.mockReturnValue({
        success: false,
        message: 'Password too weak'
      });

      await administratorController.changeAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password too weak'
      });
    });

    test('should handle errors', async () => {
      req.body = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!'
      };

      Administrator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.changeAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to change password'
      });
    });
  });

  describe('getOperatorById', () => {
    test('should get operator by id', async () => {
      req.params.id = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };

      Operator.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOperator)
      });

      await administratorController.getOperatorById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operator: expect.any(Object)
      });
    });

    test('should handle operator not found', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await administratorController.getOperatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operator not found'
      });
    });

    test('should handle errors', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getOperatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch operator'
      });
    });
  });

  describe('resetOperatorPassword', () => {
    test('should reset operator password', async () => {
      req.params.id = 'op-id';
      req.body = { newPassword: 'NewPass123!' };

      validatePasswordStrength.mockReturnValue({ success: true });

      const mockOperator = {
        _id: 'op-id',
        email: 'operator@example.com',
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      await administratorController.resetOperatorPassword(req, res);

      expect(mockOperator.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'operator@example.com',
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    test('should handle operator not found', async () => {
      req.params.id = 'op-id';
      req.body = { newPassword: 'NewPass123!' };

      Operator.findById.mockResolvedValue(null);

      await administratorController.resetOperatorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operator not found'
      });
    });

    test('should handle errors', async () => {
      req.params.id = 'op-id';
      req.body = { newPassword: 'NewPass123!' };

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.resetOperatorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to reset password'
      });
    });
  });

  describe('getOperatorAnalytics', () => {
    test('should get operator analytics', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        operatorId: 'OP001'
      };

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        firstName: 'John'
      };

      Operator.findOne.mockResolvedValue(mockOperator);
      Order.aggregate.mockResolvedValue([
        { totalOrders: 100, totalWeight: 500 }
      ]);

      await administratorController.getOperatorAnalytics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          operator: expect.any(Object),
          performance: expect.any(Object),
          timeline: expect.any(Array),
          comparisons: expect.any(Object)
        })
      });
    });

    test('should handle errors', async () => {
      req.query = { startDate: '2025-01-01' };

      Order.aggregate.mockRejectedValue(new Error('Aggregation Error'));

      await administratorController.getOperatorAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch operator analytics'
      });
    });
  });

  describe('getAffiliateAnalytics', () => {
    test('should get affiliate analytics', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        affiliateId: 'AFF001'
      };

      const mockAffiliate = {
        _id: 'aff-id',
        affiliateId: 'AFF001',
        businessName: 'Test Business'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.aggregate.mockResolvedValue([
        { totalOrders: 50, totalRevenue: 2500 }
      ]);

      await administratorController.getAffiliateAnalytics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          affiliate: expect.any(Object),
          performance: expect.any(Object),
          timeline: expect.any(Array),
          customerAnalytics: expect.any(Object)
        })
      });
    });

    test('should handle errors', async () => {
      req.query = { startDate: '2025-01-01' };

      Order.aggregate.mockRejectedValue(new Error('Aggregation Error'));

      await administratorController.getAffiliateAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliate analytics'
      });
    });
  });

  describe('exportReport', () => {
    test('should export report as CSV', async () => {
      req.body = {
        reportType: 'orders',
        format: 'csv',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockOrders = [
        { orderId: 'ORD001', totalAmount: 50 }
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      });

      await administratorController.exportReport(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment')
      );
    });

    test('should export report as JSON', async () => {
      req.body = {
        reportType: 'operators',
        format: 'json',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockOperators = [
        { operatorId: 'OP001', firstName: 'John' }
      ];

      Operator.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOperators)
      });

      await administratorController.exportReport(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        metadata: expect.any(Object)
      });
    });

    test('should handle invalid report type', async () => {
      req.body = {
        reportType: 'invalid',
        format: 'csv'
      };

      await administratorController.exportReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid report type'
      });
    });

    test('should handle errors', async () => {
      req.body = {
        reportType: 'orders',
        format: 'csv'
      };

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.exportReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to export report'
      });
    });
  });

  describe('getAffiliatesList', () => {
    test('should get affiliates list', async () => {
      req.query = { page: 1, limit: 20 };

      const mockAffiliates = [{
        _id: 'aff1',
        affiliateId: 'AFF001',
        businessName: 'Test Business'
      }];

      Affiliate.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockAffiliates)
      });
      Affiliate.countDocuments.mockResolvedValue(1);

      await administratorController.getAffiliatesList(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliates: expect.any(Array),
        pagination: expect.any(Object)
      });
    });

    test('should handle errors', async () => {
      Affiliate.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getAffiliatesList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliates'
      });
    });
  });

  describe('getSystemHealth', () => {
    test('should get system health status', async () => {
      const mongoose = require('mongoose');
      mongoose.connection = {
        readyState: 1,
        db: {
          stats: jest.fn().mockResolvedValue({
            db: 'test',
            collections: 10,
            dataSize: 1000000
          })
        }
      };

      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50000000,
        heapTotal: 100000000,
        external: 10000000,
        rss: 150000000
      });

      process.uptime = jest.fn().mockReturnValue(3600);

      await administratorController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        health: expect.objectContaining({
          status: 'healthy',
          database: expect.any(Object),
          memory: expect.any(Object),
          uptime: expect.any(Number),
          environment: expect.any(Object)
        })
      });
    });

    test('should handle database connection issues', async () => {
      const mongoose = require('mongoose');
      mongoose.connection = {
        readyState: 0
      };

      await administratorController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        health: expect.objectContaining({
          status: 'unhealthy',
          database: expect.objectContaining({
            connected: false
          })
        })
      });
    });

    test('should handle errors', async () => {
      const mongoose = require('mongoose');
      mongoose.connection = {
        readyState: 1,
        db: {
          stats: jest.fn().mockRejectedValue(new Error('Stats Error'))
        }
      };

      await administratorController.getSystemHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch system health'
      });
    });
  });

  describe('updateOperatorStats', () => {
    test('should update operator stats', async () => {
      req.params.id = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);

      const mockStats = {
        totalOrders: 100,
        averageProcessingTime: 45
      };

      Order.aggregate.mockResolvedValue([mockStats]);

      await administratorController.updateOperatorStats(req, res);

      expect(mockOperator.totalOrdersProcessed).toBe(100);
      expect(mockOperator.averageProcessingTime).toBe(45);
      expect(mockOperator.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator stats updated successfully',
        stats: expect.any(Object)
      });
    });

    test('should handle operator not found', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockResolvedValue(null);

      await administratorController.updateOperatorStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operator not found'
      });
    });

    test('should handle errors', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.updateOperatorStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update operator stats'
      });
    });
  });

  describe('getAvailableOperators', () => {
    test('should get available operators', async () => {
      const mockOperators = [
        {
          _id: 'op1',
          operatorId: 'OP001',
          firstName: 'John',
          isActive: true,
          isOnShift: true
        }
      ];

      Operator.find.mockResolvedValue(mockOperators);

      await administratorController.getAvailableOperators(req, res);

      expect(Operator.find).toHaveBeenCalledWith({
        isActive: true,
        isOnShift: true
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operators: expect.any(Array)
      });
    });

    test('should handle errors', async () => {
      Operator.find.mockRejectedValue(new Error('DB Error'));

      await administratorController.getAvailableOperators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch available operators'
      });
    });
  });

  describe('deleteOperator', () => {
    test('should delete operator', async () => {
      req.params.id = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001'
      };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.countDocuments.mockResolvedValue(0);
      Operator.findByIdAndDelete.mockResolvedValue(mockOperator);

      await administratorController.deleteOperator(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator deleted successfully'
      });
    });

    test('should prevent deletion with active orders', async () => {
      req.params.id = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001'
      };

      Operator.findById.mockResolvedValue(mockOperator);
      Order.countDocuments.mockResolvedValue(5);

      await administratorController.deleteOperator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete operator with active orders'
      });
    });

    test('should handle errors', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.deleteOperator(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to delete operator'
      });
    });
  });

  describe('resetOperatorPin', () => {
    test('should reset operator PIN', async () => {
      req.params.id = 'op-id';

      const newPin = '1234';
      const crypto = require('crypto');
      crypto.randomInt = jest.fn().mockReturnValue(1234);

      const mockOperator = {
        _id: 'op-id',
        email: 'operator@example.com',
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);
      emailService.sendPinResetEmail.mockResolvedValue(true);

      await administratorController.resetOperatorPin(req, res);

      expect(mockOperator.pin).toBeDefined();
      expect(mockOperator.save).toHaveBeenCalled();
      expect(emailService.sendPinResetEmail).toHaveBeenCalledWith(
        'operator@example.com',
        expect.objectContaining({ pin: newPin })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'PIN reset successfully and sent to operator email'
      });
    });

    test('should handle operator not found', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockResolvedValue(null);

      await administratorController.resetOperatorPin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operator not found'
      });
    });

    test('should handle errors', async () => {
      req.params.id = 'op-id';

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.resetOperatorPin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to reset PIN'
      });
    });
  });

  describe('updateOperatorSelf', () => {
    test('should update operator self', async () => {
      req.user = { id: 'op-id', role: 'operator' };
      req.body = {
        firstName: 'Updated',
        phone: '555-1234'
      };

      const mockOperator = {
        _id: 'op-id',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };

      Operator.findById.mockResolvedValue(mockOperator);

      await administratorController.updateOperatorSelf(req, res);

      expect(mockOperator.firstName).toBe('Updated');
      expect(mockOperator.phone).toBe('555-1234');
      expect(mockOperator.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        operator: expect.any(Object)
      });
    });

    test('should prevent updating protected fields', async () => {
      req.user = { id: 'op-id', role: 'operator' };
      req.body = {
        operatorId: 'HACKED',
        isActive: false,
        permissions: ['all']
      };

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        isActive: true,
        permissions: ['basic'],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };

      Operator.findById.mockResolvedValue(mockOperator);

      await administratorController.updateOperatorSelf(req, res);

      expect(mockOperator.operatorId).toBe('OP001');
      expect(mockOperator.isActive).toBe(true);
      expect(mockOperator.permissions).toEqual(['basic']);
    });

    test('should handle errors', async () => {
      req.user = { id: 'op-id', role: 'operator' };
      req.body = { firstName: 'Updated' };

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.updateOperatorSelf(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update profile'
      });
    });
  });

  describe('getOperatorSelf', () => {
    test('should get operator self profile', async () => {
      req.user = { id: 'op-id', role: 'operator' };

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };

      Operator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockOperator)
      });

      await administratorController.getOperatorSelf(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operator: expect.any(Object)
      });
    });

    test('should handle operator not found', async () => {
      req.user = { id: 'op-id', role: 'operator' };

      Operator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await administratorController.getOperatorSelf(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operator profile not found'
      });
    });

    test('should handle errors', async () => {
      req.user = { id: 'op-id', role: 'operator' };

      Operator.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getOperatorSelf(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch profile'
      });
    });
  });

  describe('getEnvironmentVariables', () => {
    test('should get environment variables', async () => {
      const originalEnv = process.env;
      process.env = {
        NODE_ENV: 'test',
        PORT: '3000',
        EMAIL_PROVIDER: 'smtp',
        SECRET_KEY: 'should-be-hidden'
      };

      await administratorController.getEnvironmentVariables(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        environment: expect.objectContaining({
          nodeEnv: 'test',
          features: expect.any(Object),
          email: expect.any(Object),
          database: expect.any(Object),
          api: expect.any(Object)
        })
      });

      // Ensure sensitive data is not exposed
      const response = res.json.mock.calls[0][0];
      expect(response.environment).not.toHaveProperty('SECRET_KEY');
      
      process.env = originalEnv;
    });

    test('should handle errors', async () => {
      const originalEnv = process.env;
      process.env = undefined;

      await administratorController.getEnvironmentVariables(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch environment variables'
      });

      process.env = originalEnv;
    });
  });

  describe('Additional coverage for getAdministrators', () => {
    test('should handle search with active filter', async () => {
      req.query = {
        search: 'john',
        active: 'true',
        sortBy: 'firstName',
        sortOrder: 'asc'
      };

      const mockAdmins = [{
        _id: '507f1f77bcf86cd799439011',
        firstName: 'John',
        isActive: true,
        toObject: jest.fn().mockReturnValue({ firstName: 'John' })
      }];

      Administrator.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockAdmins)
      });
      Administrator.countDocuments.mockResolvedValue(1);

      await administratorController.getAdministrators(req, res);

      expect(Administrator.find).toHaveBeenCalledWith({
        isActive: true,
        $or: expect.arrayContaining([
          expect.objectContaining({ firstName: expect.any(RegExp) })
        ])
      });
    });
  });

  describe('Additional coverage for createAdministrator', () => {
    test('should handle duplicate email', async () => {
      req.body = {
        email: 'existing@example.com',
        password: 'Pass123!'
      };

      Administrator.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrator with this email already exists'
      });
    });

    test('should handle password validation failure', async () => {
      req.body = {
        email: 'new@example.com',
        password: 'weak'
      };

      Administrator.findOne.mockResolvedValue(null);
      validatePasswordStrength.mockReturnValue({
        success: false,
        message: 'Password too weak'
      });

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password too weak'
      });
    });
  });

  describe('Additional coverage for updateAdministrator', () => {
    test('should handle administrator not found', async () => {
      req.params.id = 'nonexistent';
      req.body = { firstName: 'Updated' };

      Administrator.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await administratorController.updateAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrator not found'
      });
    });

    test('should handle database errors', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { firstName: 'Updated' };

      Administrator.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.updateAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update administrator'
      });
    });
  });

  describe('Additional coverage for deleteAdministrator', () => {
    test('should prevent deleting last super admin', async () => {
      req.params.id = '507f1f77bcf86cd799439012';

      Administrator.find.mockResolvedValue([
        { permissions: ['all'] }
      ]);
      Administrator.findById.mockResolvedValue({
        permissions: ['all']
      });

      await administratorController.deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete the last super administrator'
      });
    });

    test('should handle database errors', async () => {
      req.params.id = '507f1f77bcf86cd799439012';

      Administrator.find.mockRejectedValue(new Error('DB Error'));

      await administratorController.deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to delete administrator'
      });
    });
  });

  describe('Additional coverage for resetAdministratorPassword', () => {
    test('should handle admin not found', async () => {
      req.params.id = 'nonexistent';
      req.body = { newPassword: 'NewPass123!' };

      Administrator.findById.mockResolvedValue(null);

      await administratorController.resetAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Administrator not found'
      });
    });

    test('should handle weak password', async () => {
      req.params.id = '507f1f77bcf86cd799439011';
      req.body = { newPassword: 'weak' };

      validatePasswordStrength.mockReturnValue({
        success: false,
        message: 'Password does not meet requirements'
      });

      await administratorController.resetAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password does not meet requirements'
      });
    });
  });
});
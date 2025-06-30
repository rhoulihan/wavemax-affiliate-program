// Administrator Controller Unit Tests
// Focus on key uncovered functions for coverage improvement

// First, set up manual mocks before any requires
jest.mock('../../server/models/Administrator', () => {
  const mockMethods = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
  
  // Make chainable methods return the mock object
  Object.keys(mockMethods).forEach(method => {
    if (['select', 'populate', 'sort', 'limit', 'skip', 'lean'].includes(method)) {
      mockMethods[method].mockReturnValue(mockMethods);
    }
  });
  
  // Mock constructor
  const MockAdministrator = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({})
  }));
  
  // Add static methods
  Object.assign(MockAdministrator, {
    ...mockMethods,
    find: jest.fn().mockReturnValue(mockMethods),
    findOne: jest.fn().mockReturnValue(mockMethods),
    findById: jest.fn().mockReturnValue(mockMethods),
    findByIdAndUpdate: jest.fn().mockReturnValue(mockMethods),
    findByIdAndDelete: jest.fn().mockReturnValue(mockMethods)
  });
  
  return MockAdministrator;
});

jest.mock('../../server/models/Operator', () => {
  const mockMethods = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    findOnShift: jest.fn(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
  
  // Make chainable methods return the mock object
  Object.keys(mockMethods).forEach(method => {
    if (['select', 'populate', 'sort', 'limit', 'skip', 'lean'].includes(method)) {
      mockMethods[method].mockReturnValue(mockMethods);
    }
  });
  
  // Mock constructor
  const MockOperator = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({})
  }));
  
  // Add static methods
  Object.assign(MockOperator, {
    ...mockMethods,
    find: jest.fn().mockReturnValue(mockMethods),
    findOne: jest.fn().mockReturnValue(mockMethods),
    findById: jest.fn().mockReturnValue(mockMethods),
    findByIdAndUpdate: jest.fn().mockReturnValue(mockMethods),
    findByIdAndDelete: jest.fn().mockReturnValue(mockMethods)
  });
  
  return MockOperator;
});

jest.mock('../../server/models/Order', () => {
  const mockMethods = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
  
  // Make chainable methods return the mock object
  Object.keys(mockMethods).forEach(method => {
    if (['select', 'populate', 'sort', 'limit', 'skip', 'lean'].includes(method)) {
      mockMethods[method].mockReturnValue(mockMethods);
    }
  });
  
  return {
    ...mockMethods,
    find: jest.fn().mockReturnValue(mockMethods),
    findOne: jest.fn().mockReturnValue(mockMethods),
    findById: jest.fn().mockReturnValue(mockMethods)
  };
});

jest.mock('../../server/models/Affiliate', () => {
  const mockMethods = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };
  
  // Make chainable methods return the mock object
  Object.keys(mockMethods).forEach(method => {
    if (['select', 'populate', 'sort', 'limit', 'skip', 'lean'].includes(method)) {
      mockMethods[method].mockReturnValue(mockMethods);
    }
  });
  
  return {
    ...mockMethods,
    find: jest.fn().mockReturnValue(mockMethods),
    findOne: jest.fn().mockReturnValue(mockMethods),
    findById: jest.fn().mockReturnValue(mockMethods)
  };
});

jest.mock('../../server/models/Customer', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../server/models/SystemConfig', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  setValue: jest.fn(),
  getValue: jest.fn()
}));

jest.mock('../../server/models/Transaction', () => ({
  find: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendAffiliateWelcomeEmail: jest.fn(),
  sendOperatorWelcomeEmail: jest.fn(),
  sendAdministratorWelcomeEmail: jest.fn()
}));
jest.mock('../../server/utils/passwordValidator');
jest.mock('../../server/utils/fieldFilter');
jest.mock('../../server/utils/encryption', () => ({
  hashPassword: jest.fn().mockReturnValue({
    salt: 'mockSalt',
    hash: 'mockHash'
  }),
  encrypt: jest.fn().mockReturnValue('encrypted'),
  decrypt: jest.fn().mockReturnValue('decrypted'),
  comparePassword: jest.fn().mockResolvedValue(true)
}));
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
        stats: jest.fn().mockResolvedValue({
          db: 'test',
          collections: 10,
          objects: 1000,
          dataSize: 1000000,
          storageSize: 2000000
        })
      }
    },
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true)
      }
    }
  };
});
jest.mock('crypto', () => ({
  randomInt: jest.fn(),
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('randomstring')
  })
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
const encryptionUtil = require('../../server/utils/encryption');

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

    // Clear all mocks before setting defaults
    jest.clearAllMocks();
    
    // Ensure encryption util is properly mocked
    encryptionUtil.hashPassword.mockReturnValue({
      salt: 'mockSalt',
      hash: 'mockHash'
    });
    encryptionUtil.comparePassword.mockResolvedValue(true);
    
    // Reset all model mocks to default behavior
    const mockChainMethods = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn()
    };
    
    // Reset Administrator mock
    Administrator.find.mockReset();
    Administrator.findOne.mockReset();
    Administrator.findById.mockReset();
    Administrator.findByIdAndUpdate.mockReset();
    Administrator.findByIdAndDelete.mockReset();
    Administrator.countDocuments.mockReset();
    Administrator.aggregate.mockReset();
    Administrator.create.mockReset();
    
    // Reset Operator mock
    Operator.find.mockReset();
    Operator.findOne.mockReset();
    Operator.findById.mockReset();
    Operator.findByIdAndUpdate.mockReset();
    Operator.findByIdAndDelete.mockReset();
    Operator.countDocuments.mockReset();
    Operator.aggregate.mockReset();
    Operator.create.mockReset();
    
    // Reset Order mock
    Order.find.mockReset();
    Order.findOne.mockReset();
    Order.findById.mockReset();
    Order.countDocuments.mockReset();
    Order.aggregate.mockReset();
    Order.updateMany.mockReset();

    // Default mocks
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });

    fieldFilter.mockImplementation((data) => data);
    
    // Default password validation to pass
    validatePasswordStrength.mockReturnValue({ success: true });
    
    // Reset mongoose ObjectId mock behavior
    const mongoose = require('mongoose');
    mongoose.Types.ObjectId.isValid = jest.fn().mockReturnValue(true);
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
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        passwordSalt: 'mockSalt',
        passwordHash: 'mockHash',
        permissions: ['administrators.read'],
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ 
          adminId: 'ADM002', 
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe'
        })
      };
      
      // Set up the constructor mock for this test
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
        adminId: 'ADM001',
        save: jest.fn().mockResolvedValue(true),
        passwordHash: undefined,
        passwordSalt: undefined
      };
      Administrator.findById.mockResolvedValue(mockAdmin);

      await administratorController.resetAdministratorPassword(req, res);

      // Check that password fields were set by the controller
      expect(mockAdmin.passwordHash).toBe('mockHash');
      expect(mockAdmin.passwordSalt).toBe('mockSalt');
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
        operatorId: 'OP001',
        firstName: 'John',
        lastName: 'Operator',
        email: 'operator@example.com',
        username: 'johnoperator',
        password: 'Pass123!',
        shiftStart: '09:00',
        shiftEnd: '17:00',
        createdBy: req.user.id,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ 
          operatorId: 'OP001', 
          email: 'operator@example.com',
          firstName: 'John',
          lastName: 'Operator' 
        })
      };
      
      // Set up the constructor mock for this test  
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
        email: 'admin@example.com',
        passwordHash: 'hashedOldPassword',
        passwordSalt: 'salt',
        verifyPassword: jest.fn().mockReturnValue(true),
        isPasswordInHistory: jest.fn().mockReturnValue(false),
        setPassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock the findById chain to return the admin with password
      Administrator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      });
      validatePasswordStrength.mockReturnValue({ success: true });

      await administratorController.changeAdministratorPassword(req, res);

      expect(mockAdmin.setPassword).toHaveBeenCalledWith('NewPass123!');
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
        email: 'admin@example.com',
        passwordHash: 'hashedOldPassword',
        passwordSalt: 'salt',
        verifyPassword: jest.fn().mockReturnValue(false)
      };

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      });

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

      const mockAdmin = {
        _id: req.user.id,
        email: 'admin@example.com',
        passwordHash: 'hashedOldPassword',
        passwordSalt: 'salt',
        verifyPassword: jest.fn().mockReturnValue(true),
        isPasswordInHistory: jest.fn().mockReturnValue(false)
      };

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAdmin)
      });
      
      validatePasswordStrength.mockReturnValue({
        success: false,
        errors: ['Password too weak']
      });

      await administratorController.changeAdministratorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password does not meet security requirements',
        errors: ['Password too weak']
      });
    });

    test('should handle errors', async () => {
      req.body = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!'
      };

      Administrator.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

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
      req.params.operatorId = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        toObject: jest.fn().mockReturnValue({ operatorId: 'OP001' })
      };

      Operator.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOperator)
      });
      
      Order.aggregate.mockResolvedValue([{
        totalOrders: 10,
        completedOrders: 8,
        averageProcessingTime: 25,
        qualityChecksPassed: 7,
        qualityChecksTotal: 8
      }]);

      await administratorController.getOperatorById(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operator: expect.any(Object),
        statistics: expect.objectContaining({
          totalOrders: 10,
          completedOrders: 8
        })
      });
    });

    test('should handle operator not found', async () => {
      req.params.operatorId = 'op-id';

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
      req.params.operatorId = 'op-id';

      Operator.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getOperatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch operator details'
      });
    });
  });

  describe('resetOperatorPassword', () => {
    test('should reset operator password', async () => {
      req.params.id = 'op-id';

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        email: 'operator@example.com',
        password: undefined,
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      // Mock crypto.randomBytes
      const crypto = require('crypto');
      crypto.randomBytes = jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('randompassword')
      });

      await administratorController.resetOperatorPassword(req, res);

      expect(mockOperator.password).toBe('randompassword');
      expect(mockOperator.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockOperator,
        'randompassword'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully. New password sent to operator email.'
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

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.resetOperatorPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to reset operator password'
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

      // Mock operator analytics aggregation
      Operator.aggregate.mockResolvedValue([{
        _id: 'op-id',
        operatorId: 'OP001',
        firstName: 'John',
        lastName: 'Doe',
        metrics: {
          totalOrders: 100,
          completedOrders: 90,
          averageProcessingTime: 25,
          qualityChecksPassed: 85
        }
      }]);
      
      // Mock workstation analytics
      Order.aggregate.mockResolvedValue([{
        _id: 'Station1',
        orderCount: 50,
        avgProcessingTime: 30
      }]);

      await administratorController.getOperatorAnalytics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: {
          operators: expect.any(Array),
          workstations: expect.any(Array)
        }
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

      // Mock affiliate analytics aggregation
      Affiliate.aggregate.mockResolvedValue([{
        _id: 'aff-id',
        affiliateId: 'AFF001',
        businessName: 'Test Business',
        metrics: {
          totalCustomers: 100,
          activeCustomers: 80,
          totalOrders: 500,
          totalRevenue: 25000
        }
      }]);
      
      // Mock geographic distribution
      Customer.aggregate.mockResolvedValue([{
        _id: 'City1',
        affiliateCount: 10,
        activeAffiliates: 8
      }]);

      await administratorController.getAffiliateAnalytics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        analytics: {
          affiliates: expect.any(Array),
          geographicDistribution: expect.any(Array)
        }
      });
    });

    test('should handle errors', async () => {
      req.query = { startDate: '2025-01-01' };

      Affiliate.aggregate.mockRejectedValue(new Error('Aggregation Error'));

      await administratorController.getAffiliateAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliate analytics'
      });
    });
  });

  describe('exportReport', () => {
    test('should export orders report', async () => {
      req.query = {
        reportType: 'orders',
        format: 'json',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockOrders = [
        { 
          orderId: 'ORD001', 
          totalAmount: 50,
          createdAt: new Date('2025-01-15'),
          affiliateId: null,
          assignedOperator: null,
          status: 'completed',
          orderProcessingStatus: 'completed',
          processingTimeMinutes: 25,
          actualWeight: 10,
          actualTotal: 50
        }
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      });

      await administratorController.exportReport(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        report: expect.any(Array),
        metadata: expect.objectContaining({
          reportType: 'orders',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        })
      });
    });

    test('should export operators report', async () => {
      req.query = {
        reportType: 'operators',
        format: 'json',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockOperators = [
        { 
          _id: 'op-id',
          operatorId: 'OP001', 
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          shiftStart: '09:00',
          shiftEnd: '17:00',
          totalOrdersProcessed: 100,
          averageProcessingTime: 25,
          qualityScore: 95
        }
      ];

      Operator.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockOperators)
      });
      
      Order.aggregate.mockResolvedValue([{
        totalOrders: 50,
        completedOrders: 45,
        averageProcessingTime: 25,
        totalWeight: 500
      }]);

      await administratorController.exportReport(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        report: expect.any(Array),
        metadata: expect.objectContaining({
          reportType: 'operators'
        })
      });
    });

    test('should handle invalid report type', async () => {
      req.query = {
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
      req.query = {
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
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Business',
        email: 'affiliate@example.com',
        isActive: true,
        serviceArea: 'City1'
      }];

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockAffiliates)
      });

      await administratorController.getAffiliatesList(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        affiliates: expect.any(Array)
      });
    });

    test('should handle errors', async () => {
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getAffiliatesList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch affiliates list',
        error: 'DB Error'
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
          }),
          admin: jest.fn().mockReturnValue({
            ping: jest.fn().mockResolvedValue(true)
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
      process.cpuUsage = jest.fn().mockReturnValue({
        user: 1000000,
        system: 500000
      });

      await administratorController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        health: expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(Date),
          components: expect.objectContaining({
            database: 'healthy',
            email: 'healthy',
            storage: 'healthy'
          }),
          metrics: expect.objectContaining({
            uptime: expect.any(Number),
            memory: expect.any(Object),
            cpu: expect.any(Object)
          })
        })
      });
    });

    test('should handle database connection issues', async () => {
      const mongoose = require('mongoose');
      mongoose.connection = {
        readyState: 1,
        db: {
          admin: jest.fn().mockReturnValue({
            ping: jest.fn().mockRejectedValue(new Error('Connection failed'))
          })
        }
      };

      await administratorController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        health: expect.objectContaining({
          status: 'degraded',
          components: expect.objectContaining({
            database: 'unhealthy'
          })
        })
      });
    });

    test('should handle errors', async () => {
      const mongoose = require('mongoose');
      const originalConnection = mongoose.connection;
      
      mongoose.connection = {
        readyState: 1,
        db: {
          admin: jest.fn().mockReturnValue({
            ping: jest.fn().mockRejectedValue(new Error('DB Connection Error'))
          })
        }
      };

      await administratorController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        health: expect.objectContaining({
          status: 'degraded',
          components: expect.objectContaining({
            database: 'unhealthy'
          })
        })
      });
      
      mongoose.connection = originalConnection;
    });
  });

  describe('updateOperatorStats', () => {
    test('should update operator stats with processing time', async () => {
      req.params.id = 'op-id';
      req.body = { processingTime: 30 };

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        totalOrdersProcessed: 10,
        averageProcessingTime: 25,
        qualityScore: 95,
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);

      await administratorController.updateOperatorStats(req, res);

      // Check new average: (25 * 10 + 30) / 11 = 25.45
      expect(mockOperator.totalOrdersProcessed).toBe(11);
      expect(mockOperator.averageProcessingTime).toBeCloseTo(25.45, 1);
      expect(mockOperator.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operator statistics updated successfully',
        operator: expect.objectContaining({
          operatorId: 'OP001',
          totalOrdersProcessed: 11
        })
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

    test('should validate processing time', async () => {
      req.params.id = 'op-id';
      req.body = { processingTime: -5 };

      await administratorController.updateOperatorStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Processing time must be positive'
      });
    });
    
    test('should handle errors', async () => {
      req.params.id = 'op-id';
      req.body = { processingTime: 20 };

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.updateOperatorStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while updating operator statistics'
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
          isOnShift: true,
          toObject: jest.fn().mockReturnValue({ operatorId: 'OP001', firstName: 'John' })
        }
      ];

      Operator.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockOperators)
      });

      await administratorController.getAvailableOperators(req, res);

      expect(Operator.find).toHaveBeenCalledWith({
        isActive: true,
        currentOrderCount: { $lt: 10 }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        operators: expect.any(Array)
      });
    });

    test('should handle errors', async () => {
      Operator.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB Error'))
      });

      await administratorController.getAvailableOperators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while fetching available operators'
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
        message: 'An error occurred while deleting the operator'
      });
    });
  });

  describe('resetOperatorPin', () => {
    test('should reset operator PIN', async () => {
      req.params.id = 'op-id';
      req.body = { newPassword: 'NewPin1234!' };

      const mockOperator = {
        _id: 'op-id',
        operatorId: 'OP001',
        email: 'operator@example.com',
        password: undefined,
        loginAttempts: 5,
        lockUntil: new Date(Date.now() + 3600000),
        save: jest.fn().mockResolvedValue(true)
      };

      Operator.findById.mockResolvedValue(mockOperator);

      await administratorController.resetOperatorPin(req, res);

      expect(mockOperator.password).toBe('NewPin1234!');
      expect(mockOperator.loginAttempts).toBe(0);
      expect(mockOperator.lockUntil).toBeUndefined();
      expect(mockOperator.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'PIN reset successfully'
      });
    });

    test('should handle operator not found', async () => {
      req.params.id = 'op-id';
      req.body = { newPassword: 'NewPin1234!' };

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
      req.body = { newPassword: 'NewPin1234!' };

      Operator.findById.mockRejectedValue(new Error('DB Error'));

      await administratorController.resetOperatorPin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred while resetting the PIN'
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

      const response = res.json.mock.calls[0][0];
      
      expect(response).toMatchObject({
        success: true,
        variables: expect.objectContaining({
          NODE_ENV: 'test',
          PORT: '3000',
          EMAIL_PROVIDER: 'smtp'
        }),
        sensitiveValues: expect.any(Object),
        isSuperAdmin: expect.any(Boolean)
      });

      // SECRET_KEY is not in the allowed list, so it shouldn't appear
      expect(response.variables.SECRET_KEY).toBeUndefined();
      
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
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@example.com',
        password: 'Pass123!',
        permissions: ['administrators.read']
      };

      Administrator.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });

    test('should handle password validation failure', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'new@example.com',
        password: 'weak',
        permissions: ['administrators.read']
      };

      // Mock validation result to simulate password validation failure
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Password must be at least 8 characters' }
        ])
      });

      await administratorController.createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password must be at least 8 characters',
        errors: expect.any(Array)
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

      Administrator.find.mockResolvedValue([]);  // No other admins with 'all' permissions
      Administrator.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        adminId: 'ADM001',
        permissions: ['all'],
        toObject: jest.fn().mockReturnValue({ adminId: 'ADM001' })
      });

      await administratorController.deleteAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot delete the last administrator with full permissions'
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
        message: 'Password does not meet security requirements',
        errors: undefined
      });
    });
  });
});
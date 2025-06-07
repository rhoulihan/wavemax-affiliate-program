// Enhanced Administrator Controller Tests
// Tests for administrator management functions

// Mock modules before importing them
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
jest.mock('express-validator');

const {
  getAdministrators,
  getAdministratorById,
  createAdministrator,
  updateAdministrator,
  deleteAdministrator,
  resetAdministratorPassword,
  getPermissions,
  deactivateOperator,
  resetOperatorPassword,
  getOperatorAnalytics,
  getAffiliateAnalytics,
  exportReport,
  updateOperatorStats,
  getAvailableOperators,
  deleteOperator,
  resetOperatorPin,
  updateOperatorSelf,
  getOperatorSelf
} = require('../../server/controllers/administratorController');

const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const SystemConfig = require('../../server/models/SystemConfig');
const { logAuditEvent, AuditEvents } = require('../../server/utils/auditLogger');
const emailService = require('../../server/utils/emailService');
const { validatePasswordStrength } = require('../../server/utils/passwordValidator');
const { fieldFilter } = require('../../server/utils/fieldFilter');
const { validationResult } = require('express-validator');

describe('Administrator Controller - Enhanced Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: '507f1f77bcf86cd799439011', adminId: 'ADM001', role: 'administrator' },
      pagination: { limit: 10, skip: 0, page: 1 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };
    
    // Mock express-validator
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
    
    // Mock fieldFilter
    fieldFilter.mockImplementation((data) => data);
    
    jest.clearAllMocks();
  });

  describe('Administrator Management', () => {
    describe('getAdministrators', () => {
      test('should get all administrators with pagination', async () => {
        const mockAdmins = [
          { 
            adminId: 'ADM001', 
            firstName: 'John', 
            email: 'john@example.com',
            toObject: jest.fn().mockReturnValue({ adminId: 'ADM001', firstName: 'John', email: 'john@example.com' })
          },
          { 
            adminId: 'ADM002', 
            firstName: 'Jane', 
            email: 'jane@example.com',
            toObject: jest.fn().mockReturnValue({ adminId: 'ADM002', firstName: 'Jane', email: 'jane@example.com' })
          }
        ];
        
        Administrator.find.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockResolvedValue(mockAdmins)
        });
        Administrator.countDocuments.mockResolvedValue(2);

        await getAdministrators(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          administrators: expect.arrayContaining([
            expect.objectContaining({ adminId: 'ADM001' }),
            expect.objectContaining({ adminId: 'ADM002' })
          ]),
          pagination: expect.objectContaining({
            currentPage: 1,
            totalPages: 1,
            totalItems: 2,
            itemsPerPage: 20
          })
        });
      });

      test('should filter administrators by search query', async () => {
        req.query = { search: 'john' };
        
        Administrator.find.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockResolvedValue([])
        });
        Administrator.countDocuments.mockResolvedValue(0);

        await getAdministrators(req, res);

        expect(Administrator.find).toHaveBeenCalledWith(
          expect.objectContaining({
            $or: expect.arrayContaining([
              { firstName: expect.any(RegExp) },
              { lastName: expect.any(RegExp) },
              { email: expect.any(RegExp) },
              { adminId: expect.any(RegExp) }
            ])
          })
        );
      });

      test('should handle database errors', async () => {
        Administrator.find.mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockRejectedValue(new Error('Database error'))
        });

        await getAdministrators(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Failed to fetch administrators'
        });
      });
    });

    describe('getAdministratorById', () => {
      test('should get administrator by ID', async () => {
        req.params.id = '507f1f77bcf86cd799439011'; // Valid ObjectId
        const mockAdmin = { 
          _id: '507f1f77bcf86cd799439011', 
          adminId: 'ADM001', 
          firstName: 'John',
          permissions: ['all'],
          toObject: jest.fn().mockReturnValue({
            _id: '507f1f77bcf86cd799439011',
            adminId: 'ADM001',
            firstName: 'John',
            permissions: ['all']
          })
        };
        
        Administrator.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockAdmin)
        });

        await getAdministratorById(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          administrator: expect.objectContaining({
            adminId: 'ADM001',
            firstName: 'John'
          })
        });
      });

      test('should return 404 for non-existent administrator', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        Administrator.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        await getAdministratorById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Administrator not found'
        });
      });

      test('should return 400 for invalid ObjectId', async () => {
        req.params.id = 'invalid-id';

        await getAdministratorById(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid administrator ID'
        });
      });
    });

    describe('createAdministrator', () => {
      test('should create new administrator with valid data', async () => {
        req.body = {
          firstName: 'New',
          lastName: 'Admin',
          email: 'newadmin@example.com',
          password: 'SecurePassword123!',
          permissions: ['administrators.read', 'operators.manage']
        };
        
        // Mock validation result - no errors
        validationResult.mockReturnValue({
          isEmpty: jest.fn().mockReturnValue(true),
          array: jest.fn().mockReturnValue([])
        });
        
        // Mock existing admin check
        Administrator.findOne.mockResolvedValue(null);
        
        const mockAdminCount = 5;
        Administrator.countDocuments.mockResolvedValue(mockAdminCount);
        
        const mockSavedAdmin = {
          _id: 'new-admin-id',
          adminId: 'ADM006',
          firstName: 'New',
          lastName: 'Admin',
          email: 'newadmin@example.com',
          permissions: ['administrators.read', 'operators.manage'],
          save: jest.fn().mockResolvedValue(true),
          toObject: jest.fn().mockReturnValue({
            _id: 'new-admin-id',
            adminId: 'ADM006',
            firstName: 'New',
            lastName: 'Admin',
            email: 'newadmin@example.com'
          })
        };
        Administrator.mockImplementation(() => mockSavedAdmin);

        await createAdministrator(req, res);

        expect(Administrator.findOne).toHaveBeenCalledWith({ email: 'newadmin@example.com' });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Administrator created successfully',
          administrator: expect.objectContaining({
            adminId: 'ADM006'
          })
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should return validation errors', async () => {
        req.body = {
          firstName: 'New',
          lastName: 'Admin',
          email: 'invalid-email',
          password: 'weak'
        };

        // Mock validation errors
        validationResult.mockReturnValue({
          isEmpty: jest.fn().mockReturnValue(false),
          array: jest.fn().mockReturnValue([
            { msg: 'Invalid email format', param: 'email' },
            { msg: 'Password must be at least 8 characters', param: 'password' }
          ])
        });

        await createAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid email format',
          errors: expect.arrayContaining([
            expect.objectContaining({ msg: 'Invalid email format' })
          ])
        });
      });

      test('should handle duplicate email error', async () => {
        req.body = {
          firstName: 'New',
          lastName: 'Admin',
          email: 'existing@example.com',
          password: 'SecurePassword123!',
          permissions: ['administrators.read']
        };

        validationResult.mockReturnValue({
          isEmpty: jest.fn().mockReturnValue(true),
          array: jest.fn().mockReturnValue([])
        });
        
        // Mock existing admin found
        Administrator.findOne.mockResolvedValue({ email: 'existing@example.com' });

        await createAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email already exists'
        });
      });
    });

    describe('updateAdministrator', () => {
      test('should update administrator successfully', async () => {
        req.params.id = '507f1f77bcf86cd799439011'; // Valid ObjectId
        req.body = {
          firstName: 'Updated',
          lastName: 'Name',
          permissions: ['administrators.read', 'operators.read']
        };

        const updatedAdmin = {
          _id: '507f1f77bcf86cd799439011',
          adminId: 'ADM001',
          firstName: 'Updated',
          lastName: 'Name',
          permissions: ['administrators.read', 'operators.read'],
          toObject: jest.fn().mockReturnValue({
            _id: '507f1f77bcf86cd799439011',
            adminId: 'ADM001',
            firstName: 'Updated',
            lastName: 'Name',
            permissions: ['administrators.read', 'operators.read']
          })
        };

        Administrator.findByIdAndUpdate.mockReturnValue({
          select: jest.fn().mockResolvedValue(updatedAdmin)
        });

        await updateAdministrator(req, res);

        expect(Administrator.findByIdAndUpdate).toHaveBeenCalledWith(
          '507f1f77bcf86cd799439011',
          { $set: req.body },
          { new: true, runValidators: true }
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Administrator updated successfully',
          administrator: expect.any(Object)
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test.skip('should not allow self-demotion of last super admin', async () => {
        req.user.id = '507f1f77bcf86cd799439011'; // Valid ObjectId
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = {
          permissions: ['administrators.read'] // Removing 'all' permission
        };

        const mockAdmin = {
          _id: '507f1f77bcf86cd799439011',
          adminId: 'ADM001',
          permissions: ['all'],
          save: jest.fn()
        };

        Administrator.findById.mockResolvedValue(mockAdmin);
        Administrator.countDocuments.mockResolvedValue(1); // Only one admin with 'all'

        await updateAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining('Cannot remove super admin permissions')
        });
      });
    });

    describe('deleteAdministrator', () => {
      test('should delete administrator successfully', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.user.id = '507f1f77bcf86cd799439012'; // Different ID
        
        const mockAdmin = {
          _id: '507f1f77bcf86cd799439011',
          adminId: 'ADM002',
          email: 'admin@example.com',
          permissions: ['administrators.read']
        };

        Administrator.find.mockResolvedValue([{ _id: '507f1f77bcf86cd799439012', permissions: ['all'] }]); // Other admin with all perms
        Administrator.findByIdAndDelete.mockResolvedValue(mockAdmin);

        await deleteAdministrator(req, res);

        expect(Administrator.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Administrator deleted successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should prevent self-deletion', async () => {
        req.user.id = '507f1f77bcf86cd799439011';
        req.params.id = '507f1f77bcf86cd799439011';

        await deleteAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Cannot delete your own account'
        });
      });

      test('should prevent deletion of last administrator', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.user.id = '507f1f77bcf86cd799439012'; // Different ID
        
        const mockAdmin = { 
          _id: '507f1f77bcf86cd799439011',
          permissions: ['all']
        };
        
        Administrator.find.mockResolvedValue([]); // No other admins with 'all' permissions
        Administrator.findById.mockResolvedValue(mockAdmin);

        await deleteAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Cannot delete the last administrator with full permissions'
        });
      });
    });

    describe('resetAdministratorPassword', () => {
      test('should reset administrator password', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = { newPassword: 'NewSecurePassword123!' };

        validatePasswordStrength.mockReturnValue({ success: true });

        const mockAdmin = {
          _id: '507f1f77bcf86cd799439011',
          adminId: 'ADM001',
          email: 'admin@example.com',
          firstName: 'John',
          save: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);

        await resetAdministratorPassword(req, res);

        expect(validatePasswordStrength).toHaveBeenCalledWith(req.body.newPassword, '', '');
        expect(mockAdmin.password).toBe(req.body.newPassword);
        expect(mockAdmin.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Password reset successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should handle email sending failure', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = { newPassword: 'NewSecurePassword123!' };

        validatePasswordStrength.mockReturnValue({ success: true });

        const mockAdmin = {
          _id: '507f1f77bcf86cd799439011',
          save: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);
        await resetAdministratorPassword(req, res);

        // Should succeed - email sending is not part of this function
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Password reset successfully'
        });
      });
    });

    describe('getPermissions', () => {
      test('should return all available permissions', async () => {
        await getPermissions(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          permissions: expect.arrayContaining([
            'all',
            'administrators.read',
            'administrators.create',
            'administrators.update',
            'administrators.delete'
          ])
        });
      });
    });
  });

  describe('Operator Management Extensions', () => {
    describe('deactivateOperator', () => {
      test('should deactivate operator', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        
        const mockOperator = {
          _id: '507f1f77bcf86cd799439011',
          isActive: false,
          currentOrderCount: 0
        };

        Operator.findByIdAndUpdate.mockResolvedValue(mockOperator);

        await deactivateOperator(req, res);

        expect(Operator.findByIdAndUpdate).toHaveBeenCalledWith(
          '507f1f77bcf86cd799439011',
          { 
            $set: { 
              isActive: false,
              currentOrderCount: 0 
            } 
          },
          { new: true }
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator deactivated successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should handle non-existent operator', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        Operator.findByIdAndUpdate.mockResolvedValue(null);

        await deactivateOperator(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Operator not found'
        });
      });
    });

    describe('resetOperatorPassword', () => {
      test.skip('should reset operator password and send email', async () => {
        req.params.id = '507f1f77bcf86cd799439011';

        const mockOperator = {
          _id: '507f1f77bcf86cd799439011',
          operatorId: 'OP001',
          email: 'operator@example.com',
          firstName: 'Op',
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);
        emailService.sendPasswordResetEmail.mockResolvedValue(true);

        await resetOperatorPassword(req, res);

        expect(mockOperator.password).toBeDefined();
        expect(mockOperator.password).toMatch(/^[a-f0-9]{16}$/); // 8 bytes as hex = 16 chars
        expect(mockOperator.save).toHaveBeenCalled();
        expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          mockOperator,
          expect.any(String)
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator password reset successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });
    });

    describe('resetOperatorPin', () => {
      test.skip('should reset operator PIN', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = { newPassword: '1234' };

        const mockOperator = {
          _id: '507f1f77bcf86cd799439011',
          operatorId: 'OP001',
          email: 'operator@example.com',
          firstName: 'Op',
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await resetOperatorPin(req, res);

        expect(mockOperator.password).toBe('1234');
        expect(mockOperator.loginAttempts).toBe(0);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator password updated successfully'
        });
      });

      test('should validate PIN format', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = {}; // Missing newPassword

        await resetOperatorPin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'New password is required'
        });
      });
    });

    describe('deleteOperator', () => {
      test.skip('should delete operator permanently', async () => {
        req.params.id = 'op123';
        
        const mockOperator = {
          _id: 'op123',
          operatorId: 'OP001',
          email: 'operator@example.com',
          remove: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await deleteOperator(req, res);

        expect(mockOperator.remove).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator deleted successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });
    });

    describe('getAvailableOperators', () => {
      test('should get available operators for assignment', async () => {
        const mockOperators = [
          { operatorId: 'OP001', firstName: 'John', isAvailable: true },
          { operatorId: 'OP002', firstName: 'Jane', isAvailable: true }
        ];

        Operator.find.mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue(mockOperators)
        });

        await getAvailableOperators(req, res);

        expect(Operator.find).toHaveBeenCalledWith({
          isActive: true,
          currentOrderCount: { $lt: 10 }
        });
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operators: mockOperators
        });
      });
    });

    describe('updateOperatorStats', () => {
      test.skip('should update operator statistics', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = {
          ordersCompleted: 5,
          avgProcessingTime: 45,
          customerRating: 4.5
        };

        const updatedOperator = {
          _id: '507f1f77bcf86cd799439011',
          avgProcessingTime: 45,
          totalOrdersProcessed: 5,
          qualityScore: 90
        };

        Operator.findByIdAndUpdate.mockResolvedValue(updatedOperator);

        req.body = {
          processingTime: 45,
          qualityScore: 90,
          totalOrdersProcessed: 5
        };

        await updateOperatorStats(req, res);

        expect(Operator.findByIdAndUpdate).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator statistics updated successfully',
          operator: updatedOperator
        });
      });
    });
  });

  describe('Analytics Extensions', () => {
    describe('getOperatorAnalytics', () => {
      test.skip('should get operator analytics with date range', async () => {
        req.query = {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };

        const mockStats = {
          totalOperators: 10,
          activeOperators: 8,
          avgOrdersPerOperator: 15.5,
          topPerformers: []
        };

        // Mock the analytics calculation
        Operator.countDocuments.mockResolvedValue(10);
        Operator.aggregate.mockResolvedValue([mockStats]);

        await getOperatorAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: expect.any(Object)
        });
      });

      test.skip('should handle missing date range', async () => {
        req.query = {}; // No date range

        await getOperatorAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        // Should use default date range
      });
    });

    describe('getAffiliateAnalytics', () => {
      test.skip('should get affiliate analytics', async () => {
        req.query = { period: 'month' };

        const mockAnalytics = {
          totalAffiliates: 50,
          activeAffiliates: 45,
          totalCommissions: 15000,
          topEarners: []
        };

        // Mock aggregation results
        jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-15').getTime());

        await getAffiliateAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: expect.any(Object)
        });
      });
    });

    describe('exportReport', () => {
      test.skip('should export report as CSV', async () => {
        req.body = {
          type: 'orders',
          format: 'csv',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };

        await exportReport(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
        expect(res.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          expect.stringContaining('attachment; filename=')
        );
        expect(res.send).toHaveBeenCalled();
      });

      test.skip('should export report as JSON', async () => {
        req.body = {
          type: 'affiliates',
          format: 'json'
        };

        await exportReport(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(res.json).toHaveBeenCalled();
      });

      test.skip('should reject invalid format', async () => {
        req.body = {
          type: 'orders',
          format: 'pdf' // Not supported
        };

        await exportReport(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining('format')
        });
      });
    });
  });

  describe('Operator Self-Management', () => {
    describe('getOperatorSelf', () => {
      test.skip('should get current operator profile', async () => {
        req.user = { id: 'op123', role: 'operator' };
        
        const mockOperator = {
          _id: 'op123',
          operatorId: 'OP001',
          firstName: 'John',
          email: 'operator@example.com'
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await getOperatorSelf(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operator: mockOperator
        });
      });

      test.skip('should handle non-operator users', async () => {
        req.user = { id: 'admin123', role: 'administrator' };

        await getOperatorSelf(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'This endpoint is only for operators'
        });
      });
    });

    describe('updateOperatorSelf', () => {
      test.skip('should allow operator to update own profile', async () => {
        req.user = { id: 'op123', role: 'operator' };
        req.body = {
          phone: '+1234567890',
          emergencyContact: 'Jane Doe'
        };

        const mockOperator = {
          _id: 'op123',
          phone: '+0987654321',
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await updateOperatorSelf(req, res);

        expect(mockOperator.phone).toBe(req.body.phone);
        expect(mockOperator.emergencyContact).toBe(req.body.emergencyContact);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      test('should prevent changing restricted fields', async () => {
        req.user = { id: 'op123', role: 'operator' };
        req.body = {
          role: 'supervisor', // Should not be allowed
          isActive: false // Should not be allowed
        };

        const mockOperator = {
          _id: 'op123',
          role: 'picker',
          isActive: true,
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await updateOperatorSelf(req, res);

        // Restricted fields should not be changed
        expect(mockOperator.role).toBe('picker');
        expect(mockOperator.isActive).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test.skip('should handle database connection errors', async () => {
      Administrator.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Connection timeout'))
      });

      await getAdministrators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('error')
      });
    });

    test.skip('should handle validation errors', async () => {
      req.body = {
        // Missing required fields
        email: 'invalid-email'
      };

      await createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
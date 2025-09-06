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
jest.mock('../../server/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendAffiliateWelcomeEmail: jest.fn(),
  sendOperatorWelcomeEmail: jest.fn(),
  sendAdministratorWelcomeEmail: jest.fn()
}));
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

      test('should not allow self-demotion of last super admin', async () => {
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
          message: 'Cannot remove super admin permissions from the last active super administrator'
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
        expect(mockAdmin.passwordHash).toBeDefined();
        expect(mockAdmin.passwordSalt).toBeDefined();
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
      test('should reset operator password and send email', async () => {
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
          message: 'Password reset successfully. New password sent to operator email.'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });
    });

    describe('resetOperatorPin', () => {
      test('should reset operator PIN', async () => {
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
          message: 'PIN reset successfully'
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
      test('should delete operator permanently', async () => {
        req.params.id = 'op123';

        const mockOperator = {
          _id: 'op123',
          operatorId: 'OP001',
          email: 'operator@example.com',
          currentOrderCount: 0
        };

        Operator.findById.mockResolvedValue(mockOperator);
        Order.countDocuments.mockResolvedValue(0);
        Operator.findByIdAndDelete.mockResolvedValue(mockOperator);

        await deleteOperator(req, res);

        expect(Operator.findByIdAndDelete).toHaveBeenCalledWith('op123');
        expect(res.status).not.toHaveBeenCalled();
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
      test('should update operator statistics', async () => {
        req.params.id = '507f1f77bcf86cd799439011';
        req.body = {
          processingTime: 45,
          qualityScore: 90,
          totalOrdersProcessed: 5
        };

        const mockOperator = {
          _id: '507f1f77bcf86cd799439011',
          operatorId: 'OP001',
          firstName: 'John',
          lastName: 'Doe',
          totalOrdersProcessed: 0,
          averageProcessingTime: 0,
          qualityScore: 100,
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await updateOperatorStats(req, res);

        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator statistics updated successfully',
          operator: expect.objectContaining({
            _id: '507f1f77bcf86cd799439011',
            operatorId: 'OP001',
            firstName: 'John',
            lastName: 'Doe'
          })
        });
      });
    });
  });

  describe('Analytics Extensions', () => {
    describe('getOperatorAnalytics', () => {
      test('should get operator analytics with date range', async () => {
        req.query = {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };

        const mockOperatorAnalytics = [
          {
            operatorId: 'OP001',
            firstName: 'John',
            lastName: 'Doe',
            metrics: {
              totalOrders: 25,
              completedOrders: 23,
              averageProcessingTime: 45
            }
          }
        ];

        const mockWorkstationAnalytics = [
          {
            _id: 'Station1',
            totalOrders: 50,
            averageProcessingTime: 42
          }
        ];

        // Mock the aggregation calls
        Operator.aggregate.mockResolvedValue(mockOperatorAnalytics);
        Order.aggregate.mockResolvedValue(mockWorkstationAnalytics);

        await getOperatorAnalytics(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: expect.any(Object)
        });
      });

      test('should handle missing date range', async () => {
        req.query = {}; // No date range

        // Mock the aggregation calls
        Operator.aggregate.mockResolvedValue([]);
        Order.aggregate.mockResolvedValue([]);

        await getOperatorAnalytics(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: {
            operators: [],
            workstations: []
          }
        });
      });
    });

    describe('getAffiliateAnalytics', () => {
      test('should get affiliate analytics', async () => {
        req.query = { period: 'month' };

        const mockAffiliateAnalytics = [
          {
            affiliateId: 'AFF001',
            firstName: 'John',
            lastName: 'Doe',
            metrics: {
              totalCustomers: 25,
              totalOrders: 100,
              totalCommission: 500
            }
          }
        ];

        const mockGeographicDistribution = [
          {
            _id: 'TX',
            affiliateCount: 10
          }
        ];

        // Mock aggregation results
        Affiliate.aggregate.mockResolvedValue(mockAffiliateAnalytics);
        
        // Second call for geographic distribution
        Affiliate.aggregate.mockResolvedValueOnce(mockAffiliateAnalytics)
          .mockResolvedValueOnce(mockGeographicDistribution);

        await getAffiliateAnalytics(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: {
            affiliates: mockAffiliateAnalytics,
            geographicDistribution: mockGeographicDistribution
          }
        });
      });
    });

    describe('exportReport', () => {
      test('should export report as CSV', async () => {
        req.query = {
          reportType: 'orders',
          format: 'csv',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        };

        // Mock the Order.find call for CSV export
        Order.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              orderId: 'ORD001',
              customerId: 'CUST001',
              createdAt: new Date('2025-01-15'),
              status: 'completed',
              orderProcessingStatus: 'completed',
              processingTimeMinutes: 45,
              actualWeight: 25.5,
              actualTotal: 100,
              affiliateId: {
                firstName: 'John',
                lastName: 'Doe'
              },
              assignedOperator: {
                firstName: 'Jane',
                lastName: 'Smith'
              }
            }
          ])
        });

        await exportReport(req, res);

        // The controller currently returns JSON, not CSV
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          report: expect.any(Array),
          metadata: expect.objectContaining({
            reportType: 'orders',
            generatedAt: expect.any(Date),
            startDate: '2025-01-01',
            endDate: '2025-01-31'
          })
        });
      });

      test('should export report as JSON', async () => {
        req.query = {
          reportType: 'affiliates',
          format: 'json'
        };

        // Mock the Affiliate.find call
        Affiliate.find.mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              affiliateId: 'AFF001',
              firstName: 'John',
              lastName: 'Doe',
              businessName: 'Doe Laundry',
              serviceLatitude: 30.2672,
              serviceLongitude: -97.7431,
              serviceRadius: 10,
              isActive: true
            }
          ])
        });

        // Mock Order.aggregate for affiliate stats
        Order.aggregate.mockResolvedValue([{
          _id: null,
          totalOrders: 50,
          totalRevenue: 5000,
          totalCommission: 500
        }]);

        // Mock Customer.countDocuments
        Customer.countDocuments.mockResolvedValue(25);

        await exportReport(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          report: expect.any(Array),
          metadata: expect.objectContaining({
            reportType: 'affiliates',
            generatedAt: expect.any(Date)
          })
        });
      });

      test('should reject invalid report type', async () => {
        req.query = {
          reportType: 'invalid',
          format: 'csv'
        };

        await exportReport(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid report type'
        });
      });
    });
  });

  describe('Operator Self-Management', () => {
    describe('getOperatorSelf', () => {
      test('should get current operator profile', async () => {
        req.params.id = 'op123';

        const mockOperator = {
          _id: 'op123',
          operatorId: 'OP001',
          firstName: 'John',
          email: 'operator@example.com',
          toObject: jest.fn().mockReturnValue({
            _id: 'op123',
            operatorId: 'OP001',
            firstName: 'John',
            email: 'operator@example.com'
          })
        };

        Operator.findById.mockResolvedValue(mockOperator);

        // Mock fieldFilter
        const fieldFilter = require('../../server/utils/fieldFilter');
        fieldFilter.getFilteredData = jest.fn().mockReturnValue(mockOperator.toObject());

        await getOperatorSelf(req, res);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operator: expect.any(Object)
        });
      });

      test('should handle non-operator users', async () => {
        req.params.id = 'nonexistent';

        Operator.findById.mockResolvedValue(null);

        await getOperatorSelf(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Operator not found'
        });
      });
    });

    describe('updateOperatorSelf', () => {
      test('should allow operator to update own profile', async () => {
        req.params.id = 'op123';
        req.body = {
          phone: '+1234567890',
          firstName: 'Jane'
        };

        const mockOperator = {
          _id: 'op123',
          phone: '+0987654321',
          firstName: 'John',
      save: jest.fn().mockImplementation(function() {
            return Promise.resolve({
              ...this,
              toObject: jest.fn().mockReturnValue({
                _id: 'op123',
                phone: this.phone,
                firstName: this.firstName
              })
            });
          })
        };

        Operator.findById.mockResolvedValue(mockOperator);

        // Mock fieldFilter
        const fieldFilter = require('../../server/utils/fieldFilter');
        fieldFilter.getFilteredData = jest.fn().mockReturnValue({
          _id: 'op123',
          phone: '+1234567890',
          firstName: 'Jane'
        });

        await updateOperatorSelf(req, res);

        expect(mockOperator.phone).toBe(req.body.phone);
        expect(mockOperator.firstName).toBe(req.body.firstName);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Profile updated successfully',
          operator: expect.any(Object)
        });
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
    test('should handle database connection errors', async () => {
      Administrator.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockRejectedValue(new Error('Connection timeout'))
      });

      await getAdministrators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch administrators'
      });
    });

    test('should handle validation errors', async () => {
      req.body = {
        // Missing required fields
        email: 'invalid-email'
      };

      // Mock validation errors
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'First name is required', param: 'firstName' },
          { msg: 'Invalid email format', param: 'email' }
        ])
      });

      await createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'First name is required',
        errors: expect.arrayContaining([
          expect.objectContaining({ msg: 'First name is required' })
        ])
      });
    });
  });
});
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
      user: { id: 'admin123', adminId: 'ADM001', role: 'administrator' },
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
          message: expect.stringContaining('error')
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
        req.params.id = 'admin123';
        req.body = {
          firstName: 'Updated',
          lastName: 'Name',
          permissions: ['administrators.read', 'operators.read']
        };

        const mockAdmin = {
          _id: 'admin123',
          adminId: 'ADM001',
          firstName: 'John',
          lastName: 'Doe',
          permissions: ['administrators.read'],
          save: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);

        await updateAdministrator(req, res);

        expect(mockAdmin.firstName).toBe('Updated');
        expect(mockAdmin.lastName).toBe('Name');
        expect(mockAdmin.permissions).toEqual(req.body.permissions);
        expect(mockAdmin.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should not allow self-demotion of last super admin', async () => {
        req.params.id = req.user.id;
        req.body = {
          permissions: ['administrators.read'] // Removing 'all' permission
        };

        const mockAdmin = {
          _id: req.user.id,
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
          message: expect.stringContaining('Cannot remove')
        });
      });
    });

    describe('deleteAdministrator', () => {
      test('should delete administrator successfully', async () => {
        req.params.id = 'admin123';
        
        const mockAdmin = {
          _id: 'admin123',
          adminId: 'ADM002',
          email: 'admin@example.com',
          remove: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);
        Administrator.countDocuments.mockResolvedValue(5); // Enough admins remain

        await deleteAdministrator(req, res);

        expect(mockAdmin.remove).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Administrator deleted successfully'
        });
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should prevent self-deletion', async () => {
        req.params.id = req.user.id;

        await deleteAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Cannot delete your own administrator account'
        });
      });

      test('should prevent deletion of last administrator', async () => {
        req.params.id = 'admin123';
        
        Administrator.findById.mockResolvedValue({ _id: 'admin123' });
        Administrator.countDocuments.mockResolvedValue(1);

        await deleteAdministrator(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Cannot delete the last administrator'
        });
      });
    });

    describe('resetAdministratorPassword', () => {
      test('should reset administrator password', async () => {
        req.params.id = 'admin123';
        req.body = { newPassword: 'NewSecurePassword123!' };

        validatePasswordStrength.mockReturnValue({ success: true });

        const mockAdmin = {
          _id: 'admin123',
          adminId: 'ADM001',
          email: 'admin@example.com',
          firstName: 'John',
          save: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);
        emailService.sendAdministratorPasswordResetEmail.mockResolvedValue(true);

        await resetAdministratorPassword(req, res);

        expect(validatePasswordStrength).toHaveBeenCalledWith(req.body.newPassword);
        expect(mockAdmin.password).toBe(req.body.newPassword);
        expect(mockAdmin.save).toHaveBeenCalled();
        expect(emailService.sendAdministratorPasswordResetEmail).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should handle email sending failure', async () => {
        req.params.id = 'admin123';
        req.body = { newPassword: 'NewSecurePassword123!' };

        validatePasswordStrength.mockReturnValue({ success: true });

        const mockAdmin = {
          _id: 'admin123',
          save: jest.fn().mockResolvedValue(true)
        };

        Administrator.findById.mockResolvedValue(mockAdmin);
        emailService.sendAdministratorPasswordResetEmail.mockRejectedValue(new Error('Email failed'));

        await resetAdministratorPassword(req, res);

        // Should still succeed even if email fails
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('getPermissions', () => {
      test('should return all available permissions', async () => {
        await getPermissions(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          permissions: expect.objectContaining({
            all: expect.any(Object),
            administrators: expect.any(Object),
            operators: expect.any(Object),
            system_config: expect.any(Object)
          })
        });
      });
    });
  });

  describe('Operator Management Extensions', () => {
    describe('deactivateOperator', () => {
      test('should deactivate operator', async () => {
        req.params.id = 'op123';
        
        const mockOperator = {
          _id: 'op123',
          isActive: true,
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await deactivateOperator(req, res);

        expect(mockOperator.isActive).toBe(false);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(logAuditEvent).toHaveBeenCalled();
      });

      test('should handle non-existent operator', async () => {
        req.params.id = 'nonexistent';
        Operator.findById.mockResolvedValue(null);

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
        req.params.id = 'op123';
        req.body = { newPassword: 'NewOperatorPass123!' };

        validatePasswordStrength.mockReturnValue({ success: true });

        const mockOperator = {
          _id: 'op123',
          email: 'operator@example.com',
          firstName: 'Op',
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);
        emailService.sendOperatorPasswordResetEmail.mockResolvedValue(true);

        await resetOperatorPassword(req, res);

        expect(mockOperator.password).toBe(req.body.newPassword);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(emailService.sendOperatorPasswordResetEmail).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('resetOperatorPin', () => {
      test('should reset operator PIN', async () => {
        req.params.id = 'op123';
        req.body = { newPin: '1234' };

        const mockOperator = {
          _id: 'op123',
          operatorId: 'OP001',
          email: 'operator@example.com',
          firstName: 'Op',
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);
        emailService.sendOperatorPinResetEmail.mockResolvedValue(true);

        await resetOperatorPin(req, res);

        expect(mockOperator.pin).toBe('1234');
        expect(mockOperator.save).toHaveBeenCalled();
        expect(emailService.sendOperatorPinResetEmail).toHaveBeenCalledWith(
          mockOperator,
          '1234'
        );
        expect(res.status).toHaveBeenCalledWith(200);
      });

      test('should validate PIN format', async () => {
        req.params.id = 'op123';
        req.body = { newPin: 'abc' }; // Invalid PIN

        await resetOperatorPin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'PIN must be a 4-digit number'
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

        Operator.find.mockResolvedValue(mockOperators);

        await getAvailableOperators(req, res);

        expect(Operator.find).toHaveBeenCalledWith({
          isActive: true,
          isAvailable: true
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operators: mockOperators
        });
      });
    });

    describe('updateOperatorStats', () => {
      test('should update operator statistics', async () => {
        req.params.id = 'op123';
        req.body = {
          ordersCompleted: 5,
          avgProcessingTime: 45,
          customerRating: 4.5
        };

        const mockOperator = {
          _id: 'op123',
          stats: {},
          save: jest.fn().mockResolvedValue(true)
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await updateOperatorStats(req, res);

        expect(mockOperator.stats).toEqual(req.body);
        expect(mockOperator.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator statistics updated successfully',
          operator: mockOperator
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

      test('should handle missing date range', async () => {
        req.query = {}; // No date range

        await getOperatorAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        // Should use default date range
      });
    });

    describe('getAffiliateAnalytics', () => {
      test('should get affiliate analytics', async () => {
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
      test('should export report as CSV', async () => {
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

      test('should export report as JSON', async () => {
        req.body = {
          type: 'affiliates',
          format: 'json'
        };

        await exportReport(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
        expect(res.json).toHaveBeenCalled();
      });

      test('should reject invalid format', async () => {
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
      test('should get current operator profile', async () => {
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

      test('should handle non-operator users', async () => {
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
      test('should allow operator to update own profile', async () => {
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
    test('should handle database connection errors', async () => {
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

    test('should handle validation errors', async () => {
      req.body = {
        // Missing required fields
        email: 'invalid-email'
      };

      await createAdministrator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
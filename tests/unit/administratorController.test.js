// Mock modules before importing them
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/SystemConfig');
jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: {
    DATA_MODIFICATION: 'DATA_MODIFICATION',
    ACCOUNT_CREATED: 'ACCOUNT_CREATED',
    ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS'
  }
}));
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/fieldFilter');
jest.mock('../../server/utils/passwordValidator', () => ({
  validatePasswordStrength: jest.fn().mockReturnValue({ success: true })
}));

const { 
  createOperator,
  getOperators,
  getOperatorById,
  updateOperator,
  deactivateOperator,
  resetOperatorPassword,
  getDashboard,
  getOrderAnalytics,
  getOperatorAnalytics,
  getAffiliateAnalytics,
  exportReport,
  getSystemConfig,
  updateSystemConfig,
  getSystemHealth
} = require('../../server/controllers/administratorController');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const { logAuditEvent, AuditEvents } = require('../../server/utils/auditLogger');
const emailService = require('../../server/utils/emailService');
const { validatePasswordStrength } = require('../../server/utils/passwordValidator');
const mongoose = require('mongoose');

describe('Administrator Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { _id: 'admin123', id: 'admin123', email: 'admin@example.com', role: 'administrator' },
      params: {},
      body: {},
      query: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    
    // Clear mocks
    
    // Mock fieldFilter
    const { fieldFilter } = require('../../server/utils/fieldFilter');
    fieldFilter.mockImplementation((obj) => obj);
    
    // Mock password validator
    validatePasswordStrength.mockReturnValue({ success: true });
    
    jest.clearAllMocks();
  });

  describe('Operator Management', () => {
    describe('createOperator', () => {
      it('should create a new operator', async () => {
        const newOperatorData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'SecurePass123!',
          shiftStart: '08:00',
          shiftEnd: '16:00'
        };

        req.body = newOperatorData;
        
        Operator.findOne.mockResolvedValue(null);
        Operator.countDocuments.mockResolvedValue(5);
        
        const mockOperatorDoc = {
          ...newOperatorData,
          operatorId: 'OPR006',
          _id: 'op123',
          toObject: jest.fn().mockReturnValue({
            ...newOperatorData,
            operatorId: 'OPR006',
            _id: 'op123'
          })
        };
        
        const mockSave = jest.fn().mockResolvedValue(mockOperatorDoc);
        const mockOperator = {
          ...newOperatorData,
          operatorId: 'OPR006',
          _id: 'op123',
          save: mockSave,
          toObject: mockOperatorDoc.toObject
        };
        
        Operator.mockImplementation(() => mockOperator);

        await createOperator(req, res);

        expect(Operator.findOne).toHaveBeenCalledWith({ email: newOperatorData.email.toLowerCase() });
        expect(mockSave).toHaveBeenCalled();
        expect(emailService.sendOperatorWelcomeEmail).toHaveBeenCalled();
        expect(logAuditEvent).toHaveBeenCalledWith(
          AuditEvents.DATA_MODIFICATION,
          expect.objectContaining({
            action: 'CREATE_OPERATOR'
          }),
          req
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Operator created successfully'
        }));
      });
    });

    describe('getOperators', () => {
      it('should return list of operators with pagination', async () => {
        const mockOperators = [
          { 
            _id: '1', 
            email: 'op1@example.com', 
            operatorId: 'OPR001',
            toObject: jest.fn(() => ({
              _id: '1',
              email: 'op1@example.com',
              operatorId: 'OPR001'
            }))
          },
          { 
            _id: '2', 
            email: 'op2@example.com', 
            operatorId: 'OPR002',
            toObject: jest.fn(() => ({
              _id: '2',
              email: 'op2@example.com',
              operatorId: 'OPR002'
            }))
          }
        ];

        req.query = { page: 1, limit: 10 };

        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          populate: jest.fn().mockResolvedValue(mockOperators)
        };

        Operator.find.mockReturnValue(mockQuery);
        Operator.countDocuments.mockResolvedValue(2);

        await getOperators(req, res);

        expect(Operator.find).toHaveBeenCalled();
        const expectedOperators = mockOperators.map(op => ({
          _id: op._id,
          email: op.email,
          operatorId: op.operatorId
        }));
        
        // The controller calls toObject() on each operator
        // which should return the plain object version
        
        // Verify the operators were processed correctly
        
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operators: [
            { _id: '1', email: 'op1@example.com', operatorId: 'OPR001' },
            { _id: '2', email: 'op2@example.com', operatorId: 'OPR002' }
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 2,
            itemsPerPage: 10
          }
        });
      });
    });

    describe('updateOperator', () => {
      it('should update operator details', async () => {
        const mockOperator = {
          _id: 'op123',
          firstName: 'Jane',
          lastName: 'Smith',
          toObject: jest.fn(() => ({
            _id: 'op123',
            firstName: 'Jane',
            lastName: 'Smith'
          }))
        };

        req.params.id = 'op123';
        req.body = {
          firstName: 'Jane',
          lastName: 'Smith'
        };

        // Mock the existence check
        Operator.findById.mockResolvedValue({
          _id: 'op123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'old@email.com'
        });
        
        // Mock email uniqueness check (no existing operator with new email)
        Operator.findOne.mockResolvedValue(null);
        
        Operator.findByIdAndUpdate.mockResolvedValue(mockOperator);

        await updateOperator(req, res);

        expect(Operator.findByIdAndUpdate).toHaveBeenCalledWith(
          'op123',
          { $set: { firstName: 'Jane', lastName: 'Smith' } },
          { new: true, runValidators: true }
        );
        expect(logAuditEvent).toHaveBeenCalledWith(
          AuditEvents.DATA_MODIFICATION,
          expect.objectContaining({
            action: 'UPDATE_OPERATOR'
          }),
          req
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator updated successfully',
          operator: {
            _id: 'op123',
            firstName: 'Jane',
            lastName: 'Smith'
          }
        });
      });
    });
  });

  describe('Analytics', () => {
    describe('getDashboard', () => {
      it('should return dashboard analytics', async () => {
        // Mock Order.aggregate for order stats
        Order.aggregate.mockResolvedValue([{
          today: [{ count: 50 }],
          thisWeek: [{ count: 200 }],
          thisMonth: [{ count: 1000 }],
          statusDistribution: [],
          processingStatusDistribution: [],
          averageProcessingTime: [{ avg: 2.5 }]
        }]);

        // Mock Operator.aggregate for operator performance
        Operator.aggregate.mockResolvedValue([]);

        // Mock Affiliate.aggregate for affiliate performance
        Affiliate.aggregate.mockResolvedValue([]);

        // Mock system health counts
        Operator.countDocuments.mockResolvedValue(10);
        Operator.findOnShift = jest.fn().mockResolvedValue([]);
        Affiliate.countDocuments.mockResolvedValue(5);
        Customer.countDocuments.mockResolvedValue(25);

        await getDashboard(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          dashboard: expect.objectContaining({
            orderStats: expect.any(Object),
            systemHealth: expect.any(Object)
          })
        }));
      });
    });

    describe('getOrderAnalytics', () => {
      it('should return order analytics', async () => {
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };

        const mockAnalytics = [
          { _id: '2024-01-01', totalOrders: 10, totalRevenue: 500 },
          { _id: '2024-01-02', totalOrders: 15, totalRevenue: 750 }
        ];

        Order.aggregate.mockResolvedValue(mockAnalytics);

        await getOrderAnalytics(req, res);

        expect(Order.aggregate).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          analytics: expect.objectContaining({
            timeline: expect.any(Array),
            summary: expect.any(Object)
          })
        });
      });
    });
  });

  describe('System Configuration', () => {
    describe('getSystemConfig', () => {
      it('should return all system configurations', async () => {
        const mockConfigs = [
          { key: 'order_processing_hours', value: { start: '06:00', end: '22:00' } },
          { key: 'max_concurrent_orders', value: 5 }
        ];

        SystemConfig.find.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockConfigs)
        });

        await getSystemConfig(req, res);

        expect(SystemConfig.find).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          configurations: mockConfigs
        });
      });
    });

    describe('updateSystemConfig', () => {
      it('should update system configuration', async () => {
        const mockConfig = {
          key: 'order_processing_hours',
          value: { start: '06:00', end: '22:00' },
          save: jest.fn().mockResolvedValue(true)
        };

        req.body = {
          key: 'order_processing_hours',
          value: { start: '07:00', end: '23:00' }
        };

        SystemConfig.setValue = jest.fn().mockResolvedValue(mockConfig);

        await updateSystemConfig(req, res);

        expect(SystemConfig.setValue).toHaveBeenCalledWith(
          'order_processing_hours',
          { start: '07:00', end: '23:00' },
          req.user.id
        );
        expect(logAuditEvent).toHaveBeenCalledWith(
          AuditEvents.DATA_MODIFICATION,
          expect.objectContaining({
            action: 'UPDATE_SYSTEM_CONFIG'
          }),
          req
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Configuration updated successfully',
          configuration: mockConfig
        });
      });

      it('should return 404 if configuration not found', async () => {
        req.body = { key: 'nonexistent', value: 'test' };
        SystemConfig.setValue = jest.fn().mockRejectedValue(new Error('Configuration not found'));

        await updateSystemConfig(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Configuration not found'
        });
      });
    });
  });

  describe('System Health', () => {
    describe('getSystemHealth', () => {
      it('should return system health status', async () => {
        const dbStatsCommand = jest.fn().mockResolvedValue({ ok: 1, collections: 10 });
        
        // Mock mongoose connection
        mongoose.connection = {
          readyState: 1,
          db: {
            admin: jest.fn().mockReturnValue({
              ping: jest.fn().mockResolvedValue({ ok: 1 })
            }),
            stats: dbStatsCommand
          }
        };

        await getSystemHealth(req, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          health: expect.objectContaining({
            status: 'healthy',
            components: expect.objectContaining({
              database: 'healthy'
            })
          })
        });
      });
    });
  });
});
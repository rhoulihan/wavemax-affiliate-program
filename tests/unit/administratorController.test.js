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
const { auditLogger } = require('../../server/utils/auditLogger');
const emailService = require('../../server/utils/emailService');

jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/SystemConfig');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/emailService');

describe('Administrator Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { _id: 'admin123', email: 'admin@example.com', role: 'administrator' },
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
        
        const mockSave = jest.fn().mockResolvedValue(true);
        const mockOperator = {
          ...newOperatorData,
          operatorId: 'OPR006',
          _id: 'op123',
          save: mockSave
        };
        
        Operator.mockImplementation(() => mockOperator);

        await createOperator(req, res);

        expect(Operator.findOne).toHaveBeenCalledWith({ email: newOperatorData.email });
        expect(mockSave).toHaveBeenCalled();
        expect(emailService.sendOperatorWelcomeEmail).toHaveBeenCalled();
        expect(auditLogger.log).toHaveBeenCalledWith('operator_created', expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          operatorId: 'OPR006'
        }));
      });
    });

    describe('getOperators', () => {
      it('should return list of operators with pagination', async () => {
        const mockOperators = [
          { _id: '1', email: 'op1@example.com', operatorId: 'OPR001' },
          { _id: '2', email: 'op2@example.com', operatorId: 'OPR002' }
        ];

        req.query = { page: 1, limit: 10 };

        const mockQuery = {
          select: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue(mockOperators)
        };

        Operator.find.mockReturnValue(mockQuery);
        Operator.countDocuments.mockResolvedValue(2);

        await getOperators(req, res);

        expect(Operator.find).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          operators: mockOperators,
          total: 2,
          page: 1,
          pages: 1
        });
      });
    });

    describe('updateOperator', () => {
      it('should update operator details', async () => {
        const mockOperator = {
          _id: 'op123',
          firstName: 'John',
          lastName: 'Doe',
          save: jest.fn().mockResolvedValue(true)
        };

        req.params.id = 'op123';
        req.body = {
          firstName: 'Jane',
          lastName: 'Smith'
        };

        Operator.findById.mockResolvedValue(mockOperator);

        await updateOperator(req, res);

        expect(mockOperator.firstName).toBe('Jane');
        expect(mockOperator.lastName).toBe('Smith');
        expect(mockOperator.save).toHaveBeenCalled();
        expect(auditLogger.log).toHaveBeenCalledWith('operator_updated', expect.any(Object));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Operator updated successfully'
        });
      });
    });
  });

  describe('Analytics', () => {
    describe('getDashboard', () => {
      it('should return dashboard analytics', async () => {
        const mockStats = {
          ordersToday: 50,
          activeOperators: 10,
          totalRevenue: 5000,
          newCustomers: 25
        };

        Order.countDocuments.mockResolvedValue(50);
        Operator.countDocuments.mockResolvedValue(10);
        Order.aggregate.mockResolvedValue([{ total: 5000 }]);
        Customer.countDocuments.mockResolvedValue(25);

        await getDashboard(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            ordersToday: expect.any(Number),
            activeOperators: expect.any(Number)
          })
        }));
      });
    });

    describe('getOrderAnalytics', () => {
      it('should return order analytics', async () => {
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };

        const mockAnalytics = [
          { _id: '2024-01-01', count: 10, revenue: 500 },
          { _id: '2024-01-02', count: 15, revenue: 750 }
        ];

        Order.aggregate.mockResolvedValue(mockAnalytics);

        await getOrderAnalytics(req, res);

        expect(Order.aggregate).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.any(Object)
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
          configs: mockConfigs
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

        req.params.key = 'order_processing_hours';
        req.body = {
          value: { start: '07:00', end: '23:00' }
        };

        SystemConfig.findOne.mockResolvedValue(mockConfig);

        await updateSystemConfig(req, res);

        expect(mockConfig.value).toEqual(req.body.value);
        expect(mockConfig.lastModifiedBy).toBe(req.user._id);
        expect(mockConfig.save).toHaveBeenCalled();
        expect(auditLogger.log).toHaveBeenCalledWith('system_config_updated', expect.any(Object));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          config: mockConfig
        });
      });

      it('should return 404 if configuration not found', async () => {
        req.params.key = 'nonexistent';
        req.body = { value: 'test' };
        SystemConfig.findOne.mockResolvedValue(null);

        await updateSystemConfig(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
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
            database: expect.objectContaining({
              connected: true
            })
          })
        });
      });
    });
  });
});
const operatorController = require('../../server/controllers/operatorController');

// Mock all dependencies
jest.mock('../../server/models/Order');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Operator');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/utils/logger');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/auditLogger');

// Mock SystemConfig
jest.mock('../../server/models/SystemConfig', () => ({
  getValue: jest.fn().mockResolvedValue(1.25),
  initializeDefaults: jest.fn().mockResolvedValue(true)
}));

const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const emailService = require('../../server/utils/emailService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Bag Tracking System', () => {
  describe('scanBag', () => {
    it('should parse new QR format correctly', async () => {
      // Mock data
      const mockCustomer = {
        customerId: 'CUST-12345',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St'
      };

      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        status: 'pending',
        customer: mockCustomer,
        populate: jest.fn().mockReturnThis()
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Order.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrder)
        })
      });

      const req = {
        body: {
          qrCode: 'CUST-12345#f47ac10b-58cc-4372-a567-0e02b2c3d479'
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.scanBag(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST-12345' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        order: expect.objectContaining({
          orderId: 'ORD-123456'
        }),
        customer: mockCustomer,
        bagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        action: 'show_order'
      });
    });

    it('should handle legacy QR format', async () => {
      const mockCustomer = {
        customerId: 'CUST-12345',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);

      const req = {
        body: {
          qrCode: 'CUST-12345'
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Mock scanCustomer since legacy format redirects there
      operatorController.scanCustomer = jest.fn();

      await operatorController.scanBag(req, res);

      expect(operatorController.scanCustomer).toHaveBeenCalled();
      expect(req.body.customerId).toBe('CUST-12345');
    });
  });

  describe('weighBags', () => {
    it('should add bags to order and update status', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        status: 'pending',
        numberOfBags: 2,
        bagsWeighed: 0,
        bags: [],
        save: jest.fn().mockResolvedValue(true)
      };

      // After save, update the mock to reflect changes
      mockOrder.save.mockImplementation(() => {
        mockOrder.status = 'processing';
        mockOrder.actualWeight = 10;
        mockOrder.bagsWeighed = 2;
        mockOrder.bags = [
          { bagId: 'bag-001', weight: 5.5, status: 'processing', bagNumber: 1 },
          { bagId: 'bag-002', weight: 4.5, status: 'processing', bagNumber: 2 }
        ];
        return Promise.resolve(mockOrder);
      });

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          orderId: 'ORD-123456',
          bags: [
            { bagId: 'bag-001', weight: 5.5 },
            { bagId: 'bag-002', weight: 4.5 }
          ]
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.weighBags(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        order: expect.objectContaining({
          orderId: 'ORD-123456',
          status: 'processing',
          actualWeight: 10,
          bags: expect.arrayContaining([
            expect.objectContaining({
              bagId: 'bag-001',
              weight: 5.5,
              status: 'processing',
              bagNumber: 1
            }),
            expect.objectContaining({
              bagId: 'bag-002',
              weight: 4.5,
              status: 'processing',
              bagNumber: 2
            })
          ])
        }),
        orderProgress: {
          totalBags: 2,
          bagsWeighed: 2,
          bagsProcessed: 0,
          bagsCompleted: 0
        },
        message: 'Bags weighed successfully'
      });
    });

    it('should prevent duplicate bag IDs', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        status: 'processing',
        numberOfBags: 2,
        bagsWeighed: 1,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processing'
        }],
        save: jest.fn()
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          orderId: 'ORD-123456',
          bags: [
            { bagId: 'bag-001', weight: 5.5 }
          ]
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.weighBags(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Duplicate bag',
        message: 'Bag bag-001 has already been added to this order'
      });
    });
  });

  describe('scanProcessed', () => {
    it('should update bag status to processed', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processing',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 0,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processing',
          scannedAt: {},
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processing',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn()
      };

      // Mock save to update the order state
      mockOrder.save.mockImplementation(() => {
        mockOrder.bagsProcessed = 1;
        mockOrder.bags[0].status = 'processed';
        return Promise.resolve(mockOrder);
      });

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          qrCode: 'CUST-12345#bag-001'
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.scanProcessed(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        order: expect.any(Object),
        bag: expect.objectContaining({
          bagId: 'bag-001',
          bagNumber: 1,
          status: 'processed',
          weight: 5
        }),
        orderProgress: {
          totalBags: 2,
          bagsWeighed: 2,
          bagsProcessed: 1,
          bagsCompleted: 0
        },
        message: 'Bag 1 marked as processed'
      });
    });

    it('should show warning for already processed bag', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processing',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 1,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processed',
          scannedAt: {
            processed: new Date()
          },
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processing',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn()
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          qrCode: 'CUST-12345#bag-001'
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.scanProcessed(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        warning: 'duplicate_scan',
        message: 'This bag has already been processed. 1 bags still need processing.',
        bag: expect.objectContaining({
          bagId: 'bag-001',
          bagNumber: 1,
          status: 'processed'
        }),
        remainingCount: 1
      });
    });

    it('should trigger completion actions when all bags processed', async () => {
      const emailService = require('../../server/utils/emailService');
      emailService.sendOrderStatusUpdateEmail = jest.fn();
      emailService.sendAffiliateCommissionEmail = jest.fn();

      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processing',
        affiliateCommission: 5.5,
        actualTotal: 15.5,
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 1,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processing',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn(),
        populate: jest.fn().mockReturnThis()
      };

      // Mock save to update the order state
      mockOrder.save.mockImplementation(() => {
        mockOrder.status = 'processed';
        mockOrder.bagsProcessed = 2;
        mockOrder.bags[1].status = 'processed';
        return Promise.resolve(mockOrder);
      });

      const mockCustomer = {
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        username: 'johndoe',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      };

      mockOrder.customer = mockCustomer;
      mockOrder.affiliate = { affiliateId: 'AFF-123', businessName: 'Test Business' };

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const req = {
        body: {
          qrCode: 'CUST-12345#bag-002'
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.scanProcessed(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        action: 'show_pickup_modal',
        order: expect.objectContaining({
          status: 'processed'
        }),
        allBagsProcessed: true,
        message: 'All bags processed - ready for pickup'
      });

      expect(emailService.sendOrderStatusUpdateEmail).toHaveBeenCalled();
    });
  });

  describe('completePickup', () => {
    it('should complete order when all bags scanned', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processed',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 2,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn(),
        populate: jest.fn().mockReturnThis()
      };

      // Mock save to update the order state
      mockOrder.save.mockImplementation(() => {
        mockOrder.status = 'complete';
        mockOrder.bagsPickedUp = 2;
        mockOrder.bags.forEach(bag => bag.status = 'completed');
        return Promise.resolve(mockOrder);
      });

      const mockCustomer = {
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        username: 'johndoe',
        passwordSalt: 'salt',
        passwordHash: 'hash'
      };

      mockOrder.customer = mockCustomer;

      Order.findOne.mockResolvedValue(mockOrder);
      Customer.findOne.mockResolvedValue(mockCustomer);

      const req = {
        body: {
          orderId: 'ORD-123456',
          bagIds: ['bag-001', 'bag-002']
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.completePickup(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order completed successfully',
        orderComplete: true,
        order: expect.objectContaining({
          status: 'complete',
          bags: expect.arrayContaining([
            expect.objectContaining({
              bagId: 'bag-001',
              status: 'completed'
            }),
            expect.objectContaining({
              bagId: 'bag-002',
              status: 'completed'
            })
          ])
        })
      });
    });

    it('should reject if bag count mismatch', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processed',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 2,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn()
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          orderId: 'ORD-123456',
          bagIds: ['bag-001']
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.completePickup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Bag count mismatch',
        message: 'Expected 2 bags but received 1'
      });
    });

    it('should reject if wrong bag scanned', async () => {
      const mockOrder = {
        orderId: 'ORD-123456',
        customerId: 'CUST-12345',
        affiliateId: 'AFF-123',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 10,
        actualWeight: 10,
        status: 'processed',
        numberOfBags: 2,
        bagsWeighed: 2,
        bagsProcessed: 2,
        bagsPickedUp: 0,
        bags: [{
          bagId: 'bag-001',
          bagNumber: 1,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }, {
          bagId: 'bag-002',
          bagNumber: 2,
          weight: 5,
          status: 'processed',
          scannedAt: {},
          scannedBy: {}
        }],
        save: jest.fn()
      };

      Order.findOne.mockResolvedValue(mockOrder);

      const req = {
        body: {
          orderId: 'ORD-123456',
          bagIds: ['bag-001', 'bag-wrong']
        },
        user: { id: 'op123' }
      };

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await operatorController.completePickup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid bag',
        message: 'Bag bag-wrong does not belong to this order'
      });
    });
  });
});
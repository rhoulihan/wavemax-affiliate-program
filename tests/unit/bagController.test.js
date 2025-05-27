const bagController = require('../../server/controllers/bagController');
const Bag = require('../../server/models/Bag');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../server/models/Bag');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('express-validator');
jest.mock('crypto');

// Mock mongoose ObjectId validation
mongoose.Types.ObjectId.isValid = jest.fn();

describe('Bag Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createBag', () => {
    it('should successfully create a new bag', async () => {
      const mockBag = {
        _id: 'bag_id',
        bagId: 'BAG123456',
        barcode: 'WM-ABCD1234',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        status: 'active',
        save: jest.fn().mockResolvedValue({
          _id: 'bag_id',
          bagId: 'BAG123456',
          barcode: 'WM-ABCD1234',
          customerId: 'CUST001',
          affiliateId: 'AFF001',
          status: 'active'
        })
      };

      req.body = {
        customerId: 'CUST001',
        affiliateId: 'AFF001'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([])
      });

      Customer.findOne.mockResolvedValue({ customerId: 'CUST001' });
      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF001' });
      crypto.randomBytes.mockReturnValue(Buffer.from('ABCD1234', 'hex'));
      Bag.prototype.save = jest.fn().mockResolvedValue(mockBag);
      Customer.findOneAndUpdate.mockResolvedValue(true);

      await bagController.createBag(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST001' });
      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF001' });
      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
        { customerId: 'CUST001' },
        { $push: { bags: 'bag_id' }, $set: { bagBarcode: 'WM-ABCD1234' } }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBag
      });
    });

    it('should return validation errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Customer ID is required' }])
      });

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: [{ msg: 'Customer ID is required' }]
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.body = {
        customerId: 'NONEXISTENT',
        affiliateId: 'AFF001'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Customer.findOne.mockResolvedValue(null);

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });

    it('should return 404 for non-existent affiliate', async () => {
      req.body = {
        customerId: 'CUST001',
        affiliateId: 'NONEXISTENT'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Customer.findOne.mockResolvedValue({ customerId: 'CUST001' });
      Affiliate.findOne.mockResolvedValue(null);

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should handle database errors', async () => {
      req.body = {
        customerId: 'CUST001',
        affiliateId: 'AFF001'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? 'Database error' : undefined
      });
    });
  });

  describe('getAllBags', () => {
    it('should return filtered and paginated bags', async () => {
      const mockBags = [
        { bagId: 'BAG001', customerId: 'CUST001', status: 'active' },
        { bagId: 'BAG002', customerId: 'CUST001', status: 'active' }
      ];

      req.query = {
        customerId: 'CUST001',
        status: 'active',
        page: '1',
        limit: '10'
      };

      Bag.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockBags)
      });
      Bag.countDocuments.mockResolvedValue(2);

      await bagController.getAllBags(req, res);

      expect(Bag.find).toHaveBeenCalledWith({
        customerId: 'CUST001',
        status: 'active'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        total: 2,
        pagination: {
          totalPages: 1,
          currentPage: 1
        },
        data: mockBags
      });
    });

    it('should handle pagination correctly', async () => {
      req.query = {
        page: '2',
        limit: '5'
      };

      Bag.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Bag.countDocuments.mockResolvedValue(10);

      await bagController.getAllBags(req, res);

      const skipCall = Bag.find().skip.mock.calls[0][0];
      expect(skipCall).toBe(5); // (page 2 - 1) * limit 5
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        pagination: {
          totalPages: 2,
          currentPage: 2
        }
      }));
    });

    it('should apply all filters when provided', async () => {
      req.query = {
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        status: 'lost'
      };

      Bag.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      Bag.countDocuments.mockResolvedValue(0);

      await bagController.getAllBags(req, res);

      expect(Bag.find).toHaveBeenCalledWith({
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        status: 'lost'
      });
    });
  });

  describe('getBagById', () => {
    it('should find bag by ObjectId', async () => {
      const mockBag = {
        _id: 'objectid123',
        bagId: 'BAG123',
        barcode: 'WM-ABCD'
      };

      req.params.id = 'objectid123';
      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      Bag.findById.mockResolvedValue(mockBag);

      await bagController.getBagById(req, res);

      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('objectid123');
      expect(Bag.findById).toHaveBeenCalledWith('objectid123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBag
      });
    });

    it('should find bag by bagId or barcode', async () => {
      const mockBag = {
        bagId: 'BAG123',
        barcode: 'WM-ABCD'
      };

      req.params.id = 'BAG123';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.getBagById(req, res);

      expect(Bag.findOne).toHaveBeenCalledWith({
        $or: [{ bagId: 'BAG123' }, { barcode: 'BAG123' }]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockBag
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(null);

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });
  });

  describe('updateBag', () => {
    it('should successfully update bag fields', async () => {
      const mockBag = {
        bagId: 'BAG123',
        status: 'active',
        save: jest.fn().mockResolvedValue({
          bagId: 'BAG123',
          status: 'lost',
          lastUsed: new Date(),
          notes: 'Customer reported lost'
        })
      };

      req.params.id = 'BAG123';
      req.body = {
        status: 'lost',
        lastUsed: new Date(),
        notes: 'Customer reported lost'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.updateBag(req, res);

      expect(mockBag.status).toBe('lost');
      expect(mockBag.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle validation errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid status' }])
      });

      await bagController.updateBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: [{ msg: 'Invalid status' }]
      });
    });

    it('should log when bag is marked as lost or damaged', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockBag = {
        bagId: 'BAG123',
        status: 'active',
        save: jest.fn().mockResolvedValue({
          bagId: 'BAG123',
          status: 'damaged'
        })
      };

      req.params.id = 'BAG123';
      req.body = { status: 'damaged' };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.updateBag(req, res);

      expect(consoleSpy).toHaveBeenCalledWith('Bag BAG123 marked as damaged');
      consoleSpy.mockRestore();
    });
  });

  describe('deleteBag', () => {
    it('should soft delete bag by marking as inactive', async () => {
      const mockBag = {
        bagId: 'BAG123',
        status: 'active',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.id = 'BAG123';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.deleteBag(req, res);

      expect(mockBag.status).toBe('inactive');
      expect(mockBag.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag successfully deactivated',
        data: {}
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(null);

      await bagController.deleteBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });
  });

  describe('reportBag', () => {
    it('should report bag as lost', async () => {
      const mockBag = {
        bagId: 'BAG123',
        status: 'active',
        save: jest.fn()
      };
      mockBag.save.mockResolvedValue(mockBag);

      req.params.id = 'BAG123';
      req.body = {
        status: 'lost',
        reportReason: 'Customer cannot find the bag'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.reportBag(req, res);

      expect(mockBag.status).toBe('lost');
      expect(mockBag.reportReason).toBe('Customer cannot find the bag');
      expect(mockBag.reportedAt).toBeDefined();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag successfully reported as lost',
        data: mockBag
      });
    });

    it('should report bag as damaged', async () => {
      const mockBag = {
        bagId: 'BAG123',
        status: 'active',
        save: jest.fn()
      };
      mockBag.save.mockResolvedValue(mockBag);

      req.params.id = 'BAG123';
      req.body = {
        status: 'damaged'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);

      await bagController.reportBag(req, res);

      expect(mockBag.status).toBe('damaged');
      expect(mockBag.reportReason).toBe('Bag reported as damaged');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag successfully reported as damaged',
        data: mockBag
      });
    });

    it('should reject invalid status', async () => {
      req.params.id = 'BAG123';
      req.body = {
        status: 'invalid_status'
      };

      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true)
      });

      await bagController.reportBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Status must be either "lost" or "damaged"'
      });
    });
  });

  describe('replaceBag', () => {
    it('should successfully create replacement bag', async () => {
      const oldBag = {
        _id: 'old_bag_id',
        bagId: 'BAG123',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        status: 'lost',
        save: jest.fn().mockResolvedValue(true)
      };

      const newBag = {
        _id: 'new_bag_id',
        bagId: 'BAG456',
        barcode: 'WM-NEWCODE',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        status: 'active'
      };

      req.params.id = 'BAG123';
      req.body = {
        reason: 'Lost bag - customer requested replacement'
      };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(oldBag);
      crypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue('NEWCODE')
      });
      Bag.prototype.save = jest.fn().mockResolvedValue(newBag);
      Customer.findOneAndUpdate.mockResolvedValue(true);

      await bagController.replaceBag(req, res);

      expect(oldBag.status).toBe('replaced');
      expect(oldBag.replacementBagId).toBe('BAG456');
      expect(oldBag.save).toHaveBeenCalled();
      expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
        { customerId: 'CUST001' },
        { $push: { bags: 'new_bag_id' }, $set: { bagBarcode: 'WM-NEWCODE' } }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Replacement bag issued successfully',
        data: {
          oldBag,
          newBag
        }
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(null);

      await bagController.replaceBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });

    it('should include default reason if not provided', async () => {
      const oldBag = {
        bagId: 'BAG123',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        save: jest.fn().mockResolvedValue(true)
      };

      req.params.id = 'BAG123';
      req.body = {};

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(oldBag);
      crypto.randomBytes.mockReturnValue(Buffer.from('NEWCODE', 'hex'));

      // Mock Bag constructor
      const saveMock = jest.fn().mockResolvedValue({
        bagId: 'BAG456',
        notes: 'Replacement for BAG123. Reason: Replacement requested'
      });
      Bag.mockImplementation(() => ({
        save: saveMock
      }));

      Customer.findOneAndUpdate.mockResolvedValue(true);

      await bagController.replaceBag(req, res);

      const bagConstructorCall = Bag.mock.calls[0][0];
      expect(bagConstructorCall.notes).toContain('Replacement requested');
    });
  });

  describe('getBagHistory', () => {
    it('should return bag with usage history', async () => {
      const mockBag = {
        bagId: 'BAG123',
        barcode: 'WM-ABCD'
      };

      const mockOrders = [
        {
          orderId: 'ORD001',
          createdAt: new Date(),
          status: 'delivered',
          actualWeight: 10,
          pickupDate: new Date(),
          deliveryDate: new Date()
        },
        {
          orderId: 'ORD002',
          createdAt: new Date(),
          status: 'processing',
          actualWeight: 15,
          pickupDate: new Date()
        }
      ];

      req.params.id = 'BAG123';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockOrders)
      });

      await bagController.getBagHistory(req, res);

      expect(Order.find).toHaveBeenCalledWith({ bagId: 'BAG123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          bag: mockBag,
          usageHistory: mockOrders
        }
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(null);

      await bagController.getBagHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });

    it('should handle empty usage history', async () => {
      const mockBag = { bagId: 'BAG123' };

      req.params.id = 'BAG123';
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockResolvedValue(mockBag);
      Order.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      });

      await bagController.getBagHistory(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          bag: mockBag,
          usageHistory: []
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors in development mode', async () => {
      process.env.NODE_ENV = 'development';
      req.params.id = 'BAG123';

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockRejectedValue(new Error('Connection timeout'));

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error',
        error: 'Connection timeout'
      });
    });

    it('should hide error details in production mode', async () => {
      process.env.NODE_ENV = 'production';
      req.params.id = 'BAG123';

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockRejectedValue(new Error('Connection timeout'));

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error',
        error: undefined
      });
    });
  });
});
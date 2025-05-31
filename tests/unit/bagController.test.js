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

  // Helper to create chainable mock queries
  const createMockQuery = (returnValue) => {
    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis()
    };
    // Make it thenable
    mockQuery.then = (resolve) => resolve(returnValue);
    return mockQuery;
  };

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { role: 'administrator' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createBag', () => {
    it('should successfully create a new bag as admin', async () => {
      const mockCustomer = {
        _id: 'customer_id',
        customerId: 'CUST001',
        affiliateId: 'AFF001'
      };
      const mockAffiliate = {
        _id: 'affiliate_id',
        affiliateId: 'AFF001'
      };
      const mockBag = {
        _id: 'bag_id',
        tagNumber: 'TAG123',
        type: 'standard',
        customer: 'customer_id',
        affiliate: 'affiliate_id',
        save: jest.fn()
      };

      req.body = {
        tagNumber: 'TAG123',
        type: 'standard',
        weight: 10,
        notes: 'Test bag',
        specialInstructions: 'Handle with care',
        customerId: 'CUST001'
      };
      req.user = { role: 'administrator' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Bag.prototype.save = jest.fn().mockResolvedValue(mockBag);

      await bagController.createBag(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId: 'CUST001' });
      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF001' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag created successfully',
        bag: mockBag
      });
    });

    it('should require type field', async () => {
      req.body = {
        customerId: 'CUST001'
      };

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag type is required'
      });
    });

    it('should require customerId for admin users', async () => {
      req.body = {
        type: 'standard'
      };
      req.user = { role: 'administrator' };

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer ID is required'
      });
    });

    it('should return 404 for non-existent customer', async () => {
      req.body = {
        type: 'standard',
        customerId: 'NONEXISTENT'
      };
      req.user = { role: 'administrator' };

      Customer.findOne.mockResolvedValue(null);

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer not found'
      });
    });

    it('should handle customer role creating their own bag', async () => {
      const mockCustomer = {
        _id: 'customer_id',
        customerId: 'CUST001',
        affiliateId: 'AFF001'
      };
      const mockAffiliate = {
        _id: 'affiliate_id',
        affiliateId: 'AFF001'
      };
      const mockBag = {
        _id: 'bag_id',
        type: 'standard'
      };

      req.body = {
        type: 'standard',
        weight: 10
      };
      req.user = { role: 'customer', id: 'customer_id' };

      Customer.findById.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Bag.prototype.save = jest.fn().mockResolvedValue(mockBag);

      await bagController.createBag(req, res);

      expect(Customer.findById).toHaveBeenCalledWith('customer_id');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle affiliate role with authorization check', async () => {
      const mockCustomer = {
        _id: 'customer_id',
        customerId: 'CUST001',
        affiliateId: 'AFF001'
      };
      const mockAffiliate = {
        _id: 'affiliate_id',
        affiliateId: 'AFF001'
      };

      req.body = {
        type: 'standard',
        customerId: 'CUST001'
      };
      req.user = { role: 'affiliate', id: 'affiliate_id' };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Bag.prototype.save = jest.fn().mockResolvedValue({});

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should handle database errors', async () => {
      req.body = {
        type: 'standard',
        customerId: 'CUST001'
      };
      req.user = { role: 'administrator' };

      Customer.findOne.mockRejectedValue(new Error('Database error'));

      await bagController.createBag(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error creating bag',
        error: process.env.NODE_ENV === 'development' ? 'Database error' : undefined
      });
    });
  });

  describe('getAllBags', () => {
    it('should return filtered and paginated bags for admin', async () => {
      const mockBags = [
        { bagId: 'BAG001', customer: { customerId: 'CUST001' }, status: 'active' },
        { bagId: 'BAG002', customer: { customerId: 'CUST001' }, status: 'active' }
      ];

      req.query = {
        status: 'active',
        type: 'standard',
        page: '1',
        limit: '10'
      };
      req.user = { role: 'administrator' };

      Bag.find.mockReturnValue(createMockQuery(mockBags));
      Bag.countDocuments.mockResolvedValue(2);

      await bagController.getAllBags(req, res);

      expect(Bag.find).toHaveBeenCalledWith({
        status: 'active',
        type: 'standard'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bags: mockBags,
        pagination: {
          currentPage: 1,
          itemsPerPage: 10,
          totalItems: 2,
          totalPages: 1
        }
      });
    });

    it('should filter by customer for customer role', async () => {
      const mockCustomer = {
        _id: 'customer_id',
        customerId: 'CUST001'
      };

      req.query = { page: '1', limit: '10' };
      req.user = { role: 'customer', id: 'customer_id' };

      Customer.findById.mockResolvedValue(mockCustomer);
      Bag.find.mockReturnValue(createMockQuery([]));
      Bag.countDocuments.mockResolvedValue(0);

      await bagController.getAllBags(req, res);

      expect(Customer.findById).toHaveBeenCalledWith('customer_id');
      expect(Bag.find).toHaveBeenCalledWith({
        customer: 'customer_id'
      });
    });

    it('should filter by affiliate for affiliate role', async () => {
      req.query = { page: '1', limit: '10' };
      req.user = { role: 'affiliate', id: 'affiliate_id' };

      Bag.find.mockReturnValue(createMockQuery([]));
      Bag.countDocuments.mockResolvedValue(0);

      await bagController.getAllBags(req, res);

      expect(Bag.find).toHaveBeenCalledWith({
        affiliate: 'affiliate_id'
      });
    });

    it('should handle pagination correctly', async () => {
      req.query = {
        page: '2',
        limit: '5'
      };
      req.user = { role: 'administrator' };

      const mockQuery = createMockQuery([]);
      Bag.find.mockReturnValue(mockQuery);
      Bag.countDocuments.mockResolvedValue(10);

      await bagController.getAllBags(req, res);

      expect(mockQuery.skip).toHaveBeenCalledWith(5); // (page 2 - 1) * limit 5
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        pagination: {
          currentPage: 2,
          itemsPerPage: 5,
          totalItems: 10,
          totalPages: 2
        }
      }));
    });
  });

  describe('getBagById', () => {
    it('should find bag by ObjectId', async () => {
      const mockBag = {
        _id: 'objectid123',
        bagId: 'BAG123',
        barcode: 'WM-ABCD',
        customer: { _id: 'customer_id' },
        affiliate: { _id: 'affiliate_id' }
      };

      req.params.id = 'objectid123';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      Bag.findById.mockReturnValue(createMockQuery(mockBag));

      await bagController.getBagById(req, res);

      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('objectid123');
      expect(Bag.findById).toHaveBeenCalledWith('objectid123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bag: mockBag
      });
    });

    it('should find bag by bagId when not ObjectId', async () => {
      const mockBag = {
        bagId: 'BAG123',
        barcode: 'WM-ABCD',
        customer: { _id: 'customer_id' },
        affiliate: { _id: 'affiliate_id' }
      };

      req.params.id = 'BAG123';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));

      await bagController.getBagById(req, res);

      expect(Bag.findOne).toHaveBeenCalledWith({ bagId: 'BAG123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bag: mockBag
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(null));

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });

    it('should enforce customer authorization', async () => {
      const mockBag = {
        bagId: 'BAG123',
        customer: { _id: 'other_customer_id' },
        affiliate: { _id: 'affiliate_id' }
      };
      const mockCustomer = {
        _id: 'customer_id'
      };

      req.params.id = 'BAG123';
      req.user = { role: 'customer', id: 'customer_id' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));
      Customer.findById.mockResolvedValue(mockCustomer);

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You can only view your own bags'
      });
    });
  });

  describe('updateBag', () => {
    it('should successfully update bag fields', async () => {
      const mockBag = {
        _id: 'bag_id',
        bagId: 'BAG123',
        status: 'pending',
        customer: { _id: 'customer_id' },
        affiliate: { _id: 'affiliate_id' },
        save: jest.fn()
      };
      mockBag.save.mockResolvedValue({
        ...mockBag,
        status: 'pickedUp',
        notes: 'Updated notes'
      });

      req.params.id = 'BAG123';
      req.body = {
        status: 'pickedUp',
        notes: 'Updated notes'
      };
      req.user = { role: 'administrator' };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));

      await bagController.updateBag(req, res);

      expect(mockBag.status).toBe('pickedUp');
      expect(mockBag.notes).toBe('Updated notes');
      expect(mockBag.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should validate status transitions', async () => {
      const mockBag = {
        bagId: 'BAG123',
        status: 'delivered',
        customer: { _id: 'customer_id' },
        affiliate: { _id: 'affiliate_id' }
      };

      req.params.id = 'BAG123';
      req.body = { status: 'pending' };
      req.user = { role: 'administrator' };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));

      await bagController.updateBag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid status transition from delivered to pending'
      });
    });

    it('should restrict operator updates', async () => {
      const mockBag = {
        bagId: 'BAG123',
        customer: { _id: 'customer_id' },
        affiliate: { _id: 'affiliate_id' }
      };

      req.params.id = 'BAG123';
      req.body = {
        type: 'premium',
        status: 'processing'
      };
      req.user = { role: 'operator' };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));

      await bagController.updateBag(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Operators can only update status and notes'
      });
    });
  });

  describe('deleteBag', () => {
    it('should delete bag permanently', async () => {
      const mockBag = {
        _id: 'mockBagId',
        bagId: 'BAG123',
        status: 'active'
      };

      req.params.id = 'BAG123';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));
      Bag.findByIdAndDelete.mockResolvedValue(mockBag);

      await bagController.deleteBag(req, res);

      expect(Bag.findByIdAndDelete).toHaveBeenCalledWith(mockBag._id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bag deleted successfully',
        data: {}
      });
    });

    it('should return 404 for non-existent bag', async () => {
      req.params.id = 'NONEXISTENT';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(null));

      await bagController.deleteBag(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });
  });

  describe('getBagHistory', () => {
    it('should return bag with order history', async () => {
      const mockBag = {
        bagId: 'BAG123',
        barcode: 'WM-ABCD'
      };

      const mockOrders = [
        {
          orderId: 'ORD001',
          createdAt: new Date(),
          status: 'delivered',
          totalWeight: 10,
          totalPrice: 50
        },
        {
          orderId: 'ORD002',
          createdAt: new Date(),
          status: 'processing',
          totalWeight: 15,
          totalPrice: 75
        }
      ];

      req.params.id = 'BAG123';
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(mockBag));
      Order.find.mockReturnValue(createMockQuery(mockOrders));

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
      req.user = { role: 'administrator' };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      Bag.findOne.mockReturnValue(createMockQuery(null));

      await bagController.getBagHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bag not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors in development mode', async () => {
      process.env.NODE_ENV = 'development';
      req.params.id = 'BAG123';
      req.user = { role: 'administrator' };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      // Mock findOne to throw error when called
      Bag.findOne.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error fetching bag details',
        error: 'Connection timeout'
      });
    });

    it('should hide error details in production mode', async () => {
      process.env.NODE_ENV = 'production';
      req.params.id = 'BAG123';
      req.user = { role: 'administrator' };

      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      // Mock findOne to throw error when called
      Bag.findOne.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      await bagController.getBagById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error fetching bag details',
        error: undefined
      });
    });
  });
});
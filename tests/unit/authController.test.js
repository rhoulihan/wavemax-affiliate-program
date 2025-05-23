const authController = require('../../server/controllers/authController');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const RefreshToken = require('../../server/models/RefreshToken');
const encryptionUtil = require('../../server/utils/encryption');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/RefreshToken');
jest.mock('../../server/utils/encryption');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('affiliateLogin', () => {
    it('should successfully login an affiliate with valid credentials', async () => {
      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF123',
        username: 'testaffiliate',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        save: jest.fn()
      };

      req.body = {
        username: 'testaffiliate',
        password: 'password123'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.affiliateLogin(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ username: 'testaffiliate' });
      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'salt',
        'hashedPassword'
      );
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken',
          affiliate: expect.objectContaining({
            affiliateId: 'AFF123',
            firstName: 'John',
            lastName: 'Doe'
          })
        })
      );
    });

    it('should return 401 for non-existent affiliate', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'password123'
      };

      Affiliate.findOne.mockResolvedValue(null);

      await authController.affiliateLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });

    it('should return 401 for incorrect password', async () => {
      const mockAffiliate = {
        username: 'testaffiliate',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt'
      };

      req.body = {
        username: 'testaffiliate',
        password: 'wrongpassword'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(false);

      await authController.affiliateLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });
  });

  describe('customerLogin', () => {
    it('should successfully login a customer with valid credentials', async () => {
      const mockCustomer = {
        _id: 'customer123',
        customerId: 'CUST123',
        username: 'testcustomer',
        passwordHash: 'hashedPassword',
        passwordSalt: 'salt',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        affiliateId: 'AFF123',
        save: jest.fn()
      };

      const mockAffiliate = {
        affiliateId: 'AFF123',
        deliveryFee: 5.99
      };

      req.body = {
        username: 'testcustomer',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(mockCustomer);
      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      encryptionUtil.verifyPassword.mockReturnValue(true);
      jwt.sign.mockReturnValue('mockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.customerLogin(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ username: 'testcustomer' });
      expect(encryptionUtil.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'salt',
        'hashedPassword'
      );
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mockToken',
          customer: expect.objectContaining({
            customerId: 'CUST123',
            firstName: 'Jane',
            lastName: 'Smith',
            affiliate: expect.objectContaining({
              deliveryFee: 5.99
            })
          })
        })
      );
    });

    it('should return 401 for non-existent customer', async () => {
      req.body = {
        username: 'nonexistent',
        password: 'password123'
      };

      Customer.findOne.mockResolvedValue(null);

      await authController.customerLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid username or password'
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid JWT token', async () => {
      req.headers = {
        authorization: 'Bearer validtoken'
      };

      const decodedToken = {
        id: 'user123',
        role: 'affiliate'
      };

      jwt.verify.mockReturnValue(decodedToken);

      await authController.verifyToken(req, res);

      expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        valid: true,
        user: decodedToken
      });
    });

    it('should return error for missing token', async () => {
      req.headers = {};

      await authController.verifyToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
    });

    it('should return error for invalid token', async () => {
      req.headers = {
        authorization: 'Bearer invalidtoken'
      };

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authController.verifyToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      req.body = {
        refreshToken: 'validRefreshToken'
      };

      const mockRefreshToken = {
        token: 'validRefreshToken',
        userId: 'user123',
        userType: 'affiliate',
        expiryDate: new Date(Date.now() + 86400000),
        isActive: true,
        remove: jest.fn()
      };

      const mockAffiliate = {
        _id: 'user123',
        affiliateId: 'AFF123',
        role: 'affiliate'
      };

      RefreshToken.findOne.mockResolvedValue(mockRefreshToken);
      Affiliate.findById.mockResolvedValue(mockAffiliate);
      jwt.sign.mockReturnValue('newMockToken');
      RefreshToken.prototype.save = jest.fn();

      await authController.refreshToken(req, res);

      expect(RefreshToken.findOne).toHaveBeenCalledWith({ token: 'validRefreshToken' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'newMockToken',
          refreshToken: expect.any(String)
        })
      );
    });

    it('should return error for invalid refresh token', async () => {
      req.body = {
        refreshToken: 'invalidRefreshToken'
      };

      RefreshToken.findOne.mockResolvedValue(null);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid refresh token'
      });
    });

    it('should return error for expired refresh token', async () => {
      req.body = {
        refreshToken: 'expiredRefreshToken'
      };

      const mockRefreshToken = {
        token: 'expiredRefreshToken',
        expiryDate: new Date(Date.now() - 86400000),
        isActive: true
      };

      RefreshToken.findOne.mockResolvedValue(mockRefreshToken);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refresh token expired'
      });
    });
  });
});
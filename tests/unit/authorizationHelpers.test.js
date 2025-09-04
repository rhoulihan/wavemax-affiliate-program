const AuthorizationHelpers = require('../../server/middleware/authorizationHelpers');

describe('AuthorizationHelpers', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {},
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('canAccessCustomer', () => {
    it('should allow admin access to any customer', () => {
      const user = { role: 'admin', customerId: 'CUST001' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST999', 'AFF123');

      expect(result).toBe(true);
    });

    it('should allow administrator access to any customer', () => {
      const user = { role: 'administrator', customerId: 'CUST001' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST999', 'AFF123');

      expect(result).toBe(true);
    });

    it('should allow customer to access their own data', () => {
      const user = { role: 'customer', customerId: 'CUST123' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST123', 'AFF001');

      expect(result).toBe(true);
    });

    it('should deny customer access to other customer data', () => {
      const user = { role: 'customer', customerId: 'CUST123' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST456', 'AFF001');

      expect(result).toBe(false);
    });

    it('should allow affiliate to access their customers', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST999', 'AFF123');

      expect(result).toBe(true);
    });

    it('should deny affiliate access to other affiliate customers', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessCustomer(user, 'CUST999', 'AFF456');

      expect(result).toBe(false);
    });
  });

  describe('canAccessOrder', () => {
    it('should allow admin access to any order', () => {
      const user = { role: 'admin' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF999' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(true);
    });

    it('should allow administrator access to any order', () => {
      const user = { role: 'administrator' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF999' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(true);
    });

    it('should allow customer to access their own order', () => {
      const user = { role: 'customer', customerId: 'CUST123' };
      const order = { customerId: 'CUST123', affiliateId: 'AFF001' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(true);
    });

    it('should deny customer access to other customer order', () => {
      const user = { role: 'customer', customerId: 'CUST123' };
      const order = { customerId: 'CUST456', affiliateId: 'AFF001' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(false);
    });

    it('should allow affiliate to access their orders', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(true);
    });

    it('should deny affiliate access to other affiliate orders', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF456' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(false);
    });

    it('should allow operator access to their affiliate orders', () => {
      const user = { role: 'operator', affiliateId: 'AFF123' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(true);
    });

    it('should deny operator access to other affiliate orders', () => {
      const user = { role: 'operator', affiliateId: 'AFF123' };
      const order = { customerId: 'CUST999', affiliateId: 'AFF456' };
      
      const result = AuthorizationHelpers.canAccessOrder(user, order);

      expect(result).toBe(false);
    });
  });

  describe('canAccessAffiliate', () => {
    it('should allow admin access to any affiliate', () => {
      const user = { role: 'admin' };
      
      const result = AuthorizationHelpers.canAccessAffiliate(user, 'AFF999');

      expect(result).toBe(true);
    });

    it('should allow administrator access to any affiliate', () => {
      const user = { role: 'administrator' };
      
      const result = AuthorizationHelpers.canAccessAffiliate(user, 'AFF999');

      expect(result).toBe(true);
    });

    it('should allow affiliate to access their own data', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessAffiliate(user, 'AFF123');

      expect(result).toBe(true);
    });

    it('should deny affiliate access to other affiliate data', () => {
      const user = { role: 'affiliate', affiliateId: 'AFF123' };
      
      const result = AuthorizationHelpers.canAccessAffiliate(user, 'AFF456');

      expect(result).toBe(false);
    });

    it('should deny customer access to affiliate data', () => {
      const user = { role: 'customer', customerId: 'CUST123' };
      
      const result = AuthorizationHelpers.canAccessAffiliate(user, 'AFF123');

      expect(result).toBe(false);
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for allowed role', () => {
      req.user = { role: 'admin' };
      const middleware = AuthorizationHelpers.requireRole(['admin']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for multiple allowed roles', () => {
      req.user = { role: 'affiliate' };
      const middleware = AuthorizationHelpers.requireRole(['admin', 'affiliate']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      req.user = { role: 'customer' };
      const middleware = AuthorizationHelpers.requireRole(['admin']);

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
    });

    it('should deny access when no user', () => {
      req.user = null;
      const middleware = AuthorizationHelpers.requireRole(['admin']);

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });
  });

  describe('requireAnyRole middleware', () => {
    it('should allow access for any of the allowed roles', () => {
      req.user = { role: 'operator' };
      const middleware = AuthorizationHelpers.requireAnyRole(['admin', 'operator', 'affiliate']);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', () => {
      req.user = { role: 'customer' };
      const middleware = AuthorizationHelpers.requireAnyRole(['admin', 'operator']);

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
    });

    it('should deny access when no user', () => {
      req.user = null;
      const middleware = AuthorizationHelpers.requireAnyRole(['admin', 'operator']);

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      const user = { role: 'admin' };
      
      const result = AuthorizationHelpers.isAdmin(user);

      expect(result).toBe(true);
    });

    it('should return true for administrator role', () => {
      const user = { role: 'administrator' };
      
      const result = AuthorizationHelpers.isAdmin(user);

      expect(result).toBe(true);
    });

    it('should return false for non-admin roles', () => {
      expect(AuthorizationHelpers.isAdmin({ role: 'customer' })).toBe(false);
      expect(AuthorizationHelpers.isAdmin({ role: 'affiliate' })).toBe(false);
      expect(AuthorizationHelpers.isAdmin({ role: 'operator' })).toBe(false);
    });
  });

  describe('isOperator', () => {
    it('should return true for operator role', () => {
      const user = { role: 'operator' };
      
      const result = AuthorizationHelpers.isOperator(user);

      expect(result).toBe(true);
    });

    it('should return true for admin role', () => {
      const user = { role: 'admin' };
      
      const result = AuthorizationHelpers.isOperator(user);

      expect(result).toBe(true);
    });

    it('should return true for administrator role', () => {
      const user = { role: 'administrator' };
      
      const result = AuthorizationHelpers.isOperator(user);

      expect(result).toBe(true);
    });

    it('should return false for customer and affiliate', () => {
      expect(AuthorizationHelpers.isOperator({ role: 'customer' })).toBe(false);
      expect(AuthorizationHelpers.isOperator({ role: 'affiliate' })).toBe(false);
    });
  });

  describe('isAffiliate', () => {
    it('should return true for affiliate role', () => {
      const user = { role: 'affiliate' };
      
      const result = AuthorizationHelpers.isAffiliate(user);

      expect(result).toBe(true);
    });

    it('should return true for operator role', () => {
      const user = { role: 'operator' };
      
      const result = AuthorizationHelpers.isAffiliate(user);

      expect(result).toBe(true);
    });

    it('should return true for admin role', () => {
      const user = { role: 'admin' };
      
      const result = AuthorizationHelpers.isAffiliate(user);

      expect(result).toBe(true);
    });

    it('should return false for customer', () => {
      expect(AuthorizationHelpers.isAffiliate({ role: 'customer' })).toBe(false);
    });
  });

  describe('checkCustomerAccess middleware', () => {
    beforeEach(() => {
      // Mock Customer.findOne
      require('../../server/models/Customer').findOne = jest.fn();
    });

    it('should allow customer to access own data', async () => {
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.params.customerId = 'CUST123';

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin to access any customer', async () => {
      req.user = { role: 'admin' };
      req.params.customerId = 'CUST999';

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow administrator to access any customer', async () => {
      req.user = { role: 'administrator' };
      req.params.customerId = 'CUST999';

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny customer access to other customers', async () => {
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.params.customerId = 'CUST456';

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized access to customer data'
      });
    });

    it('should use customerId from body if not in params', async () => {
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.body.customerId = 'CUST123';

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when no customer ID provided', async () => {
      req.user = { role: 'customer', customerId: 'CUST123' };

      await AuthorizationHelpers.checkCustomerAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Customer ID required'
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin user', () => {
      const user = { role: 'admin' };
      
      const result = AuthorizationHelpers.hasPermission(user, 'any_permission');

      expect(result).toBe(true);
    });

    it('should return true for administrator user', () => {
      const user = { role: 'administrator' };
      
      const result = AuthorizationHelpers.hasPermission(user, 'any_permission');

      expect(result).toBe(true);
    });

    it('should check permissions array when present', () => {
      const user = { role: 'operator', permissions: ['scan_bags', 'update_orders'] };
      
      expect(AuthorizationHelpers.hasPermission(user, 'scan_bags')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'delete_orders')).toBe(false);
    });

    it('should use role-based permissions for operator', () => {
      const user = { role: 'operator' };
      
      expect(AuthorizationHelpers.hasPermission(user, 'scan_bags')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'update_orders')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'view_customers')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'delete_system')).toBe(false);
    });

    it('should use role-based permissions for affiliate', () => {
      const user = { role: 'affiliate' };
      
      expect(AuthorizationHelpers.hasPermission(user, 'view_customers')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'view_orders')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'view_reports')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'scan_bags')).toBe(false);
    });

    it('should use role-based permissions for customer', () => {
      const user = { role: 'customer' };
      
      expect(AuthorizationHelpers.hasPermission(user, 'view_own_orders')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'update_own_profile')).toBe(true);
      expect(AuthorizationHelpers.hasPermission(user, 'view_customers')).toBe(false);
    });
  });

  describe('requirePermission middleware', () => {
    it('should allow access when user has permission', () => {
      req.user = { role: 'operator' };
      const middleware = AuthorizationHelpers.requirePermission('scan_bags');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access when user lacks permission', () => {
      req.user = { role: 'customer' };
      const middleware = AuthorizationHelpers.requirePermission('scan_bags');

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Permission 'scan_bags' required"
      });
    });
  });

  describe('applyRoleFilters middleware', () => {
    it('should not apply filters for admin', () => {
      req.user = { role: 'admin' };
      req.query = {};

      AuthorizationHelpers.applyRoleFilters(req, res, next);

      expect(req.query).toEqual({});
      expect(next).toHaveBeenCalled();
    });

    it('should apply customerId filter for customers', () => {
      req.user = { role: 'customer', customerId: 'CUST123' };
      req.query = {};

      AuthorizationHelpers.applyRoleFilters(req, res, next);

      expect(req.query.customerId).toBe('CUST123');
      expect(next).toHaveBeenCalled();
    });

    it('should apply affiliateId filter for affiliates', () => {
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      req.query = {};

      AuthorizationHelpers.applyRoleFilters(req, res, next);

      expect(req.query.affiliateId).toBe('AFF123');
      expect(next).toHaveBeenCalled();
    });

    it('should apply affiliateId filter for operators', () => {
      req.user = { role: 'operator', affiliateId: 'AFF123' };
      req.query = {};

      AuthorizationHelpers.applyRoleFilters(req, res, next);

      expect(req.query.affiliateId).toBe('AFF123');
      expect(next).toHaveBeenCalled();
    });

    it('should deny access for unknown role', () => {
      req.user = { role: 'unknown' };
      req.query = {};

      AuthorizationHelpers.applyRoleFilters(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid user role'
      });
    });
  });
});
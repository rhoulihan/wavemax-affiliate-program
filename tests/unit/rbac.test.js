const { 
  checkRole, 
  checkAllRoles, 
  checkResourceOwnership, 
  checkAdminPermission,
  checkOperatorStatus,
  filterResponseFields,
  roleHierarchy,
  allowedRoles
} = require('../../server/middleware/rbac');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');

// Mock the models
jest.mock('../../server/models/Administrator');
jest.mock('../../server/models/Operator');

describe('RBAC Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: null,
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Role Hierarchy', () => {
    it('should define correct role hierarchy', () => {
      expect(roleHierarchy).toEqual({
        'admin': ['administrator', 'operator', 'affiliate', 'customer'],
        'administrator': ['operator', 'affiliate', 'customer'],
        'operator': [],
        'affiliate': ['customer'],
        'customer': []
      });
    });

    it('should define allowed roles', () => {
      expect(allowedRoles).toEqual(['admin', 'administrator', 'operator', 'affiliate', 'customer']);
    });
  });

  describe('checkRole Middleware', () => {
    it('should reject when no user is present', () => {
      const middleware = checkRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: No role found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user has no role', () => {
      req.user = { id: '123' };
      const middleware = checkRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: No role found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user has invalid role', () => {
      req.user = { role: 'invalid_role' };
      const middleware = checkRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Invalid role'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept when user has exact required role', () => {
      req.user = { role: 'administrator' };
      const middleware = checkRole('administrator');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept when user has higher role in hierarchy', () => {
      req.user = { role: 'admin' };
      const middleware = checkRole('customer');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when user has lower role in hierarchy', () => {
      req.user = { role: 'customer' };
      const middleware = checkRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Insufficient privileges'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle array of required roles', () => {
      req.user = { role: 'affiliate' };
      const middleware = checkRole(['customer', 'operator']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept administrator accessing operator resources', () => {
      req.user = { role: 'administrator' };
      const middleware = checkRole('operator');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject operator accessing administrator resources', () => {
      req.user = { role: 'operator' };
      const middleware = checkRole('administrator');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Insufficient privileges'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkAllRoles Middleware', () => {
    it('should reject when no user is present', () => {
      const middleware = checkAllRoles(['admin', 'operator']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: No role found'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept when user has access to all required roles', () => {
      req.user = { role: 'admin' };
      const middleware = checkAllRoles(['operator', 'customer']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when user lacks access to any required role', () => {
      req.user = { role: 'affiliate' };
      const middleware = checkAllRoles(['customer', 'operator']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Insufficient privileges for all required roles'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept admin for any combination of roles', () => {
      req.user = { role: 'admin' };
      const middleware = checkAllRoles(['administrator', 'operator', 'affiliate', 'customer']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkResourceOwnership Middleware', () => {
    it('should reject when no user is present', () => {
      const middleware = checkResourceOwnership('id');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Not authenticated'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow admin access to any resource', () => {
      req.user = { role: 'admin' };
      req.params.id = 'resource123';
      const middleware = checkResourceOwnership('id');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow administrator access to any resource', () => {
      req.user = { role: 'administrator' };
      req.params.id = 'resource123';
      const middleware = checkResourceOwnership('id');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow affiliate access to own resource via params', () => {
      req.user = { role: 'affiliate', affiliateId: 'aff123' };
      req.params.affiliateId = 'aff123';
      const middleware = checkResourceOwnership('affiliateId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow customer access to own resource via body', () => {
      req.user = { role: 'customer', customerId: 'cust123' };
      req.body.customerId = 'cust123';
      const middleware = checkResourceOwnership('customerId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow operator access to own resource', () => {
      req.user = { role: 'operator', operatorId: 'op123' };
      req.params.operatorId = 'op123';
      const middleware = checkResourceOwnership('operatorId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject affiliate access to another affiliate resource', () => {
      req.user = { role: 'affiliate', affiliateId: 'aff123' };
      req.params.affiliateId = 'aff456';
      const middleware = checkResourceOwnership('affiliateId');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: You do not own this resource'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should prefer params over body for resource ID', () => {
      req.user = { role: 'customer', customerId: 'cust123' };
      req.params.customerId = 'cust123';
      req.body.customerId = 'cust456';
      const middleware = checkResourceOwnership('customerId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkAdminPermission Middleware', () => {
    it('should reject when user is not administrator', async () => {
      req.user = { role: 'affiliate', id: '123' };
      const middleware = checkAdminPermission('manage_users');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Administrator role required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when administrator not found', async () => {
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockResolvedValue(null);
      
      const middleware = checkAdminPermission('manage_users');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Administrator account not active'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when administrator is not active', async () => {
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockResolvedValue({ isActive: false });
      
      const middleware = checkAdminPermission('manage_users');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Administrator account not active'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept when administrator has required permission', async () => {
      const mockAdmin = { 
        isActive: true, 
        hasPermission: jest.fn().mockReturnValue(true) 
      };
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockResolvedValue(mockAdmin);
      
      const middleware = checkAdminPermission('manage_users');
      await middleware(req, res, next);

      expect(mockAdmin.hasPermission).toHaveBeenCalledWith('manage_users');
      expect(req.admin).toBe(mockAdmin);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle array of required permissions', async () => {
      const mockAdmin = { 
        isActive: true, 
        hasPermission: jest.fn().mockReturnValue(true) 
      };
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockResolvedValue(mockAdmin);
      
      const middleware = checkAdminPermission(['manage_users', 'manage_settings']);
      await middleware(req, res, next);

      expect(mockAdmin.hasPermission).toHaveBeenCalledWith('manage_users');
      expect(mockAdmin.hasPermission).toHaveBeenCalledWith('manage_settings');
      expect(next).toHaveBeenCalled();
    });

    it('should reject when administrator lacks any required permission', async () => {
      const mockAdmin = { 
        isActive: true, 
        hasPermission: jest.fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false) 
      };
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockResolvedValue(mockAdmin);
      
      const middleware = checkAdminPermission(['manage_users', 'manage_settings']);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: manage_users, manage_settings permission required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      req.user = { role: 'administrator', id: '123' };
      Administrator.findById.mockRejectedValue(new Error('DB Error'));
      console.error = jest.fn();
      
      const middleware = checkAdminPermission('manage_users');
      await middleware(req, res, next);

      expect(console.error).toHaveBeenCalledWith('Permission check error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error checking permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkOperatorStatus Middleware', () => {
    it('should skip check for non-operators', async () => {
      req.user = { role: 'customer', id: '123' };
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(Operator.findById).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when operator not found', async () => {
      req.user = { role: 'operator', id: '123' };
      Operator.findById.mockResolvedValue(null);
      
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Operator account not active'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when operator is not active', async () => {
      req.user = { role: 'operator', id: '123' };
      Operator.findById.mockResolvedValue({ isActive: false });
      
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Operator account not active'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when operator is not on shift', async () => {
      req.user = { role: 'operator', id: '123' };
      Operator.findById.mockResolvedValue({ 
        isActive: true, 
        isOnShift: false 
      });
      
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied: Operator not on shift'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept active operator on shift', async () => {
      const mockOperator = { 
        isActive: true, 
        isOnShift: true 
      };
      req.user = { role: 'operator', id: '123' };
      Operator.findById.mockResolvedValue(mockOperator);
      
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(req.operator).toBe(mockOperator);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      req.user = { role: 'operator', id: '123' };
      Operator.findById.mockRejectedValue(new Error('DB Error'));
      console.error = jest.fn();
      
      const middleware = checkOperatorStatus();
      await middleware(req, res, next);

      expect(console.error).toHaveBeenCalledWith('Operator status check error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error checking operator status'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('filterResponseFields Middleware', () => {
    let originalJson;

    beforeEach(() => {
      originalJson = res.json;
    });

    it('should pass through data when no user present', () => {
      const middleware = filterResponseFields({ admin: ['*'] });
      middleware(req, res, next);

      const testData = { id: 1, secret: 'hidden' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith(testData);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through data when user has no role', () => {
      req.user = { id: '123' };
      const middleware = filterResponseFields({ admin: ['*'] });
      middleware(req, res, next);

      const testData = { id: 1, secret: 'hidden' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith(testData);
    });

    it('should pass through all fields when role has wildcard permission', () => {
      req.user = { role: 'admin' };
      const middleware = filterResponseFields({ admin: ['*'] });
      middleware(req, res, next);

      const testData = { id: 1, secret: 'hidden', data: 'visible' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith(testData);
    });

    it('should filter fields based on role permissions', () => {
      req.user = { role: 'customer' };
      const middleware = filterResponseFields({ 
        customer: ['id', 'name', 'email'],
        default: ['id']
      });
      middleware(req, res, next);

      const testData = { id: 1, name: 'John', email: 'john@example.com', secret: 'hidden' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith({ 
        id: 1, 
        name: 'John', 
        email: 'john@example.com' 
      });
    });

    it('should handle nested field permissions', () => {
      req.user = { role: 'affiliate' };
      const middleware = filterResponseFields({ 
        affiliate: ['id', 'profile.name', 'profile.email']
      });
      middleware(req, res, next);

      const testData = { 
        id: 1, 
        profile: { 
          name: 'John', 
          email: 'john@example.com', 
          ssn: '123-45-6789' 
        },
        secret: 'hidden'
      };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith({ 
        id: 1, 
        profile: { 
          name: 'John', 
          email: 'john@example.com' 
        }
      });
    });

    it('should handle array data', () => {
      req.user = { role: 'operator' };
      const middleware = filterResponseFields({ 
        operator: ['id', 'status']
      });
      middleware(req, res, next);

      const testData = [
        { id: 1, status: 'active', secret: 'hidden' },
        { id: 2, status: 'inactive', secret: 'hidden' }
      ];
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith([
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' }
      ]);
    });

    it('should handle standard response format with data property', () => {
      req.user = { role: 'customer' };
      const middleware = filterResponseFields({ 
        customer: ['id', 'name']
      });
      middleware(req, res, next);

      const testData = { 
        success: true, 
        message: 'Success',
        data: { id: 1, name: 'John', secret: 'hidden' }
      };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith({ 
        success: true, 
        message: 'Success',
        data: { id: 1, name: 'John' }
      });
    });

    it('should use default permissions when role not specified', () => {
      req.user = { role: 'unknown_role' };
      const middleware = filterResponseFields({ 
        admin: ['*'],
        default: ['id', 'public']
      });
      middleware(req, res, next);

      const testData = { id: 1, public: 'visible', private: 'hidden' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith({ 
        id: 1, 
        public: 'visible'
      });
    });

    it('should handle deeply nested fields', () => {
      req.user = { role: 'admin' };
      const middleware = filterResponseFields({ 
        admin: ['id', 'data.user.profile.name', 'data.user.profile.email']
      });
      middleware(req, res, next);

      const testData = { 
        id: 1, 
        data: {
          user: {
            profile: {
              name: 'John',
              email: 'john@example.com',
              password: 'secret'
            }
          }
        }
      };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith({ 
        id: 1, 
        data: {
          user: {
            profile: {
              name: 'John',
              email: 'john@example.com'
            }
          }
        }
      });
    });

    it('should handle non-object data gracefully', () => {
      req.user = { role: 'customer' };
      const middleware = filterResponseFields({ 
        customer: ['id']
      });
      middleware(req, res, next);

      res.json('string response');
      expect(originalJson).toHaveBeenCalledWith('string response');

      res.json(123);
      expect(originalJson).toHaveBeenCalledWith(123);

      res.json(null);
      expect(originalJson).toHaveBeenCalledWith(null);
    });

    it('should handle empty allowed fields', () => {
      req.user = { role: 'restricted' };
      const middleware = filterResponseFields({ 
        restricted: []
      });
      middleware(req, res, next);

      const testData = { id: 1, name: 'John' };
      res.json(testData);

      expect(originalJson).toHaveBeenCalledWith(testData);
    });
  });
});
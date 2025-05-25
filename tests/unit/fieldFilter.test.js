const {
  filterFields,
  filterArray,
  getFilteredData,
  responseFilter,
  fieldDefinitions
} = require('../../server/utils/fieldFilter');

describe('Field Filter Utility', () => {
  describe('filterFields', () => {
    it('should filter object to include only allowed fields', () => {
      const obj = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
        role: 'admin'
      };
      const allowedFields = ['id', 'name', 'email'];

      const result = filterFields(obj, allowedFields);

      expect(result).toEqual({
        id: 1,
        name: 'John',
        email: 'john@example.com'
      });
      expect(result.password).toBeUndefined();
      expect(result.role).toBeUndefined();
    });

    it('should handle empty allowed fields array', () => {
      const obj = { id: 1, name: 'John' };
      const result = filterFields(obj, []);

      expect(result).toEqual({});
    });

    it('should handle null or undefined objects', () => {
      expect(filterFields(null, ['id'])).toBe(null);
      expect(filterFields(undefined, ['id'])).toBe(undefined);
    });

    it('should handle non-object inputs', () => {
      expect(filterFields('string', ['length'])).toBe('string');
      expect(filterFields(123, ['value'])).toBe(123);
    });

    it('should handle missing fields gracefully', () => {
      const obj = { id: 1, name: 'John' };
      const allowedFields = ['id', 'name', 'email', 'phone'];

      const result = filterFields(obj, allowedFields);

      expect(result).toEqual({
        id: 1,
        name: 'John'
      });
    });

    it('should not include inherited properties', () => {
      const parent = { inherited: 'value' };
      const obj = Object.create(parent);
      obj.own = 'property';

      const result = filterFields(obj, ['inherited', 'own']);

      expect(result).toEqual({ own: 'property' });
      expect(result.inherited).toBeUndefined();
    });

    it('should handle nested objects without deep filtering', () => {
      const obj = {
        id: 1,
        profile: {
          name: 'John',
          email: 'john@example.com'
        }
      };

      const result = filterFields(obj, ['id', 'profile']);

      expect(result).toEqual({
        id: 1,
        profile: {
          name: 'John',
          email: 'john@example.com'
        }
      });
    });
  });

  describe('filterArray', () => {
    it('should filter array of objects', () => {
      const arr = [
        { id: 1, name: 'John', password: 'secret1' },
        { id: 2, name: 'Jane', password: 'secret2' }
      ];
      const allowedFields = ['id', 'name'];

      const result = filterArray(arr, allowedFields);

      expect(result).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
    });

    it('should handle empty array', () => {
      const result = filterArray([], ['id', 'name']);
      expect(result).toEqual([]);
    });

    it('should handle non-array inputs', () => {
      expect(filterArray('not array', ['id'])).toBe('not array');
      expect(filterArray(null, ['id'])).toBe(null);
      expect(filterArray(undefined, ['id'])).toBe(undefined);
    });

    it('should handle arrays with mixed types', () => {
      const arr = [
        { id: 1, name: 'John' },
        null,
        undefined,
        'string',
        123
      ];
      const allowedFields = ['id', 'name'];

      const result = filterArray(arr, allowedFields);

      expect(result).toEqual([
        { id: 1, name: 'John' },
        null,
        undefined,
        'string',
        123
      ]);
    });
  });

  describe('fieldDefinitions', () => {
    it('should have definitions for all data types', () => {
      expect(fieldDefinitions.affiliate).toBeDefined();
      expect(fieldDefinitions.customer).toBeDefined();
      expect(fieldDefinitions.order).toBeDefined();
      expect(fieldDefinitions.bag).toBeDefined();
    });

    it('should have different field sets for different roles', () => {
      expect(fieldDefinitions.affiliate.public).toBeDefined();
      expect(fieldDefinitions.affiliate.self).toBeDefined();
      expect(fieldDefinitions.affiliate.admin).toBeDefined();

      // Admin should see more fields than public
      expect(fieldDefinitions.affiliate.admin.length).toBeGreaterThan(
        fieldDefinitions.affiliate.public.length
      );
    });

    it('should not expose sensitive fields in public view', () => {
      expect(fieldDefinitions.affiliate.public).not.toContain('email');
      expect(fieldDefinitions.affiliate.public).not.toContain('phone');
      expect(fieldDefinitions.customer.public).not.toContain('email');
      expect(fieldDefinitions.customer.public).not.toContain('address');
    });

    it('should include appropriate fields for each role', () => {
      // Customer should see their own email in self view
      expect(fieldDefinitions.customer.self).toContain('email');
      expect(fieldDefinitions.customer.self).toContain('phone');

      // Affiliate should see customer contact info
      expect(fieldDefinitions.customer.affiliate).toContain('email');
      expect(fieldDefinitions.customer.affiliate).toContain('phone');

      // Admin should see everything
      expect(fieldDefinitions.customer.admin).toContain('_id');
      expect(fieldDefinitions.customer.admin).toContain('username');
    });
  });

  describe('getFilteredData', () => {
    const mockAffiliate = {
      _id: 'mongo_id',
      affiliateId: 'AFF123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      businessName: 'Johns Laundry',
      deliveryFee: 5.99,
      accountNumber: '123456789',
      routingNumber: '987654321'
    };

    it('should filter data based on admin role', () => {
      const result = getFilteredData('affiliate', mockAffiliate, 'admin');

      expect(result._id).toBe('mongo_id');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('123-456-7890');
    });

    it('should filter data based on public role', () => {
      const result = getFilteredData('affiliate', mockAffiliate, 'public');

      expect(result.affiliateId).toBe('AFF123');
      expect(result.firstName).toBe('John');
      expect(result.businessName).toBe('Johns Laundry');
      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.accountNumber).toBeUndefined();
    });

    it('should handle self context for customers', () => {
      const mockCustomer = {
        customerId: 'CUST123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '987-654-3210',
        lastFourDigits: '1234'
      };

      const resultSelf = getFilteredData('customer', mockCustomer, 'customer', { isSelf: true });
      const resultOther = getFilteredData('customer', mockCustomer, 'customer', { isSelf: false });

      expect(resultSelf.email).toBe('jane@example.com');
      expect(resultSelf.lastFourDigits).toBe('1234');
      expect(resultOther.email).toBeUndefined();
      expect(resultOther.lastFourDigits).toBeUndefined();
    });

    it('should handle arrays of data', () => {
      const affiliates = [mockAffiliate, { ...mockAffiliate, affiliateId: 'AFF456' }];
      const result = getFilteredData('affiliate', affiliates, 'public');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].email).toBeUndefined();
      expect(result[1].affiliateId).toBe('AFF456');
    });

    it('should return data as-is for unknown data types', () => {
      const data = { unknown: 'field' };
      const result = getFilteredData('unknown', data, 'admin');

      expect(result).toEqual(data);
    });

    it('should handle null or undefined data', () => {
      expect(getFilteredData('affiliate', null, 'admin')).toBe(null);
      expect(getFilteredData('affiliate', undefined, 'admin')).toBe(undefined);
    });

    it('should use fallback field definitions', () => {
      const mockOrder = {
        orderId: 'ORD123',
        customerId: 'CUST123',
        status: 'processing',
        actualWeight: 10,
        affiliateCommission: 5.00
      };

      // Affiliate should see commission
      const affiliateView = getFilteredData('order', mockOrder, 'affiliate');
      expect(affiliateView.affiliateCommission).toBe(5.00);

      // Customer should not see commission
      const customerView = getFilteredData('order', mockOrder, 'customer');
      expect(customerView.affiliateCommission).toBeUndefined();
    });
  });

  describe('responseFilter middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        user: null
      };
      res = {
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should create filtered json method', () => {
      responseFilter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).not.toBe(res.json.mock);
    });

    it('should filter response data when _filterType is provided', () => {
      req.user = { role: 'customer', customerId: 'CUST123' };
      const originalJson = jest.fn();
      res.json = originalJson;

      responseFilter(req, res, next);

      const data = {
        _filterType: 'customer',
        data: {
          customerId: 'CUST123',
          email: 'customer@example.com',
          password: 'should_be_removed'
        }
      };

      res.json(data);

      expect(originalJson).toHaveBeenCalled();
      const calledData = originalJson.mock.calls[0][0];
      expect(calledData._filterType).toBeUndefined();
      expect(calledData.data.customerId).toBe('CUST123');
      expect(calledData.data.password).toBeUndefined();
    });

    it('should not filter when _filterType is not provided', () => {
      const originalJson = jest.fn();
      res.json = originalJson;

      responseFilter(req, res, next);

      const data = {
        success: true,
        data: {
          sensitive: 'info'
        }
      };

      res.json(data);

      expect(originalJson).toHaveBeenCalledWith(data);
    });

    it('should handle public role when user is not authenticated', () => {
      const originalJson = jest.fn();
      res.json = originalJson;

      responseFilter(req, res, next);

      const data = {
        _filterType: 'affiliate',
        data: {
          affiliateId: 'AFF123',
          email: 'affiliate@example.com'
        }
      };

      res.json(data);

      const calledData = originalJson.mock.calls[0][0];
      expect(calledData.data.affiliateId).toBe('AFF123');
      expect(calledData.data.email).toBeUndefined();
    });

    it('should extract user ID from different user types', () => {
      const originalJson = jest.fn();
      res.json = originalJson;

      // Test with affiliateId
      req.user = { role: 'affiliate', affiliateId: 'AFF123' };
      responseFilter(req, res, next);
      res.json({ _filterType: 'affiliate', data: {} });

      // Test with customerId
      req.user = { role: 'customer', customerId: 'CUST123' };
      responseFilter(req, res, next);
      res.json({ _filterType: 'customer', data: {} });

      // Test with generic id
      req.user = { role: 'admin', id: 'ADMIN123' };
      responseFilter(req, res, next);
      res.json({ _filterType: 'affiliate', data: {} });

      expect(originalJson).toHaveBeenCalledTimes(3);
    });

    it('should preserve other response properties', () => {
      req.user = { role: 'admin' };
      const originalJson = jest.fn();
      res.json = originalJson;

      responseFilter(req, res, next);

      const data = {
        _filterType: 'customer',
        success: true,
        message: 'Customer retrieved',
        data: {
          customerId: 'CUST123',
          email: 'customer@example.com'
        },
        pagination: {
          page: 1,
          total: 100
        }
      };

      res.json(data);

      const calledData = originalJson.mock.calls[0][0];
      expect(calledData.success).toBe(true);
      expect(calledData.message).toBe('Customer retrieved');
      expect(calledData.pagination).toEqual({ page: 1, total: 100 });
    });

    it('should handle responses without data property', () => {
      const originalJson = jest.fn();
      res.json = originalJson;

      responseFilter(req, res, next);

      const data = {
        _filterType: 'customer',
        error: 'Something went wrong'
      };

      res.json(data);

      const calledData = originalJson.mock.calls[0][0];
      expect(calledData.error).toBe('Something went wrong');
      expect(calledData._filterType).toBeUndefined();
    });

    it('should maintain this context in json method', () => {
      const originalJson = jest.fn(function() {
        return this;
      });
      res.json = originalJson;

      responseFilter(req, res, next);

      const result = res.json({ test: 'data' });

      expect(result).toBe(res);
    });
  });
});
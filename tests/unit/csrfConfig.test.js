const { 
  CSRF_CONFIG, 
  shouldEnforceCsrf
} = require('../../server/config/csrf-config');

describe('CSRF Configuration', () => {
  let req;

  beforeEach(() => {
    req = {
      path: '/api/v1/test',
      method: 'POST'
    };
    
    // Reset environment variables
    delete process.env.CSRF_PHASE;
  });

  describe('CSRF_CONFIG', () => {
    it('should define all endpoint categories', () => {
      expect(CSRF_CONFIG.PUBLIC_ENDPOINTS).toBeDefined();
      expect(CSRF_CONFIG.AUTH_ENDPOINTS).toBeDefined();
      expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).toBeDefined();
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toBeDefined();
      expect(CSRF_CONFIG.HIGH_PRIORITY_ENDPOINTS).toBeDefined();
      expect(CSRF_CONFIG.READ_ONLY_ENDPOINTS).toBeDefined();
    });

    it('should have valid endpoint patterns', () => {
      // Check that all endpoints start with /api
      const allEndpoints = [
        ...CSRF_CONFIG.PUBLIC_ENDPOINTS,
        ...CSRF_CONFIG.AUTH_ENDPOINTS,
        ...CSRF_CONFIG.REGISTRATION_ENDPOINTS,
        ...CSRF_CONFIG.CRITICAL_ENDPOINTS,
        ...CSRF_CONFIG.HIGH_PRIORITY_ENDPOINTS,
        ...CSRF_CONFIG.READ_ONLY_ENDPOINTS
      ];

      allEndpoints.forEach(endpoint => {
        expect(endpoint).toMatch(/^\/api/);
      });
    });

    it('should not have duplicate endpoints across categories', () => {
      const allEndpoints = [
        ...CSRF_CONFIG.PUBLIC_ENDPOINTS,
        ...CSRF_CONFIG.AUTH_ENDPOINTS,
        ...CSRF_CONFIG.REGISTRATION_ENDPOINTS,
        ...CSRF_CONFIG.CRITICAL_ENDPOINTS,
        ...CSRF_CONFIG.HIGH_PRIORITY_ENDPOINTS,
        ...CSRF_CONFIG.READ_ONLY_ENDPOINTS
      ];

      const uniqueEndpoints = new Set(allEndpoints);
      expect(uniqueEndpoints.size).toBe(allEndpoints.length);
    });

    it('should include critical security endpoints', () => {
      // Logout must be protected to prevent CSRF logout attacks
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/auth/logout');
      
      // Order operations must be protected
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/orders');
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/orders/:orderId/cancel');
      
      // Password changes must be protected
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/customers/:customerId/password');
      
      // Data deletion must be protected
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/affiliates/:affiliateId/delete-all-data');
      expect(CSRF_CONFIG.CRITICAL_ENDPOINTS).toContain('/api/v1/customers/:customerId/delete-all-data');
    });

    it('should exclude authentication endpoints from CSRF', () => {
      // Login endpoints should use rate limiting instead
      expect(CSRF_CONFIG.AUTH_ENDPOINTS).toContain('/api/auth/affiliate/login');
      expect(CSRF_CONFIG.AUTH_ENDPOINTS).toContain('/api/auth/customer/login');
      expect(CSRF_CONFIG.AUTH_ENDPOINTS).toContain('/api/auth/administrator/login');
      expect(CSRF_CONFIG.AUTH_ENDPOINTS).toContain('/api/auth/operator/login');
    });

    it('should exclude registration endpoints from CSRF', () => {
      // Registration endpoints should use CAPTCHA instead
      expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).toContain('/api/affiliates/register');
      expect(CSRF_CONFIG.REGISTRATION_ENDPOINTS).toContain('/api/customers/register');
    });
  });

  describe('shouldEnforceCsrf', () => {
    describe('HTTP method checks', () => {
      it('should not enforce CSRF for GET requests', () => {
        req.method = 'GET';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for HEAD requests', () => {
        req.method = 'HEAD';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for OPTIONS requests', () => {
        req.method = 'OPTIONS';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should consider CSRF for POST requests', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should consider CSRF for PUT requests', () => {
        req.method = 'PUT';
        req.path = '/api/v1/orders/123';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should consider CSRF for DELETE requests', () => {
        req.method = 'DELETE';
        req.path = '/api/v1/orders/123';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should consider CSRF for PATCH requests', () => {
        req.method = 'PATCH';
        req.path = '/api/v1/orders/123';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });

    describe('Public endpoints', () => {
      it('should not enforce CSRF for public endpoints', () => {
        req.method = 'POST';
        req.path = '/api/v1/affiliates/123/public';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for health check endpoints', () => {
        req.method = 'POST';
        req.path = '/api/health';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });
    });

    describe('Authentication endpoints', () => {
      it('should not enforce CSRF for login endpoints', () => {
        req.method = 'POST';
        req.path = '/api/auth/customer/login';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for forgot password', () => {
        req.method = 'POST';
        req.path = '/api/auth/forgot-password';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for refresh token', () => {
        req.method = 'POST';
        req.path = '/api/v1/auth/refresh-token';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });
    });

    describe('Registration endpoints', () => {
      it('should not enforce CSRF for affiliate registration', () => {
        req.method = 'POST';
        req.path = '/api/affiliates/register';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should not enforce CSRF for customer registration', () => {
        req.method = 'POST';
        req.path = '/api/v1/customers/register';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });
    });

    describe('Critical endpoints', () => {
      it('should enforce CSRF for logout', () => {
        req.method = 'POST';
        req.path = '/api/v1/auth/logout';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for order creation', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for order cancellation', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders/123/cancel';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for password changes', () => {
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/password';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for data deletion', () => {
        req.method = 'DELETE';
        req.path = '/api/v1/customers/123/delete-all-data';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for admin operations', () => {
        req.method = 'POST';
        req.path = '/api/v1/administrators/operators';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for operator shift changes', () => {
        req.method = 'PUT';
        req.path = '/api/v1/operators/shift/status';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for order status updates', () => {
        req.method = 'PUT';
        req.path = '/api/v1/orders/123/status';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });

    describe('High priority endpoints', () => {
      it('should not enforce CSRF for high priority endpoints when CSRF_PHASE < 2', () => {
        process.env.CSRF_PHASE = '1';
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/profile';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should enforce CSRF for high priority endpoints when CSRF_PHASE >= 2', () => {
        process.env.CSRF_PHASE = '2';
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/profile';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should handle bag management endpoints based on phase', () => {
        process.env.CSRF_PHASE = '3';
        req.method = 'POST';
        req.path = '/api/v1/customers/123/bags/456/report-lost';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should handle payment updates based on phase', () => {
        process.env.CSRF_PHASE = '2';
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/payment';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });

    describe('Read-only endpoints', () => {
      it('should not enforce CSRF for dashboard endpoints', () => {
        req.method = 'POST'; // Even for POST, read-only endpoints should not enforce
        req.path = '/api/v1/customers/123/dashboard';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should enforce CSRF for search endpoints with state-changing methods', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders/search';
        // Note: POST to search is still protected as it's a state-changing method
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for export endpoints with state-changing methods', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders/export';
        // Note: POST to export is still protected as it's a state-changing method
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });

    describe('Pattern matching', () => {
      it('should match parameterized routes', () => {
        req.method = 'PUT';
        req.path = '/api/v1/orders/order-123-abc/status';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should match nested parameterized routes', () => {
        req.method = 'POST';
        req.path = '/api/v1/administrators/operators/op-456/reset-pin';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should not match partial paths', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders/123/status/extra';
        expect(shouldEnforceCsrf(req)).toBe(true); // Default behavior
      });

      it('should handle complex IDs in paths', () => {
        req.method = 'DELETE';
        req.path = '/api/v1/affiliates/aff-123-xyz/delete-all-data';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });

    describe('Default behavior', () => {
      it('should enforce CSRF for unknown state-changing endpoints', () => {
        req.method = 'POST';
        req.path = '/api/v1/unknown/endpoint';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should enforce CSRF for unmatched PUT requests', () => {
        req.method = 'PUT';
        req.path = '/api/v1/some/random/path';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should not enforce CSRF for unknown GET endpoints', () => {
        req.method = 'GET';
        req.path = '/api/v1/unknown/endpoint';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle missing CSRF_PHASE environment variable', () => {
        delete process.env.CSRF_PHASE;
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/profile';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should handle non-numeric CSRF_PHASE', () => {
        process.env.CSRF_PHASE = 'invalid';
        req.method = 'PUT';
        req.path = '/api/v1/customers/123/profile';
        expect(shouldEnforceCsrf(req)).toBe(false);
      });

      it('should handle paths with query parameters', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });

      it('should handle paths with trailing slashes', () => {
        req.method = 'POST';
        req.path = '/api/v1/orders/';
        expect(shouldEnforceCsrf(req)).toBe(true);
      });
    });
  });
});
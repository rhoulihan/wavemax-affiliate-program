// Coverage Routes Unit Tests
// Tests for the coverage analysis report routes

const request = require('supertest');
const express = require('express');
const path = require('path');
const coverageRoutes = require('../../server/routes/coverageRoutes');

describe('Coverage Routes', () => {
  let app;
  let originalEnv;

  beforeEach(() => {
    app = express();
    app.use('/coverage', coverageRoutes);
    
    // Save original environment
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('Access Control Middleware', () => {
    test('should allow access in development environment', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should allow access in test environment', async () => {
      process.env.NODE_ENV = 'test';
      
      const response = await request(app)
        .get('/coverage/')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should deny access in production without key', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/coverage/')
        .expect(403);
        
      expect(response.text).toContain('Access Denied');
      expect(response.text).toContain('Coverage reports are only available in development environment');
    });

    test('should allow access in production with valid key', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COVERAGE_ACCESS_KEY = 'secret-key-123';
      
      const response = await request(app)
        .get('/coverage/?key=secret-key-123')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should deny access in production with invalid key', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COVERAGE_ACCESS_KEY = 'secret-key-123';
      
      const response = await request(app)
        .get('/coverage/?key=wrong-key')
        .expect(403);
        
      expect(response.text).toContain('Access Denied');
    });
  });

  describe('Embedded Access Prevention', () => {
    test('should deny access when Sec-Fetch-Dest is iframe', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .set('Sec-Fetch-Dest', 'iframe')
        .expect(403);
        
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Coverage reports cannot be accessed from embedded contexts');
    });

    test('should deny access when X-Frame-Options is present', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .set('X-Frame-Options', 'SAMEORIGIN')
        .expect(403);
        
      expect(response.body.success).toBe(false);
    });

    test('should deny access when referer contains /embed', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .set('Referer', 'https://example.com/embed/page')
        .expect(403);
        
      expect(response.body.success).toBe(false);
    });

    test('should allow access with normal referer', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .set('Referer', 'https://example.com/normal/page')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Route Handlers', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should serve index.html at root path', async () => {
      const response = await request(app)
        .get('/coverage/')
        .expect(200);
        
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers['cache-control']).toContain('no-store');
    });

    test('should serve critical-files page', async () => {
      const response = await request(app)
        .get('/coverage/critical-files')
        .expect(200);
        
      expect(response.headers['cache-control']).toContain('no-cache');
    });

    test('should serve test-templates page', async () => {
      const response = await request(app)
        .get('/coverage/test-templates')
        .expect(200);
        
      expect(response.headers['cache-control']).toContain('no-cache');
    });

    test('should serve action-plan page', async () => {
      const response = await request(app)
        .get('/coverage/action-plan')
        .expect(200);
        
      expect(response.headers['cache-control']).toContain('no-cache');
    });

    test('should return 404 for non-existent pages', async () => {
      const response = await request(app)
        .get('/coverage/non-existent-page')
        .expect(404);
        
      expect(response.text).toContain('Page Not Found');
      expect(response.text).toContain('The coverage report page you\'re looking for doesn\'t exist');
      expect(response.text).toContain('Back to Coverage Overview');
    });
  });

  describe('Static File Headers', () => {
    test('should set no-cache headers for static files', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/index.html')
        .expect(200);
        
      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });

  describe('Environment Variable Handling', () => {
    test('should handle missing COVERAGE_ACCESS_KEY', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.COVERAGE_ACCESS_KEY;
      
      const response = await request(app)
        .get('/coverage/?key=any-key')
        .expect(403);
        
      expect(response.text).toContain('Access Denied');
    });

    test('should handle empty COVERAGE_ACCESS_KEY', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COVERAGE_ACCESS_KEY = '';
      
      const response = await request(app)
        .get('/coverage/?key=')
        .expect(200); // Empty key matches empty env var
    });
  });

  describe('Multiple Middleware Interaction', () => {
    test('should check embedded access before access control', async () => {
      process.env.NODE_ENV = 'production'; // Would normally require key
      
      const response = await request(app)
        .get('/coverage/')
        .set('Sec-Fetch-Dest', 'iframe')
        .expect(403);
        
      // Should get embedded error, not access control error
      expect(response.body.message).toContain('embedded contexts');
    });

    test('should apply X-Frame-Options even with valid access', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('HTML Response Validation', () => {
    test('should return valid HTML for access denied page', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .get('/coverage/')
        .expect(403);
        
      // Note: The actual HTML doesn't include DOCTYPE declaration
      expect(response.text).toContain('<html>');
      expect(response.text).toContain('</html>');
      expect(response.text).toContain('<style>');
    });

    test('should return valid HTML for 404 page', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage/missing')
        .expect(404);
        
      expect(response.text).toContain('<html>');
      expect(response.text).toContain('</html>');
      expect(response.text).toContain('<a href="/coverage">');
    });
  });

  describe('Query Parameter Handling', () => {
    test('should ignore extra query parameters', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COVERAGE_ACCESS_KEY = 'valid-key';
      
      const response = await request(app)
        .get('/coverage/?key=valid-key&extra=param&another=value')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should handle URL-encoded keys', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COVERAGE_ACCESS_KEY = 'key with spaces';
      
      const response = await request(app)
        .get('/coverage/?key=key%20with%20spaces')
        .expect(200);
        
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Edge Cases', () => {
    test('should handle root path without trailing slash', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .get('/coverage')
        .expect(301); // Redirect to /coverage/
        
      expect(response.headers.location).toBe('/coverage/');
    });

    test('should handle specific route handlers', async () => {
      process.env.NODE_ENV = 'development';
      
      // Test that the specific route handler is called (line 96)
      const response = await request(app)
        .get('/coverage/')
        .query({ _specificRoute: true }) // Force specific route handler
        .expect(200);
    });
  });
});
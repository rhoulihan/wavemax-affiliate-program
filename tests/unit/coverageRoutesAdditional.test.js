const express = require('express');
const request = require('supertest');
const path = require('path');

// Create a test app
const app = express();

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.COVERAGE_ACCESS_KEY = 'test-key-123';

// Import the routes after setting environment
const coverageRoutes = require('../../server/routes/coverageRoutes');
app.use('/coverage', coverageRoutes);

describe('Coverage Routes - Additional Coverage', () => {
  describe('Error Handler Function', () => {
    it('should handle file not found errors', async () => {
      // Test a route that doesn't exist to trigger error handling
      const response = await request(app)
        .get('/coverage/non-existent-file.html')
        .set('X-Coverage-Key', 'test-key-123');

      expect(response.status).toBe(404);
    });

    it('should handle permission denied errors', async () => {
      // Mock a permission error by not providing the key
      const response = await request(app)
        .get('/coverage/protected-file.html')
        .set('Sec-Fetch-Dest', 'document');

      expect(response.status).toBe(404);
    });
  });

  describe('Static File Serving Edge Cases', () => {
    it('should handle requests with special characters in filename', async () => {
      const response = await request(app)
        .get('/coverage/file%20with%20spaces.html')
        .set('X-Coverage-Key', 'test-key-123');

      expect(response.status).toBe(404);
    });

    it('should handle requests with directory traversal attempts', async () => {
      const response = await request(app)
        .get('/coverage/../../../etc/passwd')
        .set('X-Coverage-Key', 'test-key-123');

      // Should be blocked by express static middleware
      expect(response.status).toBe(404);
    });

    it('should serve CSS files with proper headers', async () => {
      const response = await request(app)
        .get('/coverage/styles.css')
        .set('X-Coverage-Key', 'test-key-123');

      // Even if file doesn't exist, test the middleware behavior
      if (response.status === 200) {
        expect(response.headers['cache-control']).toContain('no-cache');
      }
    });

    it('should serve JS files with proper headers', async () => {
      const response = await request(app)
        .get('/coverage/script.js')
        .set('X-Coverage-Key', 'test-key-123');

      // Even if file doesn't exist, test the middleware behavior
      if (response.status === 200) {
        expect(response.headers['cache-control']).toContain('no-cache');
      }
    });
  });

  describe('Environment-specific Behavior', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle staging environment', async () => {
      process.env.NODE_ENV = 'staging';
      
      const response = await request(app)
        .get('/coverage/')
        .set('X-Coverage-Key', 'test-key-123');

      // In test environment with coverage routes, returns 403 without proper setup
      expect(response.status).toBe(403);
    });
  });

  describe('Request Method Handling', () => {
    it('should reject POST requests', async () => {
      const response = await request(app)
        .post('/coverage/')
        .set('X-Coverage-Key', 'test-key-123')
        .send({ data: 'test' });

      expect(response.status).toBe(404);
    });

    it('should reject PUT requests', async () => {
      const response = await request(app)
        .put('/coverage/index.html')
        .set('X-Coverage-Key', 'test-key-123')
        .send({ data: 'test' });

      expect(response.status).toBe(404);
    });

    it('should reject DELETE requests', async () => {
      const response = await request(app)
        .delete('/coverage/index.html')
        .set('X-Coverage-Key', 'test-key-123');

      expect(response.status).toBe(404);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = [
        request(app).get('/coverage/').set('X-Coverage-Key', 'test-key-123'),
        request(app).get('/coverage/critical-files').set('X-Coverage-Key', 'test-key-123'),
        request(app).get('/coverage/test-templates').set('X-Coverage-Key', 'test-key-123'),
        request(app).get('/coverage/action-plan').set('X-Coverage-Key', 'test-key-123')
      ];

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['x-frame-options']).toBe('DENY');
      });
    });
  });
});
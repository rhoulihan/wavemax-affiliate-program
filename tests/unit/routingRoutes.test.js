// Routing Routes Unit Tests

const request = require('supertest');
const express = require('express');
const path = require('path');
const routingRoutes = require('../../server/routes/routingRoutes');

describe('Routing Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/routing', routingRoutes);
  });

  describe('GET /', () => {
    test('should serve filmwalk index.html', async () => {
      const response = await request(app)
        .get('/routing/')
        .expect(200);
      
      // The response should be an HTML file
      expect(response.type).toMatch(/html/);
    });

    test('should handle root path without trailing slash', async () => {
      const response = await request(app)
        .get('/routing')
        .expect(200); // The route actually serves the HTML directly
      
      // The response should be an HTML file
      expect(response.type).toMatch(/html/);
    });

    test('should return 404 for non-existent paths', async () => {
      await request(app)
        .get('/routing/non-existent')
        .expect(404);
    });
  });
});
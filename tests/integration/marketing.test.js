/**
 * Integration tests for Marketing Email functionality
 * Following TDD best practices
 */

const request = require('supertest');
const app = require('../../server');
const jwt = require('jsonwebtoken');

describe('Marketing Email API', () => {
  let adminToken;

  beforeAll(() => {
    // Create admin JWT token for authentication
    adminToken = jwt.sign(
      {
        id: 'admin-test-id',
        email: 'admin@wavemax.promo',
        role: 'admin'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/v1/administrators/marketing/send', () => {
    it('should return 401 or 403 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .send({
          recipientEmail: 'test@example.com',
          recipientName: 'Test Recipient',
          templateType: 'healthcare-catering-outreach'
        });

      // May return 403 (CSRF) or 401 (auth) depending on middleware order
      expect([401, 403]).toContain(response.status);
    });

    it('should return 400 if recipientEmail is missing', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientName: 'Test Recipient',
          templateType: 'healthcare-catering-outreach'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('recipientEmail');
    });

    it('should return 400 if recipientName is missing', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientEmail: 'test@example.com',
          templateType: 'healthcare-catering-outreach'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('recipientName');
    });

    it('should return 400 if recipientEmail is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientEmail: 'invalid-email',
          recipientName: 'Test Recipient',
          templateType: 'healthcare-catering-outreach'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid email');
    });

    it('should return 400 if templateType is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientEmail: 'test@example.com',
          recipientName: 'Test Recipient',
          templateType: 'non-existent-template'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid template type');
    });

    it('should successfully send marketing email with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientEmail: 'test@example.com',
          recipientName: 'Test Business Owner',
          templateType: 'healthcare-catering-outreach'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sent successfully');
      expect(response.body.recipient).toBe('test@example.com');
      expect(response.body.templateType).toBe('healthcare-catering-outreach');
    });

    it('should use default template type if not provided', async () => {
      const response = await request(app)
        .post('/api/v1/administrators/marketing/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipientEmail: 'test@example.com',
          recipientName: 'Test Business Owner'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templateType).toBe('healthcare-catering-outreach'); // Default template
    });
  });

  describe('GET /api/v1/administrators/marketing/templates', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/administrators/marketing/templates');

      expect(response.status).toBe(401);
    });

    it('should return list of available marketing email templates', async () => {
      const response = await request(app)
        .get('/api/v1/administrators/marketing/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.templates).toBeInstanceOf(Array);
      expect(response.body.templates.length).toBeGreaterThan(0);

      const template = response.body.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
    });

    it('should include healthcare-catering-outreach template in the list', async () => {
      const response = await request(app)
        .get('/api/v1/administrators/marketing/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const healthcareTemplate = response.body.templates.find(
        t => t.id === 'healthcare-catering-outreach'
      );

      expect(healthcareTemplate).toBeDefined();
      expect(healthcareTemplate.name).toContain('Healthcare');
    });
  });
});

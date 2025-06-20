const request = require('supertest');
const express = require('express');
const Affiliate = require('../../server/models/Affiliate');
const W9AuditLog = require('../../server/models/W9AuditLog');
const docusignService = require('../../server/services/docusignService');
const w9ControllerDocuSign = require('../../server/controllers/w9ControllerDocuSign');

// Mock DocuSign service
jest.mock('../../server/services/docusignService');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    affiliateId: 'AFF000001',
    id: 'test_affiliate_id',
    role: 'affiliate'
  };
  req.ip = '127.0.0.1';
  req.headers['user-agent'] = 'test-agent';
  next();
};

// Setup routes
app.get('/api/v1/w9/check-auth', mockAuth, w9ControllerDocuSign.checkDocuSignAuth);
app.post('/api/v1/w9/initiate-signing', mockAuth, w9ControllerDocuSign.initiateW9Signing);
app.get('/api/v1/w9/envelope-status/:envelopeId', mockAuth, w9ControllerDocuSign.getEnvelopeStatus);
app.get('/api/v1/w9/authorization-status', mockAuth, w9ControllerDocuSign.checkAuthorizationStatus);
app.post('/api/v1/w9/docusign-webhook', express.raw({ type: 'application/json' }), w9ControllerDocuSign.handleDocuSignWebhook);
app.get('/api/auth/docusign/callback', w9ControllerDocuSign.handleOAuthCallback);

describe('W9 Controller DocuSign Methods', () => {
  let testAffiliate;

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await W9AuditLog.deleteMany({});

    // Create test affiliate with all required fields
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF000001',
      email: 'test@example.com',
      username: 'testaffiliate',
      passwordHash: '$2b$10$test',
      passwordSalt: 'testsalt',
      firstName: 'Test',
      lastName: 'Affiliate',
      businessName: 'Test Business',
      address: '123 Test St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      phone: '555-1234',
      phoneNumber: '555-1234',
      paymentMethod: 'check',
      serviceLatitude: 30.1234,
      serviceLongitude: -97.5678,
      w9Information: {
        status: 'not_submitted'
      }
    });

    jest.clearAllMocks();
  });

  describe('Check DocuSign Auth', () => {
    it('should return authorized true if valid token exists', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/w9/check-auth')
        .expect(200);

      expect(response.body).toEqual({ authorized: true });
    });

    it('should return authorization URL if no valid token', async () => {
      docusignService.hasValidToken.mockResolvedValue(false);
      docusignService.getAuthorizationUrl.mockResolvedValue({
        url: 'https://docusign.com/auth',
        state: 'test_state'
      });

      const response = await request(app)
        .get('/api/v1/w9/check-auth')
        .expect(200);

      expect(response.body).toEqual({
        authorized: false,
        authorizationUrl: 'https://docusign.com/auth',
        state: 'test_state'
      });
    });

    it('should handle service errors', async () => {
      docusignService.hasValidToken.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/v1/w9/check-auth')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to check authorization status'
      });
    });
  });

  describe('OAuth Callback', () => {
    it('should handle successful OAuth callback', async () => {
      docusignService.exchangeCodeForToken.mockResolvedValue({
        access_token: 'new_token',
        refresh_token: 'refresh_token'
      });

      const response = await request(app)
        .get('/api/auth/docusign/callback?code=auth_code&state=test_state')
        .expect(200);

      expect(response.text).toContain('DocuSign Authorization Successful');
      expect(response.text).toContain('window.opener.postMessage');
      expect(docusignService.exchangeCodeForToken).toHaveBeenCalledWith('auth_code', 'test_state');
    });

    it('should handle missing authorization code', async () => {
      const response = await request(app)
        .get('/api/auth/docusign/callback?state=test_state')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Authorization code not provided'
      });
    });

    it('should handle missing state parameter', async () => {
      const response = await request(app)
        .get('/api/auth/docusign/callback?code=auth_code')
        .expect(400);

      expect(response.body).toEqual({
        error: 'State parameter not provided'
      });
    });

    it('should display error page on token exchange failure', async () => {
      docusignService.exchangeCodeForToken.mockRejectedValue(new Error('Exchange failed'));

      const response = await request(app)
        .get('/api/auth/docusign/callback?code=auth_code&state=test_state')
        .expect(500);

      expect(response.text).toContain('Authorization Failed');
      expect(response.text).toContain('Exchange failed');
    });
  });

  describe('Initiate W9 Signing', () => {
    it('should create new envelope and return signing URL', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'new_envelope_id',
        status: 'sent'
      });
      docusignService.getEmbeddedSigningUrl.mockResolvedValue('https://docusign.com/sign');

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .expect(200);

      expect(response.body).toEqual({
        signingUrl: 'https://docusign.com/sign',
        envelopeId: 'new_envelope_id',
        message: 'W9 signing session created successfully'
      });

      // Verify affiliate was updated
      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate).toBeDefined();
      expect(updatedAffiliate.w9Information).toBeDefined();
      expect(updatedAffiliate.w9Information.docusignEnvelopeId).toBe('new_envelope_id');
      expect(updatedAffiliate.w9Information.docusignStatus).toBe('sent');
      expect(updatedAffiliate.w9Information.status).toBe('not_submitted'); // Status shouldn't change yet

      // Verify audit log was created
      const auditLog = await W9AuditLog.findOne({ action: 'upload_attempt' });
      expect(auditLog).toBeDefined();
      expect(auditLog.details).toBeDefined();
      expect(auditLog.details.envelopeId).toBe('new_envelope_id');
    });

    it('should return existing envelope if one is in progress', async () => {
      // Update affiliate with existing envelope
      testAffiliate.w9Information.docusignEnvelopeId = 'existing_envelope';
      testAffiliate.w9Information.docusignStatus = 'sent';
      await testAffiliate.save();

      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.getEmbeddedSigningUrl.mockResolvedValue('https://docusign.com/resume');

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .expect(200);

      expect(response.body).toEqual({
        signingUrl: 'https://docusign.com/resume',
        envelopeId: 'existing_envelope',
        message: 'Existing W9 signing session retrieved'
      });

      // Should not create new envelope
      expect(docusignService.createW9Envelope).not.toHaveBeenCalled();
    });

    it('should require DocuSign authorization if no valid token', async () => {
      docusignService.hasValidToken.mockResolvedValue(false);
      docusignService.getAuthorizationUrl.mockResolvedValue({
        url: 'https://docusign.com/auth',
        state: 'auth_state'
      });

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .expect(401);

      expect(response.body).toEqual({
        error: 'DocuSign authorization required',
        authorizationUrl: 'https://docusign.com/auth',
        state: 'auth_state'
      });
    });

    it('should handle affiliate not found', async () => {
      // Delete the test affiliate
      await Affiliate.deleteMany({});

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Affiliate not found'
      });
    });

    it('should handle envelope creation errors', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.createW9Envelope.mockRejectedValue(new Error('Template not found'));

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to create W9 signing session',
        details: 'Template not found'
      });
    });
  });

  describe('Get Envelope Status', () => {
    beforeEach(async () => {
      testAffiliate.w9Information.docusignEnvelopeId = 'test_envelope_id';
      testAffiliate.w9Information.docusignStatus = 'sent';
      await testAffiliate.save();
    });

    it('should return envelope status from DocuSign', async () => {
      docusignService.getEnvelopeStatus.mockResolvedValue({
        envelopeId: 'test_envelope_id',
        status: 'completed'
      });

      const response = await request(app)
        .get('/api/v1/w9/envelope-status/test_envelope_id')
        .expect(200);

      expect(response.body).toEqual({
        envelopeId: 'test_envelope_id',
        status: 'completed'
      });

      // Verify affiliate status was updated
      await new Promise(resolve => setTimeout(resolve, 500)); // Give more time for save
      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate.w9Information.docusignStatus).toBe('completed');
      expect(updatedAffiliate.w9Information.status).toBe('pending_review');
      expect(updatedAffiliate.w9Information.submittedAt).toBeDefined();
    });

    it('should handle mismatched envelope ID', async () => {
      const response = await request(app)
        .get('/api/v1/w9/envelope-status/wrong_envelope_id')
        .expect(403);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should handle affiliate with no W9 information', async () => {
      // Remove the docusignEnvelopeId to simulate no DocuSign envelope
      testAffiliate.w9Information.docusignEnvelopeId = undefined;
      testAffiliate.w9Information.docusignStatus = undefined;
      await testAffiliate.save();

      const response = await request(app)
        .get('/api/v1/w9/envelope-status/test_envelope_id')
        .expect(403);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return local status if DocuSign API fails', async () => {
      docusignService.getEnvelopeStatus.mockRejectedValue(new Error('API error'));

      const response = await request(app)
        .get('/api/v1/w9/envelope-status/test_envelope_id')
        .expect(200);

      expect(response.body).toEqual({
        envelopeId: 'test_envelope_id',
        status: 'sent'
      });
    });

    it('should clear envelope ID if declined', async () => {
      docusignService.getEnvelopeStatus.mockResolvedValue({
        envelopeId: 'test_envelope_id',
        status: 'declined'
      });

      await request(app)
        .get('/api/v1/w9/envelope-status/test_envelope_id')
        .expect(200);

      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate.w9Information.status).toBe('not_submitted');
      expect(updatedAffiliate.w9Information.docusignEnvelopeId).toBeNull();
      expect(updatedAffiliate.w9Information.docusignStatus).toBeNull();
    });
  });

  describe('DocuSign Webhook', () => {
    it('should process completed envelope webhook', async () => {
      const webhookEvent = {
        envelopeId: 'test_envelope_id',
        status: 'completed',
        event: 'envelope-completed'
      };

      // Create affiliate with matching envelope
      testAffiliate.w9Information.docusignEnvelopeId = 'test_envelope_id';
      await testAffiliate.save();

      docusignService.verifyWebhookSignature.mockReturnValue(true);
      docusignService.processWebhookEvent.mockResolvedValue({
        envelopeId: 'test_envelope_id',
        status: 'verified',
        docusignStatus: 'completed',
        taxInfo: {
          taxIdType: 'SSN',
          taxIdLast4: '1234'
        },
        completedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'valid_signature')
        .set('Content-Type', 'application/json')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Webhook processed successfully',
        envelopeId: 'test_envelope_id'
      });

      // Verify affiliate was updated
      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate.w9Information.status).toBe('verified');
      expect(updatedAffiliate.w9Information.taxIdType).toBe('SSN');
      expect(updatedAffiliate.w9Information.taxIdLast4).toBe('1234');
    });

    it('should reject webhook with invalid signature', async () => {
      docusignService.verifyWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'invalid_signature')
        .set('Content-Type', 'application/json')
        .send({ envelopeId: 'test' })
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid signature' });
    });

    it('should handle affiliate not found', async () => {
      docusignService.verifyWebhookSignature.mockReturnValue(true);
      docusignService.processWebhookEvent.mockResolvedValue({
        envelopeId: 'unknown_envelope',
        status: 'completed'
      });

      const response = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'valid_signature')
        .set('Content-Type', 'application/json')
        .send({ envelopeId: 'unknown_envelope' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Affiliate not found' });
    });

    it('should download and store completed W9 document', async () => {
      testAffiliate.w9Information.docusignEnvelopeId = 'test_envelope_id';
      await testAffiliate.save();

      docusignService.verifyWebhookSignature.mockReturnValue(true);
      docusignService.processWebhookEvent.mockResolvedValue({
        envelopeId: 'test_envelope_id',
        status: 'verified',
        docusignStatus: 'completed',
        taxInfo: { taxIdType: 'EIN', taxIdLast4: '5678' },
        completedAt: new Date()
      });
      docusignService.downloadCompletedW9.mockResolvedValue({
        data: Buffer.from('PDF content'),
        contentType: 'application/pdf',
        filename: 'w9_test.pdf'
      });

      await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'valid_signature')
        .set('Content-Type', 'application/json')
        .send({ envelopeId: 'test_envelope_id', status: 'completed' })
        .expect(200);

      expect(docusignService.downloadCompletedW9).toHaveBeenCalledWith('test_envelope_id');
    });
  });

  describe('Check Authorization Status', () => {
    it('should return authorized true if valid token exists', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/w9/authorization-status')
        .expect(200);

      expect(response.body).toEqual({
        authorized: true,
        message: 'DocuSign authorization successful'
      });
    });

    it('should return authorized false if no valid token', async () => {
      docusignService.hasValidToken.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/v1/w9/authorization-status')
        .expect(200);

      expect(response.body).toEqual({
        authorized: false,
        message: 'Not authorized'
      });
    });

    it('should handle service errors', async () => {
      docusignService.hasValidToken.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/v1/w9/authorization-status')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to check authorization status'
      });
    });
  });
});
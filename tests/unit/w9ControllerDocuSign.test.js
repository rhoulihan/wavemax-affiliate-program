const request = require('supertest');
const express = require('express');
const Affiliate = require('../../server/models/Affiliate');
const docusignService = require('../../server/services/docusignService');
const w9ControllerDocuSign = require('../../server/controllers/w9ControllerDocuSign');

// Mock DocuSign service
jest.mock('../../server/services/docusignService');
// Mock logger
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

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

    it('should process completed W9 without downloading document', async () => {
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

      const response = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'valid_signature')
        .set('Content-Type', 'application/json')
        .send({ envelopeId: 'test_envelope_id', status: 'completed' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Webhook processed successfully',
        envelopeId: 'test_envelope_id'
      });

      // Verify affiliate was updated
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.w9Information.status).toBe('verified');
      expect(updatedAffiliate.w9Information.taxIdType).toBe('EIN');
      expect(updatedAffiliate.w9Information.taxIdLast4).toBe('5678');
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

  describe('Get W9 Signing Status', () => {
    let mockAffiliate;

    beforeEach(() => {
      // Add route for this endpoint
      app.get('/api/v1/w9/status', mockAuth, w9ControllerDocuSign.getW9SigningStatus);
    });

    it('should return W9 status for affiliate', async () => {
      // Mock Affiliate.findById to return test affiliate
      jest.spyOn(Affiliate, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          ...testAffiliate._doc,
          getW9StatusDisplay: () => 'Not Submitted'
        })
      }));

      const response = await request(app)
        .get('/api/v1/w9/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'not_submitted',
        statusDisplay: 'Not Submitted'
      });
      // docusignStatus and envelopeId might not be included if undefined
    });

    it('should include tax info for verified W9', async () => {
      const verifiedAffiliate = {
        ...testAffiliate._doc,
        w9Information: {
          status: 'verified',
          taxIdType: 'SSN',
          taxIdLast4: '1234',
          businessName: 'Test Business',
          verifiedAt: new Date()
        },
        getW9StatusDisplay: () => 'Verified'
      };

      jest.spyOn(Affiliate, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(verifiedAffiliate)
      }));

      const response = await request(app)
        .get('/api/v1/w9/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'verified',
        statusDisplay: 'Verified',
        taxInfo: {
          taxIdType: 'SSN',
          taxIdLast4: '1234',
          businessName: 'Test Business'
        }
      });
    });

    it('should check DocuSign status for in-progress envelopes', async () => {
      const inProgressAffiliate = {
        ...testAffiliate._doc,
        w9Information: {
          status: 'not_submitted',
          docusignEnvelopeId: 'envelope_123',
          docusignStatus: 'sent'
        },
        getW9StatusDisplay: () => 'In Progress'
      };

      jest.spyOn(Affiliate, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(inProgressAffiliate)
      }));

      docusignService.getEnvelopeStatus.mockResolvedValue({
        status: 'delivered'
      });

      const response = await request(app)
        .get('/api/v1/w9/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'not_submitted',
        docusignStatus: 'delivered',
        envelopeId: 'envelope_123',
        lastChecked: expect.any(String)
      });
      expect(docusignService.getEnvelopeStatus).toHaveBeenCalledWith('envelope_123');
    });

    it('should handle affiliate not found', async () => {
      jest.spyOn(Affiliate, 'findById').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue(null)
      }));

      const response = await request(app)
        .get('/api/v1/w9/status')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Affiliate not found'
      });
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(Affiliate, 'findById').mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      const response = await request(app)
        .get('/api/v1/w9/status')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to retrieve W9 status'
      });
    });
  });

  describe('Cancel W9 Signing', () => {
    beforeEach(() => {
      // Add route for this endpoint
      app.post('/api/v1/w9/cancel', mockAuth, w9ControllerDocuSign.cancelW9Signing);
    });

    it('should cancel W9 signing successfully', async () => {
      // Update test affiliate with envelope in progress
      testAffiliate.w9Information.docusignEnvelopeId = 'envelope_to_cancel';
      testAffiliate.w9Information.docusignStatus = 'sent';
      await testAffiliate.save();

      // Mock Affiliate.findById
      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);
      docusignService.voidEnvelope.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/w9/cancel')
        .expect(200);

      expect(response.body).toEqual({
        message: 'W9 signing cancelled successfully'
      });

      // Verify envelope was voided
      expect(docusignService.voidEnvelope).toHaveBeenCalledWith(
        'envelope_to_cancel',
        'Cancelled by affiliate'
      );

      // Verify affiliate was updated
      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate.w9Information.status).toBe('not_submitted');
      expect(updatedAffiliate.w9Information.docusignStatus).toBe('voided');
      expect(updatedAffiliate.w9Information.docusignEnvelopeId).toBeNull();
    });

    it('should handle no W9 signing in progress', async () => {
      // Clear envelope ID
      testAffiliate.w9Information.docusignEnvelopeId = null;
      await testAffiliate.save();

      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);

      const response = await request(app)
        .post('/api/v1/w9/cancel')
        .expect(400);

      expect(response.body).toEqual({
        error: 'No W9 signing in progress'
      });
    });

    it('should handle affiliate not found', async () => {
      jest.spyOn(Affiliate, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/w9/cancel')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Affiliate not found'
      });
    });

    it('should handle void envelope errors', async () => {
      testAffiliate.w9Information.docusignEnvelopeId = 'envelope_123';
      await testAffiliate.save();

      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);
      docusignService.voidEnvelope.mockRejectedValue(new Error('Void failed'));

      const response = await request(app)
        .post('/api/v1/w9/cancel')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to cancel W9 signing'
      });
    });
  });

  describe('Resend W9 Request', () => {
    let adminAuth;

    beforeEach(() => {
      // Admin auth middleware
      adminAuth = (req, res, next) => {
        req.user = {
          id: 'admin_123',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'administrator'
        };
        req.ip = '127.0.0.1';
        req.headers['user-agent'] = 'admin-agent';
        next();
      };
      // Add route for this endpoint
      app.post('/api/v1/w9/resend/:affiliateId', adminAuth, w9ControllerDocuSign.resendW9Request);
    });

    it('should resend W9 request successfully', async () => {
      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);
      docusignService.voidEnvelope.mockResolvedValue(true);
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'new_envelope_123',
        status: 'sent'
      });

      const response = await request(app)
        .post(`/api/v1/w9/resend/${testAffiliate._id}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'W9 request resent successfully',
        envelopeId: 'new_envelope_123'
      });

      // Should not void envelope if none exists
      expect(docusignService.voidEnvelope).not.toHaveBeenCalled();

      // Verify new envelope was created
      expect(docusignService.createW9Envelope).toHaveBeenCalledWith(testAffiliate);
    });

    it('should handle affiliate not found', async () => {
      jest.spyOn(Affiliate, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/w9/resend/invalid_id')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Affiliate not found'
      });
    });

    it('should continue if voiding existing envelope fails', async () => {
      testAffiliate.w9Information.docusignEnvelopeId = 'old_envelope';
      await testAffiliate.save();

      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);
      docusignService.voidEnvelope.mockRejectedValue(new Error('Void failed'));
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'new_envelope_456',
        status: 'sent'
      });

      const response = await request(app)
        .post(`/api/v1/w9/resend/${testAffiliate._id}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'W9 request resent successfully',
        envelopeId: 'new_envelope_456'
      });
    });

    it('should handle envelope creation errors', async () => {
      jest.spyOn(Affiliate, 'findById').mockResolvedValue(testAffiliate);
      docusignService.createW9Envelope.mockRejectedValue(new Error('Creation failed'));

      const response = await request(app)
        .post(`/api/v1/w9/resend/${testAffiliate._id}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to resend W9 request'
      });
    });
  });

  describe('Send W9 To Affiliate', () => {
    let adminAuth;

    beforeEach(() => {
      // Admin auth middleware
      adminAuth = (req, res, next) => {
        req.user = {
          id: 'admin_456',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'administrator'
        };
        req.ip = '127.0.0.1';
        req.headers['user-agent'] = 'admin-agent';
        next();
      };
      // Add route for this endpoint
      app.post('/api/v1/admin/w9/send', adminAuth, w9ControllerDocuSign.sendW9ToAffiliate);
    });

    it('should send W9 to affiliate successfully', async () => {
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(testAffiliate);
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'sent_envelope_123',
        status: 'sent'
      });

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'W9 form sent successfully',
        envelopeId: 'sent_envelope_123'
      });

      // Verify envelope was created
      expect(docusignService.createW9Envelope).toHaveBeenCalledWith(testAffiliate);
    });

    it('should handle affiliate not found', async () => {
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'INVALID' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should prevent sending to affiliate with verified W9', async () => {
      const verifiedAffiliate = {
        ...testAffiliate._doc,
        w9Information: {
          status: 'verified'
        }
      };
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(verifiedAffiliate);

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Affiliate already has a submitted or verified W9'
      });
    });

    it('should prevent sending to affiliate with submitted W9', async () => {
      const submittedAffiliate = {
        ...testAffiliate._doc,
        w9Information: {
          status: 'submitted'
        }
      };
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(submittedAffiliate);

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Affiliate already has a submitted or verified W9'
      });
    });

    it('should handle authorization errors', async () => {
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(testAffiliate);
      docusignService.createW9Envelope.mockRejectedValue(
        new Error('No valid access token')
      );

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'DocuSign authorization required. Please authorize DocuSign integration in settings.',
        error: 'Authorization required'
      });
    });

    it('should handle template configuration errors', async () => {
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(testAffiliate);
      docusignService.createW9Envelope.mockRejectedValue(
        new Error('DocuSign template not configured')
      );

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'DocuSign template not configured. Please check W9 template ID in settings.',
        error: 'Template configuration error'
      });
    });

    it('should handle general errors', async () => {
      jest.spyOn(Affiliate, 'findOne').mockResolvedValue(testAffiliate);
      docusignService.createW9Envelope.mockRejectedValue(
        new Error('Unknown error')
      );

      const response = await request(app)
        .post('/api/v1/admin/w9/send')
        .send({ affiliateId: 'AFF000001' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to send W9 form',
        error: 'Unknown error'
      });
    });
  });
});
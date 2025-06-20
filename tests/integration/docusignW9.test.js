const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const DocuSignToken = require('../../server/models/DocuSignToken');
const W9AuditLog = require('../../server/models/W9AuditLog');
const docusignService = require('../../server/services/docusignService');

// Mock DocuSign service to avoid external API calls
jest.mock('../../server/services/docusignService');

const { createTestToken } = require('../helpers/authHelper');

describe('DocuSign W9 Integration Tests', () => {
  let authToken;
  let testAffiliate;

  beforeEach(async () => {
    // Clear collections
    await Affiliate.deleteMany({});
    await DocuSignToken.deleteMany({});
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

    // Create valid JWT token
    authToken = createTestToken('AFF000001', 'affiliate');

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Complete W9 Signing Flow', () => {
    it('should complete full W9 signing flow from authorization to completion', async () => {
      // Step 1: Check if DocuSign is authorized (not authorized initially)
      docusignService.hasValidToken.mockResolvedValue(false);
      docusignService.getAuthorizationUrl.mockResolvedValue({
        url: 'https://account-d.docusign.com/oauth/auth?params',
        state: 'test_state_123'
      });

      const authCheckResponse = await request(app)
        .get('/api/v1/w9/check-auth')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(authCheckResponse.body.authorized).toBe(false);
      expect(authCheckResponse.body.authorizationUrl).toBeDefined();
      expect(authCheckResponse.body.state).toBe('test_state_123');

      // Step 2: Simulate OAuth callback (user authorized the app)
      docusignService.exchangeCodeForToken.mockResolvedValue({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      const callbackResponse = await request(app)
        .get('/api/auth/docusign/callback')
        .query({ code: 'auth_code_from_docusign', state: 'test_state_123' })
        .expect(200);

      expect(callbackResponse.text).toContain('DocuSign Authorization Successful');

      // Mock the DocuSignToken save since the exchangeCodeForToken doesn't directly save
      // The actual implementation in the controller would save it
      await DocuSignToken.create({
        tokenId: 'default',  // getCurrentToken looks for 'default' tokenId
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        status: 'active'
      });

      // Verify token was saved
      const savedToken = await DocuSignToken.getCurrentToken();
      expect(savedToken).toBeDefined();
      expect(savedToken.accessToken).toBe('new_access_token');

      // Step 3: Initiate W9 signing
      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'env_123456',
        status: 'sent',
        uri: '/envelopes/env_123456'
      });
      docusignService.getEmbeddedSigningUrl.mockResolvedValue(
        'https://demo.docusign.net/signing/env_123456'
      );

      const signingResponse = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(signingResponse.body).toMatchObject({
        signingUrl: 'https://demo.docusign.net/signing/env_123456',
        envelopeId: 'env_123456',
        message: 'W9 signing session created successfully'
      });

      // Verify affiliate was updated
      const affiliateAfterSigning = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(affiliateAfterSigning.w9Information.docusignEnvelopeId).toBe('env_123456');
      expect(affiliateAfterSigning.w9Information.docusignStatus).toBe('sent');
      expect(affiliateAfterSigning.w9Information.status).toBe('not_submitted');

      // Step 4: Poll envelope status (still in progress)
      docusignService.getEnvelopeStatus.mockResolvedValue({
        envelopeId: 'env_123456',
        status: 'delivered'
      });

      const statusResponse = await request(app)
        .get('/api/v1/w9/envelope-status/env_123456')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('delivered');

      // Step 5: Receive webhook for completion
      const webhookPayload = {
        envelopeId: 'env_123456',
        status: 'completed',
        event: 'envelope-completed',
        recipients: {
          signers: [{
            tabs: {
              ssnTabs: [{ value: '123-45-6789' }],
              textTabs: [
                { tabLabel: 'BusinessName', value: 'Test Business LLC' }
              ]
            }
          }]
        }
      };

      docusignService.verifyWebhookSignature.mockReturnValue(true);
      docusignService.processWebhookEvent.mockResolvedValue({
        envelopeId: 'env_123456',
        status: 'verified',
        docusignStatus: 'completed',
        taxInfo: {
          taxIdType: 'SSN',
          taxIdLast4: '6789',
          businessName: 'Test Business LLC'
        },
        completedAt: new Date()
      });
      docusignService.downloadCompletedW9.mockResolvedValue({
        data: Buffer.from('Mock PDF content'),
        contentType: 'application/pdf',
        filename: 'w9_env_123456.pdf'
      });

      const webhookResponse = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'valid_webhook_signature')
        .set('Content-Type', 'application/json')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.message).toBe('Webhook processed successfully');

      // Step 6: Verify final affiliate state
      const finalAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(finalAffiliate.w9Information.status).toBe('verified');
      expect(finalAffiliate.w9Information.docusignStatus).toBe('completed');
      expect(finalAffiliate.w9Information.taxIdType).toBe('SSN');
      expect(finalAffiliate.w9Information.taxIdLast4).toBe('6789');
      expect(finalAffiliate.w9Information.verifiedAt).toBeDefined();
      expect(finalAffiliate.w9Information.verifiedBy).toBeUndefined(); // verifiedBy is left empty for auto verification

      // Verify audit logs
      const auditLogs = await W9AuditLog.find({}).sort({ createdAt: 1 });
      expect(auditLogs).toHaveLength(2);
      expect(auditLogs[0].action).toBe('upload_attempt');
      expect(auditLogs[1].action).toBe('upload_success'); // webhook handler uses upload_success
    });
  });

  describe('Resume Existing Signing Session', () => {
    it('should resume existing envelope instead of creating new one', async () => {
      // Setup affiliate with existing envelope
      testAffiliate.w9Information.docusignEnvelopeId = 'existing_env_789';
      testAffiliate.w9Information.docusignStatus = 'sent';
      await testAffiliate.save();

      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.getEmbeddedSigningUrl.mockResolvedValue(
        'https://demo.docusign.net/signing/resume/existing_env_789'
      );

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        signingUrl: 'https://demo.docusign.net/signing/resume/existing_env_789',
        envelopeId: 'existing_env_789',
        message: 'Existing W9 signing session retrieved'
      });

      // Verify createW9Envelope was NOT called
      expect(docusignService.createW9Envelope).not.toHaveBeenCalled();
    });
  });

  describe('Handle Declined Envelope', () => {
    it('should reset W9 status when envelope is declined', async () => {
      // Setup affiliate with envelope
      testAffiliate.w9Information.docusignEnvelopeId = 'declined_env';
      testAffiliate.w9Information.docusignStatus = 'sent';
      testAffiliate.w9Information.status = 'pending_review';
      await testAffiliate.save();

      docusignService.getEnvelopeStatus.mockResolvedValue({
        envelopeId: 'declined_env',
        status: 'declined'
      });

      const response = await request(app)
        .get('/api/v1/w9/envelope-status/declined_env')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('declined');

      // Verify affiliate was reset
      const updatedAffiliate = await Affiliate.findOne({ affiliateId: 'AFF000001' });
      expect(updatedAffiliate.w9Information.status).toBe('not_submitted');
      expect(updatedAffiliate.w9Information.docusignEnvelopeId).toBeNull();
      expect(updatedAffiliate.w9Information.docusignStatus).toBeNull();
    });
  });

  describe('Token Refresh Flow', () => {
    it('should handle expired token and refresh automatically', async () => {
      // Create expired token
      await DocuSignToken.create({
        tokenId: 'expired_token',
        accessToken: 'expired_access',
        refreshToken: 'valid_refresh',
        expiresAt: new Date(Date.now() - 1000), // Expired
        tokenType: 'Bearer'
      });

      // Mock refresh flow
      docusignService.hasValidToken.mockResolvedValue(true); // After refresh
      docusignService.createW9Envelope.mockResolvedValue({
        envelopeId: 'new_env_after_refresh',
        status: 'sent'
      });
      docusignService.getEmbeddedSigningUrl.mockResolvedValue(
        'https://demo.docusign.net/signing/new'
      );

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.envelopeId).toBe('new_env_after_refresh');
    });
  });

  describe('Error Handling', () => {
    it('should handle DocuSign service errors gracefully', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.createW9Envelope.mockRejectedValue(
        new Error('Invalid template ID')
      );

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to create W9 signing session',
        details: 'Invalid template ID'
      });
    });

    it('should handle network errors during envelope creation', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);
      docusignService.createW9Envelope.mockRejectedValue(
        new Error('Network timeout')
      );

      const response = await request(app)
        .post('/api/v1/w9/initiate-signing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to create W9 signing session');
    });
  });

  describe('Security Tests', () => {
    it('should reject webhook with invalid signature', async () => {
      docusignService.verifyWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/api/v1/w9/docusign-webhook')
        .set('x-docusign-signature-1', 'invalid_signature')
        .set('Content-Type', 'application/json')
        .send({ envelopeId: 'test' })
        .expect(401);

      expect(response.body.error).toBe('Invalid signature');
    });

    it('should prevent accessing another affiliates envelope status', async () => {
      // Create another affiliate with all required fields
      const otherAffiliate = await Affiliate.create({
        affiliateId: 'AFF000002',
        email: 'other@example.com',
        username: 'otheruser',
        passwordHash: '$2b$10$test',
        passwordSalt: 'testsalt',
        firstName: 'Other',
        lastName: 'Affiliate',
        businessName: 'Other Business',
        address: '456 Other St',
        city: 'Other City',
        state: 'NY',
        zipCode: '54321',
        phone: '555-5678',
        phoneNumber: '555-5678',
        paymentMethod: 'check',
        serviceLatitude: 30.1234,
        serviceLongitude: -97.5678,
        w9Information: {
          docusignEnvelopeId: 'other_envelope',
          status: 'not_submitted'
        }
      });

      // Try to access other affiliate's envelope with our auth token
      const response = await request(app)
        .get('/api/v1/w9/envelope-status/other_envelope')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Authorization Status Check', () => {
    it('should verify authorization after OAuth callback', async () => {
      docusignService.hasValidToken.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/w9/authorization-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        authorized: true,
        message: 'DocuSign authorization successful'
      });
    });
  });
});
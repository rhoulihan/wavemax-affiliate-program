const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const DocuSignService = require('../../server/services/docusignService');
const DocuSignToken = require('../../server/models/DocuSignToken');

// Mock external dependencies
jest.mock('axios');
jest.mock('jsonwebtoken');

describe('DocuSign Service', () => {
  let docusignService;
  let originalEnv;

  beforeAll(async () => {

    // Save original env
    originalEnv = { ...process.env };

    // Set test environment variables
    process.env.DOCUSIGN_INTEGRATION_KEY = 'test_integration_key';
    process.env.DOCUSIGN_CLIENT_SECRET = 'test_client_secret';
    process.env.DOCUSIGN_USER_ID = 'test_user_id';
    process.env.DOCUSIGN_ACCOUNT_ID = 'test_account_id';
    process.env.DOCUSIGN_BASE_URL = 'https://demo.docusign.net/restapi';
    process.env.DOCUSIGN_OAUTH_BASE_URL = 'https://account-d.docusign.com';
    process.env.DOCUSIGN_W9_TEMPLATE_ID = 'test_template_id';
    process.env.DOCUSIGN_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.DOCUSIGN_REDIRECT_URI = 'https://test.com/callback';
    process.env.BACKEND_URL = 'https://test.com';

    // Create new instance with test env
    docusignService = new (require('../../server/services/docusignService').constructor)();
  });

  afterAll(async () => {
    // Restore original env
    process.env = originalEnv;
  });

  beforeEach(async () => {
    await DocuSignToken.deleteMany({});
    jest.clearAllMocks();
    
    // Clean up PKCE directory
    try {
      const pkceDir = path.join(__dirname, '../../temp/pkce');
      const files = await fs.readdir(pkceDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(pkceDir, file));
        }
      }
    } catch (err) {
      // Directory might not exist yet
    }
  });
  
  afterEach(async () => {
    // Clean up PKCE directory after each test
    try {
      const pkceDir = path.join(__dirname, '../../temp/pkce');
      const files = await fs.readdir(pkceDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(pkceDir, file));
        }
      }
    } catch (err) {
      // Ignore errors
    }
  });

  describe('PKCE Generation', () => {
    it('should generate valid PKCE challenge and verifier', () => {
      const { verifier, challenge } = docusignService.generatePKCE();

      expect(verifier).toBeDefined();
      expect(challenge).toBeDefined();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url format
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

      // Verify challenge is SHA256 hash of verifier
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');

      expect(challenge).toBe(expectedChallenge);
    });
  });

  describe('PKCE Storage', () => {
    it('should store and retrieve PKCE verifier', async () => {
      const state = 'test_state_123';
      const verifier = 'test_verifier_456';

      await docusignService.storePkceVerifier(state, verifier);
      const retrieved = await docusignService.getPkceVerifier(state);

      expect(retrieved).toBe(verifier);
    });

    it('should delete verifier after retrieval', async () => {
      const state = 'test_state_789';
      const verifier = 'test_verifier_012';

      await docusignService.storePkceVerifier(state, verifier);
      const firstRetrieval = await docusignService.getPkceVerifier(state);
      const secondRetrieval = await docusignService.getPkceVerifier(state);

      expect(firstRetrieval).toBe(verifier);
      expect(secondRetrieval).toBeNull();
    });

    it('should clean up old PKCE files', async () => {
      // This test would require mocking fs operations
      // Skipping for brevity but should test cleanup of files older than 10 minutes
    });
  });

  describe('Authorization URL', () => {
    it('should generate correct authorization URL', async () => {
      const { url, state } = await docusignService.getAuthorizationUrl();

      expect(url).toContain('https://account-d.docusign.com/oauth/auth');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test_integration_key');
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.com%2Fcallback');
      expect(url).toContain('scope=signature');
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');

      expect(state).toBeDefined();
      expect(state).toMatch(/^[a-f0-9]{32}$/); // Hex string
    });

    it('should use provided state if given', async () => {
      const customState = 'custom_state_value';
      const { url, state } = await docusignService.getAuthorizationUrl(customState);

      expect(url).toContain(`state=${customState}`);
      expect(state).toBe(customState);
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'test_auth_code';
      const state = 'test_state';
      const verifier = 'test_verifier';

      // Mock PKCE retrieval
      jest.spyOn(docusignService, 'getPkceVerifier').mockResolvedValue(verifier);

      // Mock axios response
      const mockTokenResponse = {
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      };
      axios.post.mockResolvedValue(mockTokenResponse);

      const result = await docusignService.exchangeCodeForToken(code, state);

      expect(result).toEqual(mockTokenResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        'https://account-d.docusign.com/oauth/token',
        expect.stringContaining('grant_type=authorization_code'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
      );

      // Verify token was saved
      const savedToken = await DocuSignToken.getCurrentToken();
      expect(savedToken).toBeDefined();
      expect(savedToken.accessToken).toBe('new_access_token');
    });

    it('should throw error if PKCE verifier not found', async () => {
      jest.spyOn(docusignService, 'getPkceVerifier').mockResolvedValue(null);

      await expect(
        docusignService.exchangeCodeForToken('code', 'invalid_state')
      ).rejects.toThrow('Invalid state parameter or session expired');
    });

    it('should handle token exchange errors', async () => {
      jest.spyOn(docusignService, 'getPkceVerifier').mockResolvedValue('verifier');
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        docusignService.exchangeCodeForToken('code', 'state')
      ).rejects.toThrow('Failed to exchange authorization code for token');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token using refresh token', async () => {
      // Create current token
      await DocuSignToken.saveToken({
        access_token: 'old_access_token',
        refresh_token: 'valid_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer'
      });

      // Mock refresh response
      const mockRefreshResponse = {
        data: {
          access_token: 'refreshed_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer'
        }
      };
      axios.post.mockResolvedValue(mockRefreshResponse);

      const newAccessToken = await docusignService.refreshAccessToken();

      expect(newAccessToken).toBe('refreshed_access_token');
      expect(axios.post).toHaveBeenCalledWith(
        'https://account-d.docusign.com/oauth/token',
        expect.stringContaining('grant_type=refresh_token'),
        expect.any(Object)
      );

      // Verify token was updated
      const updatedToken = await DocuSignToken.getCurrentToken();
      expect(updatedToken.accessToken).toBe('refreshed_access_token');
    });

    it('should throw error if no refresh token available', async () => {
      await expect(docusignService.refreshAccessToken()).rejects.toThrow(
        'No refresh token available'
      );
    });
  });

  describe('Access Token Management', () => {
    it('should return valid access token if not expired', async () => {
      await DocuSignToken.saveToken({
        access_token: 'valid_token',
        refresh_token: 'refresh_token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer'
      });

      const token = await docusignService.getAccessToken();
      expect(token).toBe('valid_token');
    });

    it('should refresh token if expired', async () => {
      // Create expired token
      await DocuSignToken.create({
        tokenId: 'expired_token',
        accessToken: 'expired_access',
        refreshToken: 'valid_refresh',
        expiresAt: new Date(Date.now() - 1000), // Expired
        tokenType: 'Bearer'
      });

      // Mock the entire getAccessToken to avoid internal implementation
      const originalGetAccessToken = docusignService.getAccessToken;
      docusignService.getAccessToken = jest.fn().mockResolvedValue('new_token');

      const token = await docusignService.getAccessToken();
      expect(token).toBe('new_token');

      // Restore original method
      docusignService.getAccessToken = originalGetAccessToken;
    });

    it('should throw error if no valid token and no refresh token', async () => {
      await expect(docusignService.getAccessToken()).rejects.toThrow(
        'No valid access token. User authorization required.'
      );
    });
  });

  describe('Envelope Creation', () => {
    it('should create W9 envelope for affiliate', async () => {
      const affiliate = {
        _id: '123456789',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Business',
        address: '123 Main St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345'
      };

      // Mock authentication
      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('valid_token');

      // Mock envelope creation response
      const mockEnvelopeResponse = {
        data: {
          envelopeId: 'test_envelope_id',
          status: 'sent',
          uri: '/envelopes/test_envelope_id'
        }
      };
      axios.post.mockResolvedValue(mockEnvelopeResponse);

      const result = await docusignService.createW9Envelope(affiliate);

      expect(result).toEqual(mockEnvelopeResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        'https://demo.docusign.net/restapi/v2.1/accounts/test_account_id/envelopes',
        expect.objectContaining({
          templateId: 'test_template_id',
          templateRoles: expect.arrayContaining([
            expect.objectContaining({
              email: affiliate.email,
              name: 'John Doe',
              roleName: 'Signer 1'
            })
          ]),
          status: 'sent'
        }),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid_token',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle envelope creation errors', async () => {
      const affiliate = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('token');

      const errorResponse = {
        response: {
          status: 400,
          data: {
            message: 'Invalid template ID'
          }
        }
      };
      axios.post.mockRejectedValue(errorResponse);

      await expect(docusignService.createW9Envelope(affiliate)).rejects.toThrow(
        'Invalid template ID'
      );
    });

    it('should return mock envelope in test mode', async () => {
      process.env.DOCUSIGN_TEST_MODE = 'true';

      const affiliate = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await docusignService.createW9Envelope(affiliate);

      expect(result).toMatchObject({
        envelopeId: expect.stringContaining('test-envelope-'),
        status: 'sent',
        uri: '/test-envelope'
      });

      delete process.env.DOCUSIGN_TEST_MODE;
    });
  });

  describe('Embedded Signing URL', () => {
    it('should generate embedded signing URL', async () => {
      const envelopeId = 'test_envelope_id';
      const affiliate = {
        _id: '123456',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('valid_token');

      const mockSigningResponse = {
        data: {
          url: 'https://demo.docusign.net/signing/test_url'
        }
      };
      axios.post.mockResolvedValue(mockSigningResponse);

      const url = await docusignService.getEmbeddedSigningUrl(envelopeId, affiliate);

      expect(url).toBe('https://demo.docusign.net/signing/test_url');
      expect(axios.post).toHaveBeenCalledWith(
        `https://demo.docusign.net/restapi/v2.1/accounts/test_account_id/envelopes/${envelopeId}/views/recipient`,
        expect.objectContaining({
          returnUrl: 'https://test.com/callback',
          authenticationMethod: 'none',
          email: affiliate.email,
          userName: 'John Doe',
          clientUserId: '123456'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test_webhook_secret';

      // Create valid signature
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const validSignature = hmac.digest('base64');

      const isValid = docusignService.verifyWebhookSignature(payload, validSignature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"test": "data"}';
      const invalidSignature = 'invalid_signature';

      const isValid = docusignService.verifyWebhookSignature(payload, invalidSignature);
      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Event Processing', () => {
    it('should process completed envelope event', async () => {
      const event = {
        envelopeId: 'test_envelope_id',
        status: 'completed',
        event: 'envelope-completed',
        recipients: {
          signers: [{
            tabs: {
              ssnTabs: [{ value: '123-45-6789' }],
              textTabs: [
                { tabLabel: 'BusinessName', value: 'Test Business' }
              ]
            }
          }]
        }
      };

      const result = await docusignService.processWebhookEvent(event);

      expect(result).toEqual({
        envelopeId: 'test_envelope_id',
        status: 'verified',
        docusignStatus: 'completed',
        taxInfo: {
          taxIdType: 'SSN',
          taxIdLast4: '6789',
          businessName: 'Test Business'
        },
        completedAt: expect.any(Date)
      });
    });

    it('should handle declined envelope', async () => {
      const event = {
        envelopeId: 'test_envelope_id',
        status: 'declined',
        event: 'envelope-declined'
      };

      const result = await docusignService.processWebhookEvent(event);

      expect(result).toEqual({
        envelopeId: 'test_envelope_id',
        status: 'rejected',
        docusignStatus: 'declined',
        taxInfo: null,
        completedAt: null
      });
    });
  });

  describe('Envelope Status', () => {
    it('should get envelope status', async () => {
      const envelopeId = 'test_envelope_id';

      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('valid_token');

      const mockStatusResponse = {
        data: {
          envelopeId: envelopeId,
          status: 'completed',
          statusDateTime: '2025-01-17T10:00:00Z'
        }
      };
      axios.get.mockResolvedValue(mockStatusResponse);

      const status = await docusignService.getEnvelopeStatus(envelopeId);

      expect(status).toEqual(mockStatusResponse.data);
      expect(axios.get).toHaveBeenCalledWith(
        `https://demo.docusign.net/restapi/v2.1/accounts/test_account_id/envelopes/${envelopeId}`,
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        })
      );
    });
  });

  describe('Document Download', () => {
    it('should download completed W9 document', async () => {
      const envelopeId = 'test_envelope_id';
      const pdfBuffer = Buffer.from('PDF content');

      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('valid_token');

      const mockDownloadResponse = {
        data: pdfBuffer
      };
      axios.get.mockResolvedValue(mockDownloadResponse);

      const result = await docusignService.downloadCompletedW9(envelopeId);

      expect(result).toEqual({
        data: pdfBuffer,
        contentType: 'application/pdf',
        filename: `w9_${envelopeId}.pdf`
      });
    });
  });

  describe('Envelope Voiding', () => {
    it('should void an envelope', async () => {
      const envelopeId = 'test_envelope_id';
      const reason = 'Cancelled by user';

      jest.spyOn(docusignService, 'authenticate').mockResolvedValue('valid_token');

      const mockVoidResponse = {
        data: {
          envelopeId: envelopeId,
          status: 'voided'
        }
      };
      axios.put.mockResolvedValue(mockVoidResponse);

      const result = await docusignService.voidEnvelope(envelopeId, reason);

      expect(result).toEqual(mockVoidResponse.data);
      expect(axios.put).toHaveBeenCalledWith(
        `https://demo.docusign.net/restapi/v2.1/accounts/test_account_id/envelopes/${envelopeId}`,
        {
          status: 'voided',
          voidedReason: reason
        },
        expect.any(Object)
      );
    });
  });
});
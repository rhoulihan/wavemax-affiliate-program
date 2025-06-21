// DocuSign eSignature Service for W9 Processing
// WaveMAX Laundry Affiliate Program

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const DocuSignToken = require('../models/DocuSignToken');

class DocuSignService {
  constructor() {
    this.integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
    this.clientSecret = process.env.DOCUSIGN_CLIENT_SECRET;
    this.userId = process.env.DOCUSIGN_USER_ID;
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    this.baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://na3.docusign.net/restapi';
    this.oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account.docusign.com';
    this.w9TemplateId = process.env.DOCUSIGN_W9_TEMPLATE_ID;
    this.webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    this.redirectUri = process.env.DOCUSIGN_REDIRECT_URI || 'https://wavemax.promo/api/auth/docusign/callback';

    // Store directories for PKCE only
    this.pkceStoreDir = path.join(__dirname, '../../temp/pkce');
  }

  /**
   * Generate PKCE challenge and verifier
   */
  generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    return { verifier, challenge };
  }

  /**
   * Store PKCE verifier
   */
  async storePkceVerifier(state, verifier) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.pkceStoreDir, { recursive: true });

      const filePath = path.join(this.pkceStoreDir, `${state}.json`);
      const data = {
        verifier,
        createdAt: Date.now()
      };

      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');

      // Clean up old files (older than 10 minutes)
      const files = await fs.readdir(this.pkceStoreDir);
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(this.pkceStoreDir, file);
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const fileData = JSON.parse(content);
            if (fileData.createdAt < tenMinutesAgo) {
              await fs.unlink(fullPath);
            }
          } catch (err) {
            // Ignore errors for individual files
          }
        }
      }
    } catch (error) {
      logger.error('Failed to store PKCE verifier:', error);
    }
  }

  /**
   * Retrieve PKCE verifier
   */
  async getPkceVerifier(state) {
    try {
      const filePath = path.join(this.pkceStoreDir, `${state}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      // Delete the file after reading
      await fs.unlink(filePath);

      return data.verifier;
    } catch (error) {
      logger.error('Failed to retrieve PKCE verifier:', error);
      return null;
    }
  }

  /**
   * Get authorization URL for user consent
   */
  async getAuthorizationUrl(state = null) {
    const pkce = this.generatePKCE();
    const stateValue = state || crypto.randomBytes(16).toString('hex');

    // Store verifier to file system
    await this.storePkceVerifier(stateValue, pkce.verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.integrationKey,
      redirect_uri: this.redirectUri,
      scope: 'signature',
      state: stateValue,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256'
    });

    return {
      url: `${this.oauthBaseUrl}/oauth/auth?${params.toString()}`,
      state: stateValue
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state) {
    // Retrieve the verifier from file system
    const verifier = await this.getPkceVerifier(state);
    if (!verifier) {
      logger.error('PKCE verifier not found for state:', state);
      throw new Error('Invalid state parameter or session expired');
    }

    try {

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.integrationKey,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code_verifier: verifier
      });

      logger.info('Token exchange request:', {
        url: `${this.oauthBaseUrl}/oauth/token`,
        client_id: this.integrationKey,
        redirect_uri: this.redirectUri,
        has_verifier: !!verifier,
        verifier_length: verifier?.length
      });

      const response = await axios.post(
        `${this.oauthBaseUrl}/oauth/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Save tokens to database
      try {
        const savedToken = await DocuSignToken.saveToken(response.data);
        logger.info('Token saved to database', {
          tokenId: savedToken.tokenId,
          expiresAt: savedToken.expiresAt
        });
      } catch (saveError) {
        logger.error('Failed to save token to database:', saveError);
      }

      logger.info('Token exchange successful', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        expiresIn: response.data.expires_in
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to exchange code for token:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    // Get current token from database
    const currentToken = await DocuSignToken.getCurrentToken();
    if (!currentToken || !currentToken.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentToken.refreshToken,
        client_id: this.integrationKey,
        client_secret: this.clientSecret
      });

      const response = await axios.post(
        `${this.oauthBaseUrl}/oauth/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Update tokens in database
      await DocuSignToken.saveToken({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || currentToken.refreshToken,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to refresh token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Check if we have a valid token
   */
  async hasValidToken() {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getAccessToken() {
    // Get token from database
    const token = await DocuSignToken.getCurrentToken();

    // Check if we have a valid token (with 60 second buffer)
    if (token && token.accessToken && token.expiresAt > new Date(Date.now() + 60000)) {
      // Update last used
      token.lastUsed = new Date();
      await token.save();
      return token.accessToken;
    }

    // Try to refresh
    if (token && token.refreshToken) {
      return await this.refreshAccessToken();
    }

    // No valid token - need user authorization
    throw new Error('No valid access token. User authorization required.');
  }

  /**
   * Authenticate - for backward compatibility
   */
  async authenticate() {
    try {
      return await this.getAccessToken();
    } catch (error) {
      logger.error('Authentication required:', error.message);
      throw new Error('User authorization required. Please complete the OAuth flow.');
    }
  }

  /**
   * Create W9 envelope for affiliate
   * @param {Object} affiliate - The affiliate object
   * @param {boolean} useEmbeddedSigning - Whether to use embedded signing (default: false for admin-initiated)
   */
  async createW9Envelope(affiliate, useEmbeddedSigning = false) {
    try {
      // Check if we're in test mode (until JWT consent is granted)
      if (process.env.DOCUSIGN_TEST_MODE === 'true') {
        logger.info('DocuSign in test mode - returning mock envelope');
        return {
          envelopeId: 'test-envelope-' + Date.now(),
          status: 'sent',
          uri: '/test-envelope'
        };
      }

      const accessToken = await this.authenticate();

      const templateRole = {
        email: affiliate.email,
        name: `${affiliate.firstName} ${affiliate.lastName}`,
        roleName: 'Signer 1', // Updated to match template role name
        tabs: {
            textTabs: [
              {
                tabLabel: 'Owner\'s First Name',
                value: affiliate.firstName || ''
              },
              {
                tabLabel: 'Owner\'s Last Name',
                value: affiliate.lastName || ''
              },
              {
                tabLabel: 'Owner\'s Middle Initial',
                value: '' // We don't have middle initial in our data
              },
              {
                tabLabel: 'Street Address',
                value: affiliate.address || ''
              },
              {
                tabLabel: 'City',
                value: affiliate.city || ''
              },
              {
                tabLabel: 'State 1',
                value: affiliate.state || ''
              },
              {
                tabLabel: '5-Digit Zip Code',
                value: affiliate.zipCode ? affiliate.zipCode.substring(0, 5) : ''
              },
              // Business/DBA name if applicable
              {
                tabLabel: 'Business name',
                value: affiliate.businessName || ''
              },
              // Add common W9 text fields
              {
                tabLabel: 'Business Name',
                value: affiliate.businessName || ''
              },
              {
                tabLabel: 'DBA',
                value: affiliate.businessName || ''
              }
            ]
            // Note: SSN/EIN fields are intentionally not pre-filled for security
            // The signer must enter their tax ID information directly in DocuSign
            // The template should have the appropriate SSN or EIN input fields configured
          }
        };

      // Only add clientUserId for embedded signing
      if (useEmbeddedSigning) {
        templateRole.clientUserId = affiliate._id.toString();
      }

      const envelopeDefinition = {
        templateId: this.w9TemplateId,
        templateRoles: [templateRole],
        status: 'sent',
        eventNotification: {
          url: `${process.env.BACKEND_URL}/api/v1/w9/docusign-webhook`,
          requireAcknowledgment: true,
          loggingEnabled: true,
          deliveryMode: 'SIM',
          events: [
            'envelope-completed',
            'envelope-declined',
            'envelope-voided'
          ],
          eventData: {
            version: 'restv2.1',
            format: 'json'
          }
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`,
        envelopeDefinition,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('DocuSign envelope created:', {
        envelopeId: response.data.envelopeId,
        affiliateId: affiliate._id
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create W9 envelope:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        affiliateEmail: affiliate.email,
        templateId: this.w9TemplateId
      });

      // Extract specific error message if available
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.errorDetails?.message ||
                          'Failed to create W9 signing request';

      throw new Error(errorMessage);
    }
  }

  /**
   * Get embedded signing URL
   */
  async getEmbeddedSigningUrl(envelopeId, affiliate) {
    try {
      const accessToken = await this.authenticate();

      const recipientViewRequest = {
        returnUrl: this.redirectUri,
        authenticationMethod: 'none',
        email: affiliate.email,
        userName: `${affiliate.firstName} ${affiliate.lastName}`,
        clientUserId: affiliate._id.toString()
      };

      const response = await axios.post(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/views/recipient`,
        recipientViewRequest,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Embedded signing URL generated:', {
        envelopeId,
        affiliateId: affiliate._id
      });

      return response.data.url;
    } catch (error) {
      logger.error('Failed to get embedded signing URL:', error);
      throw new Error('Failed to generate signing URL');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload);
    const computedSignature = hmac.digest('base64');
    return computedSignature === signature;
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event) {
    try {
      const { envelopeId, status, customFields } = event;

      logger.info('Processing DocuSign webhook event:', {
        envelopeId,
        status,
        event: event.event
      });

      // Map DocuSign status to our status
      const statusMap = {
        'sent': 'pending_review',
        'delivered': 'pending_review',
        'completed': 'verified',
        'declined': 'rejected',
        'voided': 'not_submitted'
      };

      const mappedStatus = statusMap[status] || 'pending_review';

      // Extract tab data if completed
      let taxInfo = null;
      if (status === 'completed' && event.recipients) {
        const signer = event.recipients.signers[0];
        if (signer && signer.tabs) {
          taxInfo = this.extractTaxInfoFromTabs(signer.tabs);
        }
      }

      return {
        envelopeId,
        status: mappedStatus,
        docusignStatus: status,
        taxInfo,
        completedAt: status === 'completed' ? new Date() : null
      };
    } catch (error) {
      logger.error('Failed to process webhook event:', error);
      throw error;
    }
  }

  /**
   * Extract tax information from completed form tabs
   */
  extractTaxInfoFromTabs(tabs) {
    const taxInfo = {};

    // Extract SSN or EIN
    if (tabs.ssnTabs && tabs.ssnTabs.length > 0) {
      const ssnValue = tabs.ssnTabs[0].value;
      if (ssnValue) {
        taxInfo.taxIdType = 'SSN';
        taxInfo.taxIdLast4 = ssnValue.slice(-4);
      }
    } else if (tabs.textTabs) {
      const einTab = tabs.textTabs.find(tab => tab.tabLabel === 'EIN');
      if (einTab && einTab.value) {
        taxInfo.taxIdType = 'EIN';
        taxInfo.taxIdLast4 = einTab.value.slice(-4);
      }
    }

    // Extract business name if applicable
    if (tabs.textTabs) {
      const businessNameTab = tabs.textTabs.find(tab => tab.tabLabel === 'BusinessName');
      if (businessNameTab && businessNameTab.value) {
        taxInfo.businessName = businessNameTab.value;
      }
    }

    return taxInfo;
  }

  /**
   * Download completed W9 document
   */
  async downloadCompletedW9(envelopeId) {
    try {
      const accessToken = await this.authenticate();

      const response = await axios.get(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/pdf'
          },
          responseType: 'arraybuffer'
        }
      );

      logger.info('Downloaded completed W9:', { envelopeId });

      return {
        data: Buffer.from(response.data),
        contentType: 'application/pdf',
        filename: `w9_${envelopeId}.pdf`
      };
    } catch (error) {
      logger.error('Failed to download W9:', error);
      throw new Error('Failed to download completed W9');
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId) {
    try {
      const accessToken = await this.authenticate();

      const response = await axios.get(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get envelope status:', error);
      throw new Error('Failed to get signing status');
    }
  }

  /**
   * Void an envelope (cancel W9 request)
   */
  async voidEnvelope(envelopeId, reason) {
    try {
      const accessToken = await this.authenticate();

      const response = await axios.put(
        `${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          status: 'voided',
          voidedReason: reason || 'Cancelled by administrator'
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Voided envelope:', { envelopeId, reason });

      return response.data;
    } catch (error) {
      logger.error('Failed to void envelope:', error);
      throw new Error('Failed to cancel W9 request');
    }
  }
}

module.exports = new DocuSignService();
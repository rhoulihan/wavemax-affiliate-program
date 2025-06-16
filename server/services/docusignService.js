// DocuSign eSignature Service for W9 Processing
// WaveMAX Laundry Affiliate Program

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

class DocuSignService {
  constructor() {
    this.integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
    this.userId = process.env.DOCUSIGN_USER_ID;
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    this.baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
    this.oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL || 'https://account-d.docusign.com';
    this.w9TemplateId = process.env.DOCUSIGN_W9_TEMPLATE_ID;
    this.webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    this.redirectUri = process.env.DOCUSIGN_REDIRECT_URI || `${process.env.FRONTEND_URL}/affiliate/dashboard?tab=settings`;
  }

  /**
   * Authenticate using JWT Grant flow (for system operations)
   */
  async authenticate() {
    try {
      const jwtPayload = {
        iss: this.integrationKey,
        sub: this.userId,
        aud: this.oauthBaseUrl,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: 'signature impersonation'
      };

      // Note: In production, use RSA private key from file or env
      const privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
      const assertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

      const response = await axios.post(`${this.oauthBaseUrl}/oauth/token`, {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('DocuSign authentication failed:', error);
      throw new Error('Failed to authenticate with DocuSign');
    }
  }

  /**
   * Create W9 envelope for affiliate
   */
  async createW9Envelope(affiliate) {
    try {
      const accessToken = await this.authenticate();

      const envelopeDefinition = {
        templateId: this.w9TemplateId,
        templateRoles: [{
          email: affiliate.email,
          name: `${affiliate.firstName} ${affiliate.lastName}`,
          roleName: 'Taxpayer',
          clientUserId: affiliate._id.toString(), // For embedded signing
          tabs: {
            textTabs: [
              {
                tabLabel: 'Name',
                value: `${affiliate.firstName} ${affiliate.lastName}`
              },
              {
                tabLabel: 'BusinessName',
                value: affiliate.businessName || ''
              },
              {
                tabLabel: 'Address',
                value: `${affiliate.address || ''} ${affiliate.city || ''}, ${affiliate.state || ''} ${affiliate.zipCode || ''}`
              }
            ]
          }
        }],
        status: 'sent',
        eventNotification: {
          url: `${process.env.BACKEND_URL}/api/v1/w9/webhook/docusign`,
          requireAcknowledgment: true,
          loggingEnabled: true,
          deliveryMode: 'SIM',
          events: [
            'envelope-sent',
            'envelope-delivered',
            'envelope-completed',
            'envelope-declined',
            'envelope-voided'
          ],
          eventData: {
            version: '1.0',
            format: 'json',
            includeData: ['tabs']
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
      logger.error('Failed to create W9 envelope:', error);
      throw new Error('Failed to create W9 signing request');
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
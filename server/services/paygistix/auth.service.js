const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const config = require('../../config/paygistix.config');

class PaygistixAuthService {
  constructor() {
    this.baseURL = config.getApiUrl();
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate authentication signature
   * @param {Object} params - Request parameters
   * @param {string} timestamp - Request timestamp
   * @returns {string} - Generated signature
   */
  generateSignature(params, timestamp) {
    try {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const signatureString = `${sortedParams}&timestamp=${timestamp}&secret=${config.getApiSecret()}`;
      
      return crypto
        .createHash('sha256')
        .update(signatureString)
        .digest('hex');
    } catch (error) {
      logger.error('Error generating Paygistix signature:', error);
      throw new Error('Failed to generate authentication signature');
    }
  }

  /**
   * Authenticate with Paygistix API
   * @returns {Promise<Object>} - Authentication response with access token
   */
  async authenticate() {
    try {
      const timestamp = Date.now().toString();
      const authParams = {
        api_key: config.getApiKey(),
        grant_type: 'client_credentials'
      };

      const signature = this.generateSignature(authParams, timestamp);

      const response = await axios.post(
        `${this.baseURL}/auth/token`,
        authParams,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      logger.info('Successfully authenticated with Paygistix');
      return response.data;
    } catch (error) {
      logger.error('Paygistix authentication failed:', error);
      throw new Error('Failed to authenticate with Paygistix');
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * @returns {Promise<string>} - Valid access token
   */
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
        return this.accessToken;
      }

      // Token expired or doesn't exist, authenticate again
      await this.authenticate();
      return this.accessToken;
    } catch (error) {
      logger.error('Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Paygistix API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} - API response
   */
  async makeAuthenticatedRequest(method, endpoint, data = {}) {
    try {
      const accessToken = await this.getAccessToken();
      
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (method !== 'GET') {
        config.data = data;
      } else {
        config.params = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token might be invalid, try to re-authenticate
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Retry once
        const accessToken = await this.getAccessToken();
        error.config.headers['Authorization'] = `Bearer ${accessToken}`;
        const response = await axios(error.config);
        return response.data;
      }
      
      logger.error('Authenticated request failed:', error);
      throw error;
    }
  }
}

module.exports = new PaygistixAuthService();
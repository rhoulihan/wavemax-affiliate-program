const authService = require('./auth.service');
const logger = require('../../utils/logger');
const PaymentMethod = require('../../models/PaymentMethod');
const encryption = require('../../utils/encryption');
const config = require('../../config/paygistix.config');

class PaygistixTokenService {
  /**
   * Create a tokenization session for secure card collection
   * @param {Object} sessionData - Session configuration
   * @returns {Promise<Object>} - Tokenization session details
   */
  async createTokenizationSession(sessionData) {
    try {
      const { customerId, successUrl, cancelUrl, metadata = {} } = sessionData;

      if (!customerId || !successUrl || !cancelUrl) {
        throw new Error('Missing required tokenization session fields');
      }

      const sessionRequest = {
        mode: 'setup',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_id: customerId,
        metadata: {
          ...metadata,
          customer_id: customerId,
          environment: config.getEnvironment()
        }
      };

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        '/tokenization/sessions',
        sessionRequest
      );

      logger.info(`Tokenization session created: ${response.session_id}`);
      return {
        sessionId: response.session_id,
        sessionUrl: response.session_url,
        expiresAt: new Date(response.expires_at)
      };
    } catch (error) {
      logger.error('Error creating tokenization session:', error);
      throw error;
    }
  }

  /**
   * Tokenize card details (PCI DSS compliant)
   * @param {Object} cardData - Card information
   * @returns {Promise<Object>} - Token response
   */
  async tokenizeCard(cardData) {
    try {
      const { 
        cardNumber, 
        expiryMonth, 
        expiryYear, 
        cvv, 
        cardholderName,
        billingAddress 
      } = cardData;

      // Validate card data
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
        throw new Error('Missing required card fields');
      }

      // Never log sensitive card data
      const tokenRequest = {
        card: {
          number: cardNumber,
          exp_month: expiryMonth,
          exp_year: expiryYear,
          cvc: cvv,
          name: cardholderName
        }
      };

      if (billingAddress) {
        tokenRequest.billing_address = billingAddress;
      }

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        '/tokens',
        tokenRequest
      );

      logger.info('Card tokenized successfully');
      return {
        token: response.token,
        card: {
          last4: response.card.last4,
          brand: response.card.brand,
          expiryMonth: response.card.exp_month,
          expiryYear: response.card.exp_year,
          fingerprint: response.card.fingerprint
        }
      };
    } catch (error) {
      logger.error('Error tokenizing card:', error);
      throw error;
    }
  }

  /**
   * Create a payment method from token
   * @param {Object} paymentMethodData - Payment method details
   * @returns {Promise<Object>} - Created payment method
   */
  async createPaymentMethod(paymentMethodData) {
    try {
      const { 
        customerId, 
        token, 
        type = 'card',
        isDefault = false,
        metadata = {} 
      } = paymentMethodData;

      if (!customerId || !token) {
        throw new Error('Missing required payment method fields');
      }

      // Create payment method in Paygistix
      const paymentMethodRequest = {
        customer_id: customerId,
        type,
        token,
        metadata
      };

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        '/payment-methods',
        paymentMethodRequest
      );

      // Save payment method locally
      const paymentMethod = new PaymentMethod({
        customerId,
        paygistixId: response.id,
        type: response.type,
        card: response.card ? {
          last4: response.card.last4,
          brand: response.card.brand,
          expiryMonth: response.card.exp_month,
          expiryYear: response.card.exp_year,
          fingerprint: response.card.fingerprint
        } : null,
        isDefault,
        isActive: true,
        metadata: response.metadata
      });

      await paymentMethod.save();

      // Set as default if requested
      if (isDefault) {
        await this.setDefaultPaymentMethod(customerId, paymentMethod._id);
      }

      logger.info(`Payment method created: ${paymentMethod._id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Error creating payment method:', error);
      throw error;
    }
  }

  /**
   * List customer payment methods
   * @param {string} customerId - Customer ID
   * @returns {Promise<Array>} - List of payment methods
   */
  async listPaymentMethods(customerId) {
    try {
      const paymentMethods = await PaymentMethod.find({
        customerId,
        isActive: true
      }).sort({ isDefault: -1, createdAt: -1 });

      return paymentMethods;
    } catch (error) {
      logger.error('Error listing payment methods:', error);
      throw error;
    }
  }

  /**
   * Get payment method details
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Customer ID (for verification)
   * @returns {Promise<Object>} - Payment method details
   */
  async getPaymentMethod(paymentMethodId, customerId) {
    try {
      const paymentMethod = await PaymentMethod.findOne({
        _id: paymentMethodId,
        customerId,
        isActive: true
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      return paymentMethod;
    } catch (error) {
      logger.error('Error getting payment method:', error);
      throw error;
    }
  }

  /**
   * Delete payment method
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Customer ID (for verification)
   * @returns {Promise<Object>} - Deletion result
   */
  async deletePaymentMethod(paymentMethodId, customerId) {
    try {
      const paymentMethod = await PaymentMethod.findOne({
        _id: paymentMethodId,
        customerId
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Delete from Paygistix
      await authService.makeAuthenticatedRequest(
        'DELETE',
        `/payment-methods/${paymentMethod.paygistixId}`
      );

      // Soft delete locally
      paymentMethod.isActive = false;
      paymentMethod.deletedAt = new Date();
      await paymentMethod.save();

      // If this was default, set another as default
      if (paymentMethod.isDefault) {
        const nextDefault = await PaymentMethod.findOne({
          customerId,
          isActive: true,
          _id: { $ne: paymentMethodId }
        }).sort({ createdAt: -1 });

        if (nextDefault) {
          nextDefault.isDefault = true;
          await nextDefault.save();
        }
      }

      logger.info(`Payment method deleted: ${paymentMethodId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting payment method:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   * @param {string} customerId - Customer ID
   * @param {string} paymentMethodId - Payment method ID to set as default
   * @returns {Promise<Object>} - Updated payment method
   */
  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      // Remove default from all other methods
      await PaymentMethod.updateMany(
        { customerId, isDefault: true },
        { isDefault: false }
      );

      // Set new default
      const paymentMethod = await PaymentMethod.findOneAndUpdate(
        { _id: paymentMethodId, customerId, isActive: true },
        { isDefault: true },
        { new: true }
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      logger.info(`Default payment method set: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Verify card with micro-deposit
   * @param {string} paymentMethodId - Payment method ID
   * @param {Array<number>} amounts - Micro-deposit amounts
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPaymentMethod(paymentMethodId, amounts) {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      const verificationRequest = {
        payment_method_id: paymentMethod.paygistixId,
        amounts: amounts.map(a => Math.round(a * 100))
      };

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        `/payment-methods/${paymentMethod.paygistixId}/verify`,
        verificationRequest
      );

      if (response.verified) {
        paymentMethod.isVerified = true;
        paymentMethod.verifiedAt = new Date();
        await paymentMethod.save();
      }

      return {
        verified: response.verified,
        attemptsRemaining: response.attempts_remaining
      };
    } catch (error) {
      logger.error('Error verifying payment method:', error);
      throw error;
    }
  }
}

module.exports = new PaygistixTokenService();
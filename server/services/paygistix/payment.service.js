const authService = require('./auth.service');
const logger = require('../../utils/logger');
const Payment = require('../../models/Payment');
const PaymentMethod = require('../../models/PaymentMethod');
const config = require('../../config/paygistix.config');
const crypto = require('crypto');

class PaygistixPaymentService {
  /**
   * Create a new payment
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} - Payment response
   */
  async createPayment(paymentData) {
    try {
      const { 
        amount, 
        currency, 
        customerId, 
        orderId, 
        description, 
        paymentMethodId,
        metadata = {}
      } = paymentData;

      // Validate required fields
      if (!amount || !currency || !customerId || !orderId) {
        throw new Error('Missing required payment fields');
      }

      // Create idempotency key to prevent duplicate charges
      const idempotencyKey = this.generateIdempotencyKey(orderId, amount);

      // Get payment method details
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      if (!paymentMethod || paymentMethod.customerId !== customerId) {
        throw new Error('Invalid payment method');
      }

      // Create payment request
      const paymentRequest = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toUpperCase(),
        payment_method_id: paymentMethod.paygistixId,
        description: description || `Order #${orderId}`,
        metadata: {
          ...metadata,
          order_id: orderId,
          customer_id: customerId,
          environment: config.getEnvironment()
        },
        capture: config.isAutoCapture(),
        idempotency_key: idempotencyKey
      };

      // Make payment request to Paygistix
      const response = await authService.makeAuthenticatedRequest(
        'POST',
        '/payments',
        paymentRequest
      );

      // Save payment record
      const payment = new Payment({
        orderId,
        customerId,
        paymentMethodId,
        amount,
        currency,
        status: response.status,
        paygistixId: response.id,
        transactionId: response.transaction_id,
        capturedAmount: response.captured_amount / 100,
        refundedAmount: 0,
        metadata: response.metadata,
        response: response
      });

      await payment.save();

      logger.info(`Payment created successfully: ${payment._id}`);
      return payment;
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Capture a previously authorized payment
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Amount to capture (optional, defaults to full amount)
   * @returns {Promise<Object>} - Capture response
   */
  async capturePayment(paymentId, amount = null) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'authorized') {
        throw new Error('Payment cannot be captured in current status');
      }

      const captureData = {
        payment_id: payment.paygistixId
      };

      if (amount !== null) {
        captureData.amount = Math.round(amount * 100);
      }

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        `/payments/${payment.paygistixId}/capture`,
        captureData
      );

      // Update payment record
      payment.status = response.status;
      payment.capturedAmount = response.captured_amount / 100;
      payment.capturedAt = new Date();
      await payment.save();

      logger.info(`Payment captured successfully: ${payment._id}`);
      return payment;
    } catch (error) {
      logger.error('Error capturing payment:', error);
      throw error;
    }
  }

  /**
   * Refund a payment
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} - Refund response
   */
  async refundPayment(paymentId, amount, reason) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'captured' && payment.status !== 'partially_refunded') {
        throw new Error('Payment cannot be refunded in current status');
      }

      const maxRefundAmount = payment.capturedAmount - payment.refundedAmount;
      if (amount > maxRefundAmount) {
        throw new Error('Refund amount exceeds available amount');
      }

      const refundData = {
        payment_id: payment.paygistixId,
        amount: Math.round(amount * 100),
        reason: reason || 'Customer requested refund'
      };

      const response = await authService.makeAuthenticatedRequest(
        'POST',
        `/payments/${payment.paygistixId}/refund`,
        refundData
      );

      // Update payment record
      payment.refundedAmount += amount;
      payment.status = payment.refundedAmount >= payment.capturedAmount ? 'refunded' : 'partially_refunded';
      payment.lastRefundAt = new Date();
      
      // Add refund to history
      payment.refunds = payment.refunds || [];
      payment.refunds.push({
        amount,
        reason,
        refundId: response.refund_id,
        createdAt: new Date()
      });

      await payment.save();

      logger.info(`Payment refunded successfully: ${payment._id}`);
      return payment;
    } catch (error) {
      logger.error('Error refunding payment:', error);
      throw error;
    }
  }

  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} - Payment details
   */
  async getPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate('paymentMethodId')
        .exec();
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Sync with Paygistix if needed
      const response = await authService.makeAuthenticatedRequest(
        'GET',
        `/payments/${payment.paygistixId}`
      );

      // Update local record if status changed
      if (response.status !== payment.status) {
        payment.status = response.status;
        payment.capturedAmount = response.captured_amount / 100;
        payment.refundedAmount = response.refunded_amount / 100;
        await payment.save();
      }

      return payment;
    } catch (error) {
      logger.error('Error getting payment:', error);
      throw error;
    }
  }

  /**
   * List payments with filtering and pagination
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Paginated payment list
   */
  async listPayments(filters = {}) {
    try {
      const {
        customerId,
        orderId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = filters;

      const query = {};
      
      if (customerId) query.customerId = customerId;
      if (orderId) query.orderId = orderId;
      if (status) query.status = status;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .populate('paymentMethodId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        Payment.countDocuments(query)
      ]);

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error listing payments:', error);
      throw error;
    }
  }

  /**
   * Generate idempotency key for payment
   * @param {string} orderId - Order ID
   * @param {number} amount - Payment amount
   * @returns {string} - Idempotency key
   */
  generateIdempotencyKey(orderId, amount) {
    const data = `${orderId}-${amount}-${Date.now()}`;
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Validate webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} - Is signature valid
   */
  validateWebhookSignature(payload, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.getWebhookSecret())
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Error validating webhook signature:', error);
      return false;
    }
  }
}

module.exports = new PaygistixPaymentService();
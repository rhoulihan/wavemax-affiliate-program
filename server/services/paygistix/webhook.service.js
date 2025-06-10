const crypto = require('crypto');
const logger = require('../../utils/logger');
const Payment = require('../../models/Payment');
const PaymentMethod = require('../../models/PaymentMethod');
const Order = require('../../models/Order');
const config = require('../../config/paygistix.config');
const emailService = require('../../utils/emailService');

class PaygistixWebhookService {
  /**
   * Process incoming webhook from Paygistix
   * @param {Object} headers - Request headers
   * @param {Object} body - Webhook payload
   * @returns {Promise<Object>} - Processing result
   */
  async processWebhook(headers, body) {
    try {
      // Validate webhook signature
      const signature = headers['x-paygistix-signature'];
      const timestamp = headers['x-paygistix-timestamp'];

      if (!this.validateWebhook(body, signature, timestamp)) {
        throw new Error('Invalid webhook signature');
      }

      // Process based on event type
      const { event, data } = body;
      
      logger.info(`Processing Paygistix webhook: ${event}`);

      switch (event) {
        case 'payment.succeeded':
          return await this.handlePaymentSucceeded(data);
        
        case 'payment.failed':
          return await this.handlePaymentFailed(data);
        
        case 'payment.refunded':
          return await this.handlePaymentRefunded(data);
        
        case 'payment.partially_refunded':
          return await this.handlePaymentPartiallyRefunded(data);
        
        case 'payment_method.created':
          return await this.handlePaymentMethodCreated(data);
        
        case 'payment_method.updated':
          return await this.handlePaymentMethodUpdated(data);
        
        case 'payment_method.deleted':
          return await this.handlePaymentMethodDeleted(data);
        
        case 'dispute.created':
          return await this.handleDisputeCreated(data);
        
        case 'dispute.updated':
          return await this.handleDisputeUpdated(data);
        
        default:
          logger.warn(`Unhandled webhook event: ${event}`);
          return { processed: false, reason: 'Unhandled event type' };
      }
    } catch (error) {
      logger.error('Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature and timestamp
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} timestamp - Webhook timestamp
   * @returns {boolean} - Is webhook valid
   */
  validateWebhook(payload, signature, timestamp) {
    try {
      // Check timestamp to prevent replay attacks (5 minute window)
      const currentTime = Math.floor(Date.now() / 1000);
      const webhookTime = parseInt(timestamp);
      
      if (Math.abs(currentTime - webhookTime) > 300) {
        logger.warn('Webhook timestamp outside acceptable window');
        return false;
      }

      // Validate signature
      const payloadString = JSON.stringify(payload);
      const signedPayload = `${timestamp}.${payloadString}`;
      
      const expectedSignature = crypto
        .createHmac('sha256', config.getWebhookSecret())
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`v1=${expectedSignature}`)
      );
    } catch (error) {
      logger.error('Error validating webhook:', error);
      return false;
    }
  }

  /**
   * Handle successful payment webhook
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentSucceeded(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.id });
      if (!payment) {
        logger.warn(`Payment not found for webhook: ${data.id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment status
      payment.status = 'succeeded';
      payment.capturedAmount = data.amount / 100;
      payment.capturedAt = new Date(data.captured_at);
      await payment.save();

      // Update order status
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.paidAt = new Date();
        await order.save();

        // Send confirmation email
        await emailService.sendOrderPaymentConfirmation(order, payment);
      }

      logger.info(`Payment succeeded webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment webhook
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentFailed(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.id });
      if (!payment) {
        logger.warn(`Payment not found for webhook: ${data.id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment status
      payment.status = 'failed';
      payment.failureReason = data.failure_reason;
      payment.failureCode = data.failure_code;
      payment.failedAt = new Date();
      await payment.save();

      // Update order status
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'failed';
        await order.save();

        // Send failure notification
        await emailService.sendPaymentFailureNotification(order, payment);
      }

      logger.info(`Payment failed webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling payment failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment refunded webhook
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentRefunded(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.payment_id });
      if (!payment) {
        logger.warn(`Payment not found for refund webhook: ${data.payment_id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment with refund details
      payment.status = 'refunded';
      payment.refundedAmount = data.amount / 100;
      payment.lastRefundAt = new Date();
      
      // Add refund to history
      payment.refunds = payment.refunds || [];
      payment.refunds.push({
        refundId: data.id,
        amount: data.amount / 100,
        reason: data.reason,
        createdAt: new Date(data.created_at)
      });
      
      await payment.save();

      // Update order if fully refunded
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'refunded';
        order.refundedAt = new Date();
        await order.save();

        // Send refund confirmation
        await emailService.sendRefundConfirmation(order, payment);
      }

      logger.info(`Payment refunded webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling payment refunded:', error);
      throw error;
    }
  }

  /**
   * Handle partial refund webhook
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentPartiallyRefunded(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.payment_id });
      if (!payment) {
        logger.warn(`Payment not found for partial refund webhook: ${data.payment_id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment with partial refund details
      payment.status = 'partially_refunded';
      payment.refundedAmount += data.amount / 100;
      payment.lastRefundAt = new Date();
      
      // Add refund to history
      payment.refunds = payment.refunds || [];
      payment.refunds.push({
        refundId: data.id,
        amount: data.amount / 100,
        reason: data.reason,
        createdAt: new Date(data.created_at)
      });
      
      await payment.save();

      logger.info(`Payment partially refunded webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling partial refund:', error);
      throw error;
    }
  }

  /**
   * Handle payment method created webhook
   * @param {Object} data - Payment method data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentMethodCreated(data) {
    try {
      // Check if we already have this payment method
      const existing = await PaymentMethod.findOne({ paygistixId: data.id });
      if (existing) {
        logger.info(`Payment method already exists: ${data.id}`);
        return { processed: true, reason: 'Already exists' };
      }

      // Create payment method record
      const paymentMethod = new PaymentMethod({
        customerId: data.customer_id,
        paygistixId: data.id,
        type: data.type,
        card: data.card ? {
          last4: data.card.last4,
          brand: data.card.brand,
          expiryMonth: data.card.exp_month,
          expiryYear: data.card.exp_year,
          fingerprint: data.card.fingerprint
        } : null,
        isDefault: false,
        isActive: true,
        metadata: data.metadata
      });

      await paymentMethod.save();

      logger.info(`Payment method created from webhook: ${paymentMethod._id}`);
      return { processed: true, paymentMethodId: paymentMethod._id };
    } catch (error) {
      logger.error('Error handling payment method created:', error);
      throw error;
    }
  }

  /**
   * Handle payment method updated webhook
   * @param {Object} data - Payment method data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentMethodUpdated(data) {
    try {
      const paymentMethod = await PaymentMethod.findOne({ paygistixId: data.id });
      if (!paymentMethod) {
        logger.warn(`Payment method not found for update webhook: ${data.id}`);
        return { processed: false, reason: 'Payment method not found' };
      }

      // Update payment method details
      if (data.card) {
        paymentMethod.card = {
          last4: data.card.last4,
          brand: data.card.brand,
          expiryMonth: data.card.exp_month,
          expiryYear: data.card.exp_year,
          fingerprint: data.card.fingerprint
        };
      }

      paymentMethod.metadata = data.metadata;
      await paymentMethod.save();

      logger.info(`Payment method updated from webhook: ${paymentMethod._id}`);
      return { processed: true, paymentMethodId: paymentMethod._id };
    } catch (error) {
      logger.error('Error handling payment method updated:', error);
      throw error;
    }
  }

  /**
   * Handle payment method deleted webhook
   * @param {Object} data - Payment method data
   * @returns {Promise<Object>} - Processing result
   */
  async handlePaymentMethodDeleted(data) {
    try {
      const paymentMethod = await PaymentMethod.findOne({ paygistixId: data.id });
      if (!paymentMethod) {
        logger.warn(`Payment method not found for delete webhook: ${data.id}`);
        return { processed: false, reason: 'Payment method not found' };
      }

      // Soft delete the payment method
      paymentMethod.isActive = false;
      paymentMethod.deletedAt = new Date();
      await paymentMethod.save();

      logger.info(`Payment method deleted from webhook: ${paymentMethod._id}`);
      return { processed: true, paymentMethodId: paymentMethod._id };
    } catch (error) {
      logger.error('Error handling payment method deleted:', error);
      throw error;
    }
  }

  /**
   * Handle dispute created webhook
   * @param {Object} data - Dispute data
   * @returns {Promise<Object>} - Processing result
   */
  async handleDisputeCreated(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.payment_id });
      if (!payment) {
        logger.warn(`Payment not found for dispute webhook: ${data.payment_id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment with dispute info
      payment.hasDispute = true;
      payment.disputeStatus = data.status;
      payment.disputeReason = data.reason;
      payment.disputeAmount = data.amount / 100;
      payment.disputeCreatedAt = new Date(data.created_at);
      await payment.save();

      // Notify administrators
      await emailService.sendDisputeNotification(payment, data);

      logger.info(`Dispute created webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling dispute created:', error);
      throw error;
    }
  }

  /**
   * Handle dispute updated webhook
   * @param {Object} data - Dispute data
   * @returns {Promise<Object>} - Processing result
   */
  async handleDisputeUpdated(data) {
    try {
      const payment = await Payment.findOne({ paygistixId: data.payment_id });
      if (!payment) {
        logger.warn(`Payment not found for dispute update webhook: ${data.payment_id}`);
        return { processed: false, reason: 'Payment not found' };
      }

      // Update dispute status
      payment.disputeStatus = data.status;
      payment.disputeUpdatedAt = new Date();

      // If dispute is resolved, update payment accordingly
      if (data.status === 'won') {
        payment.hasDispute = false;
        await emailService.sendDisputeWonNotification(payment, data);
      } else if (data.status === 'lost') {
        payment.status = 'disputed';
        await emailService.sendDisputeLostNotification(payment, data);
      }

      await payment.save();

      logger.info(`Dispute updated webhook processed: ${payment._id}`);
      return { processed: true, paymentId: payment._id };
    } catch (error) {
      logger.error('Error handling dispute updated:', error);
      throw error;
    }
  }
}

module.exports = new PaygistixWebhookService();
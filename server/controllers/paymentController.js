const paymentService = require('../services/paygistix/payment.service');
const tokenService = require('../services/paygistix/token.service');
const webhookService = require('../services/paygistix/webhook.service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class PaymentController {
  /**
   * Create a new payment
   * POST /api/payments
   */
  async createPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const paymentData = {
        ...req.body,
        customerId: req.user.id
      };

      const payment = await paymentService.createPayment(paymentData);

      res.status(201).json({
        success: true,
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          orderId: payment.orderId
        }
      });
    } catch (error) {
      logger.error('Error creating payment:', error);
      res.status(error.message.includes('Invalid') ? 400 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Capture a payment
   * POST /api/payments/:id/capture
   */
  async capturePayment(req, res) {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      const payment = await paymentService.capturePayment(id, amount);

      res.json({
        success: true,
        payment: {
          id: payment._id,
          status: payment.status,
          capturedAmount: payment.capturedAmount
        }
      });
    } catch (error) {
      logger.error('Error capturing payment:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Refund a payment
   * POST /api/payments/:id/refund
   */
  async refundPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { amount, reason } = req.body;

      const payment = await paymentService.refundPayment(id, amount, reason);

      res.json({
        success: true,
        payment: {
          id: payment._id,
          status: payment.status,
          refundedAmount: payment.refundedAmount
        }
      });
    } catch (error) {
      logger.error('Error refunding payment:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payment details
   * GET /api/payments/:id
   */
  async getPayment(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPayment(id);

      // Verify customer has access to this payment
      if (payment.customerId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        payment
      });
    } catch (error) {
      logger.error('Error getting payment:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List payments
   * GET /api/payments
   */
  async listPayments(req, res) {
    try {
      const filters = {
        ...req.query,
        customerId: req.user.role === 'admin' ? req.query.customerId : req.user.id
      };

      const result = await paymentService.listPayments(filters);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error listing payments:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create tokenization session
   * POST /api/payments/tokenization/session
   */
  async createTokenizationSession(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sessionData = {
        ...req.body,
        customerId: req.user.id
      };

      const session = await tokenService.createTokenizationSession(sessionData);

      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('Error creating tokenization session:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create payment method
   * POST /api/payments/methods
   */
  async createPaymentMethod(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const paymentMethodData = {
        ...req.body,
        customerId: req.user.id
      };

      const paymentMethod = await tokenService.createPaymentMethod(paymentMethodData);

      res.status(201).json({
        success: true,
        paymentMethod: {
          id: paymentMethod._id,
          type: paymentMethod.type,
          card: paymentMethod.card,
          isDefault: paymentMethod.isDefault
        }
      });
    } catch (error) {
      logger.error('Error creating payment method:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List payment methods
   * GET /api/payments/methods
   */
  async listPaymentMethods(req, res) {
    try {
      const customerId = req.user.id;
      const paymentMethods = await tokenService.listPaymentMethods(customerId);

      res.json({
        success: true,
        paymentMethods
      });
    } catch (error) {
      logger.error('Error listing payment methods:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payment method
   * GET /api/payments/methods/:id
   */
  async getPaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const customerId = req.user.id;
      
      const paymentMethod = await tokenService.getPaymentMethod(id, customerId);

      res.json({
        success: true,
        paymentMethod
      });
    } catch (error) {
      logger.error('Error getting payment method:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete payment method
   * DELETE /api/payments/methods/:id
   */
  async deletePaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const customerId = req.user.id;
      
      await tokenService.deletePaymentMethod(id, customerId);

      res.json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting payment method:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Set default payment method
   * PUT /api/payments/methods/:id/default
   */
  async setDefaultPaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const customerId = req.user.id;
      
      const paymentMethod = await tokenService.setDefaultPaymentMethod(customerId, id);

      res.json({
        success: true,
        paymentMethod
      });
    } catch (error) {
      logger.error('Error setting default payment method:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle Paygistix webhook
   * POST /api/payments/webhook
   */
  async handleWebhook(req, res) {
    try {
      // Immediately acknowledge receipt
      res.status(200).send('OK');

      // Process webhook asynchronously
      setImmediate(async () => {
        try {
          await webhookService.processWebhook(req.headers, req.body);
        } catch (error) {
          logger.error('Error processing webhook asynchronously:', error);
        }
      });
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }

  /**
   * Verify payment method with micro-deposits
   * POST /api/payments/methods/:id/verify
   */
  async verifyPaymentMethod(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { amounts } = req.body;

      const result = await tokenService.verifyPaymentMethod(id, amounts);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error verifying payment method:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();
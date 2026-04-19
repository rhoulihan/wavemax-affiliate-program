const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const emailService = require('../utils/emailService');
const auditLogger = require('../utils/auditLogger');
const logger = require('../utils/logger');

/**
 * Handle Paygistix payment callback for both registration and orders
 * This endpoint receives the callback from Paygistix after payment processing
 */
router.get('/', async (req, res) => {
  try {
    logger.info('Paygistix general callback received:', req.query);

    // Extract callback parameters
    const {
      status,
      transactionId,
      orderId,
      amount,
      authCode,
      responseCode,
      responseMessage,
      cardType,
      maskedCard,
      hash,
      type,
      customerData
    } = req.query;

    // Post-weigh workflow: all callbacks are for orders (V1 upfront-registration
    // payment was removed in the Phase 2 refactor).
    return handleOrderPayment(req, res);

  } catch (error) {
    logger.error('Payment callback error:', error);
    res.redirect('/payment-error?message=An error occurred processing your payment');
  }
});

/**
 * Handle order payment callback
 */
async function handleOrderPayment(req, res) {
  try {
    const {
      status,
      transactionId,
      orderId,
      amount,
      authCode,
      responseCode,
      responseMessage,
      cardType,
      maskedCard
    } = req.query;

    // Find the order
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      logger.error('Order not found for callback:', orderId);
      return res.redirect('/payment-error?message=Order not found');
    }

    // Create or update payment record
    let payment = await Payment.findOne({ orderId: order._id });

    if (!payment) {
      payment = new Payment({
        orderId: order._id,
        customerId: order.customerId,
        paygistixTransactionId: transactionId,
        amount: parseFloat(amount) || order.estimatedTotal,
        currency: 'USD',
        status: 'pending'
      });
    }

    // Update payment based on status
    if (status === 'approved' || status === 'success') {
      payment.status = 'completed';
      payment.paymentMethod = {
        type: 'card',
        brand: cardType,
        last4: maskedCard ? maskedCard.slice(-4) : ''
      };
      payment.metadata = new Map([
        ['authCode', authCode],
        ['responseCode', responseCode],
        ['responseMessage', responseMessage]
      ]);

      // Update order payment status
      order.paymentStatus = 'verified';
      order.paymentVerifiedAt = new Date();
      await order.save();

      // Get customer for email
      const customer = await Customer.findOne({ customerId: order.customerId });

      // Update customer isActive to true on successful payment
      if (customer && !customer.isActive) {
        customer.isActive = true;
        await customer.save();
        logger.info('Updated customer isActive status to true for customer:', customer.customerId);
      }

      // Send confirmation email
      if (customer) {
        try {
          await emailService.sendPaymentConfirmationEmail(customer, order, payment);
        } catch (emailError) {
          logger.error('Failed to send payment confirmation email:', emailError);
        }
      }

      // Log success
      await auditLogger.log({
        userId: order.customerId,
        userType: 'customer',
        action: 'payment.completed',
        resourceType: 'payment',
        resourceId: payment._id,
        details: {
          orderId: order.orderId,
          amount: payment.amount,
          transactionId: transactionId
        }
      });

      await payment.save();

      // Redirect to success page
      res.redirect(`/payment-success?orderId=${orderId}&transactionId=${transactionId}`);

    } else if (status === 'declined' || status === 'failed') {
      payment.status = 'failed';
      payment.errorMessage = responseMessage || 'Payment declined';
      payment.attempts += 1;

      await payment.save();

      // Log failure
      await auditLogger.log({
        userId: order.customerId,
        userType: 'customer',
        action: 'payment.failed',
        resourceType: 'payment',
        resourceId: payment._id,
        details: {
          orderId: order.orderId,
          reason: responseMessage,
          responseCode: responseCode
        }
      });

      // Redirect to error page
      res.redirect(`/payment-error?orderId=${orderId}&message=${encodeURIComponent(responseMessage || 'Payment failed')}`);

    } else {
      // Unknown status
      logger.error('Unknown payment status:', status);
      res.redirect(`/payment-error?orderId=${orderId}&message=Unknown payment status`);
    }

  } catch (error) {
    logger.error('Order payment callback error:', error);
    res.redirect('/payment-error?message=An error occurred processing your payment');
  }
}

/**
 * Handle Paygistix payment callback (POST version)
 */
router.post('/', async (req, res) => {
  try {
    logger.info('Paygistix POST callback received:', req.body);
    // Post-weigh workflow: only order-payment callbacks. V1 registration-payment
    // POST branch was removed in the Phase 2 refactor.
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Payment POST callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const emailService = require('../utils/emailService');
const auditLogger = require('../utils/auditLogger');

/**
 * Handle Paygistix payment callback
 * This endpoint receives the callback from Paygistix after payment processing
 */
router.get('/payment_callback', async (req, res) => {
  try {
    console.log('Paygistix callback received:', req.query);

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
      hash
    } = req.query;

    // Verify the callback is legitimate (implement hash verification)
    // In production, you should verify the hash to ensure the callback is from Paygistix

    // Find the order
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      console.error('Order not found for callback:', orderId);
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
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      await order.save();

      // Get customer for email
      const customer = await Customer.findOne({ customerId: order.customerId });

      // Update customer isActive to true on successful payment
      if (customer && !customer.isActive) {
        customer.isActive = true;
        await customer.save();
        console.log('Updated customer isActive status to true for customer:', customer.customerId);
      }

      // Send confirmation email
      if (customer) {
        try {
          await emailService.sendPaymentConfirmationEmail(customer, order, payment);
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
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
      console.error('Unknown payment status:', status);
      res.redirect(`/payment-error?orderId=${orderId}&message=Unknown payment status`);
    }

  } catch (error) {
    console.error('Payment callback error:', error);
    res.redirect('/payment-error?message=An error occurred processing your payment');
  }
});

/**
 * Handle Paygistix payment callback (POST version)
 * Some payment gateways use POST for callbacks
 */
router.post('/payment_callback', async (req, res) => {
  try {
    console.log('Paygistix POST callback received:', req.body);

    // Extract callback parameters from body
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
      hash
    } = req.body;

    // Process similar to GET callback
    // ... (same logic as above)

    // For POST callbacks, typically return a simple acknowledgment
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Payment POST callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

module.exports = router;
// Order payment service
//
// Applies a PaymentToken result (from Paygistix) to the associated Order.
// Extracted from customerController.updateV2OrderPayment in Phase 2 to break
// the customerController ↔ paymentController circular dependency.

const Order = require('../models/Order');
const logger = require('../utils/logger');

/**
 * Update an Order based on a completed (or failed) PaymentToken callback.
 * @param {Object} paymentToken - The PaymentToken document (with status and
 *                                customerData.orderId set).
 * @returns {Promise<boolean>} true if an order was updated, false otherwise.
 */
async function updateOrderPayment(paymentToken) {
  try {
    const orderId = paymentToken.customerData && paymentToken.customerData.orderId;

    logger.info('[Payment Update] Starting order update:', {
      paymentToken: paymentToken.token,
      orderId: orderId,
      status: paymentToken.status
    });

    if (!orderId) {
      logger.warn('No order ID found in payment token customerData:', paymentToken.token);
      return false;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn('No order found for order ID:', orderId);
      return false;
    }

    const paygistixResponse = paymentToken.paygistixResponse || {};

    if (paymentToken.status === 'success') {
      const cardType = paygistixResponse.CardType || paygistixResponse.cardType || '';
      const last4 = paygistixResponse.Last4 || paygistixResponse.last4 || '';
      const authCode = paygistixResponse.AuthCode || paygistixResponse.authCode || '';
      const amount = paygistixResponse.Amount || paygistixResponse.amount || order.estimatedTotal;

      order.paymentStatus = 'verified';
      order.paymentMethod = 'credit_card';
      order.paymentAmount = parseFloat(amount) || order.estimatedTotal;
      order.paymentTransactionId = paymentToken.transactionId;
      order.paymentVerifiedAt = new Date();

      const cardDetails = cardType && last4 ? `${cardType} ending in ${last4}` : 'Credit Card';
      const authDetails = authCode ? ` (Auth: ${authCode})` : '';
      order.paymentNotes = `Payment via ${cardDetails}${authDetails}`;

      logger.info('[Payment Update] Order payment verified and updated:', {
        orderId: order._id,
        orderNumber: order.orderId,
        transactionId: paymentToken.transactionId,
        amount: order.paymentAmount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        cardType: cardType,
        last4: last4
      });
    } else if (paymentToken.status === 'failed') {
      order.paymentStatus = 'failed';

      const failureCode = paygistixResponse.Result || paygistixResponse.result || '';
      const failureMsg = paygistixResponse.Message || paygistixResponse.message || paymentToken.errorMessage;
      order.paymentNotes = `Payment failed: ${failureMsg}${failureCode ? ` (Code: ${failureCode})` : ''}`;

      logger.error('Order payment failed:', {
        orderId: order._id,
        error: paymentToken.errorMessage
      });
    } else if (paymentToken.status === 'cancelled') {
      order.paymentStatus = 'pending';
      order.paymentNotes = 'Payment cancelled by user';

      logger.info('Order payment cancelled:', {
        orderId: order._id
      });
    }

    await order.save();
    return true;
  } catch (error) {
    logger.error('Error updating order payment:', error);
    return false;
  }
}

module.exports = { updateOrderPayment };

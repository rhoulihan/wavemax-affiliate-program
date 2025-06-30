// Unit tests for Payment model methods
const Payment = require('../../server/models/Payment');
const mongoose = require('mongoose');

describe('Payment Model Methods', () => {
  beforeEach(async () => {
    await Payment.deleteMany({});
  });

  describe('Instance Methods', () => {
    it('should determine if payment can be captured', () => {
      const payment = new Payment({
        orderId: new mongoose.Types.ObjectId(),
        customerId: new mongoose.Types.ObjectId(),
        amount: 10000,
        currency: 'usd',
        status: 'authorized',
        stripePaymentIntentId: 'pi_test123'
      });

      // Authorized payment can be captured
      expect(payment.canCapture()).toBe(true);

      // Succeeded payment cannot be captured
      payment.status = 'succeeded';
      expect(payment.canCapture()).toBe(false);

      // Failed payment cannot be captured
      payment.status = 'failed';
      expect(payment.canCapture()).toBe(false);

      // Refunded payment cannot be captured
      payment.status = 'refunded';
      expect(payment.canCapture()).toBe(false);

      // Processing payment cannot be captured
      payment.status = 'processing';
      expect(payment.canCapture()).toBe(false);
    });
  });
});
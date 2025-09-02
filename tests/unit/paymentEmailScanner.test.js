const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const mailcowService = require('../../server/services/mailcowService');
const imapScanner = require('../../server/services/imapEmailScanner');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');

// Mock email services
jest.mock('../../server/services/mailcowService');
jest.mock('../../server/services/imapEmailScanner');

describe('PaymentEmailScanner', () => {
  let testAffiliate, testCustomer, testOrder;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create test data
    const crypto = require('crypto');
    const affSalt = crypto.randomBytes(16).toString('hex');
    const affHash = crypto.pbkdf2Sync('testpass123', affSalt, 1000, 64, 'sha512').toString('hex');
    
    testAffiliate = await Affiliate.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '555-1111',
      address: '123 Affiliate St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      serviceLatitude: 30.123,
      serviceLongitude: -97.456,
      username: `affiliate${Date.now()}`,
      passwordHash: affHash,
      passwordSalt: affSalt,
      paymentMethod: 'check'
    });

    const custSalt = crypto.randomBytes(16).toString('hex');
    const custHash = crypto.pbkdf2Sync('testpass123', custSalt, 1000, 64, 'sha512').toString('hex');
    
    testCustomer = await Customer.create({
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@test.com',
      phone: '555-2222',
      address: '456 Customer Ave',
      city: 'Customer City',
      state: 'TX',
      zipCode: '54321',
      username: `customer${Date.now()}`,
      passwordHash: custHash,
      passwordSalt: custSalt,
      affiliateId: testAffiliate._id,
      registrationVersion: 'v2'
    });

    testOrder = await Order.create({
      customerId: testCustomer.customerId,
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date(),
      pickupTime: 'morning',
      estimatedWeight: 20,
      actualWeight: 22,
      numberOfBags: 2,
      status: 'processed',
      v2PaymentStatus: 'awaiting',
      v2PaymentAmount: 55.50,
      v2PaymentRequestedAt: new Date()
    });
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
  });

  describe('Email parsing', () => {
    it('should identify Venmo payments', () => {
      const provider = paymentEmailScanner.identifyProvider('payment@venmo.com');
      expect(provider).toBe('venmo');

      const provider2 = paymentEmailScanner.identifyProvider('noreply@notifications.venmo.com');
      expect(provider2).toBe('venmo');
    });

    it('should identify PayPal payments', () => {
      const provider = paymentEmailScanner.identifyProvider('service@paypal.com');
      expect(provider).toBe('paypal');

      const provider2 = paymentEmailScanner.identifyProvider('receipts@mail.paypal.com');
      expect(provider2).toBe('paypal');
    });

    it('should identify CashApp payments', () => {
      const provider = paymentEmailScanner.identifyProvider('cash@cash.app');
      expect(provider).toBe('cashapp');

      const provider2 = paymentEmailScanner.identifyProvider('receipts@square.com');
      expect(provider2).toBe('cashapp');
    });

    it('should return null for unknown providers', () => {
      const provider = paymentEmailScanner.identifyProvider('random@email.com');
      expect(provider).toBeNull();
    });

    it('should strip HTML tags correctly', () => {
      const html = '<p>Payment of <strong>$50.00</strong> received &amp; processed</p>';
      const text = paymentEmailScanner.stripHtml(html);
      expect(text).toBe('Payment of $50.00 received & processed');
    });
  });

  describe('Payment email parsing', () => {
    it('should parse Venmo payment email', async () => {
      const mockEmail = {
        id: 'email123',
        from: 'payment@venmo.com',
        subject: 'You received $55.50 from John Doe',
        text: 'Payment received for Order #' + testOrder._id.toString().slice(-8).toUpperCase(),
        text: 'Payment of $55.50 received. Note: WaveMAX Order #' + testOrder._id.toString().slice(-8).toUpperCase(),
        date: new Date()
      };

      const payment = await paymentEmailScanner.parsePaymentEmail(mockEmail);

      expect(payment).toBeDefined();
      expect(payment.provider).toBe('venmo');
      expect(payment.amount).toBe(55.50);
      expect(payment.orderId.toString()).toBe(testOrder._id.toString());
      expect(payment.shortOrderId).toBe(testOrder._id.toString().slice(-8).toUpperCase());
    });

    it('should parse PayPal payment email', async () => {
      const shortId = testOrder._id.toString().slice(-8).toUpperCase();
      const mockEmail = {
        id: 'email456',
        from: 'service@paypal.com',
        subject: 'Receipt for your payment',
        text: `You sent $55.50 USD to WaveMAX. Transaction ID: 1234567890. Notes: WaveMAX Order #${shortId}`,
        date: new Date()
      };

      const payment = await paymentEmailScanner.parsePaymentEmail(mockEmail);

      expect(payment).toBeDefined();
      expect(payment.provider).toBe('paypal');
      expect(payment.amount).toBe(55.50);
      expect(payment.orderId.toString()).toBe(testOrder._id.toString());
    });

    it('should parse CashApp payment email', async () => {
      const shortId = testOrder._id.toString().slice(-8).toUpperCase();
      const mockEmail = {
        id: 'email789',
        from: 'cash@square.com',
        subject: 'You sent $55.50',
        text: `Payment sent to $wavemax for $55.50. For: WaveMAX Order #${shortId}`,
        date: new Date()
      };

      const payment = await paymentEmailScanner.parsePaymentEmail(mockEmail);

      expect(payment).toBeDefined();
      expect(payment.provider).toBe('cashapp');
      expect(payment.amount).toBe(55.50);
      expect(payment.orderId.toString()).toBe(testOrder._id.toString());
    });

    it('should return null if order ID not found in email', async () => {
      const mockEmail = {
        id: 'email999',
        from: 'payment@venmo.com',
        subject: 'You received $50',
        text: 'Payment received with no order reference',
        date: new Date()
      };

      const payment = await paymentEmailScanner.parsePaymentEmail(mockEmail);
      expect(payment).toBeNull();
    });

    it('should return null if order not found in database', async () => {
      const mockEmail = {
        id: 'email111',
        from: 'payment@paypal.com',
        subject: 'Payment received',
        text: 'Payment for Order #NOTFOUND',
        date: new Date()
      };

      const payment = await paymentEmailScanner.parsePaymentEmail(mockEmail);
      expect(payment).toBeNull();
    });
  });

  describe('Order verification', () => {
    it('should verify and update order on successful payment match', async () => {
      const payment = {
        orderId: testOrder._id,
        provider: 'venmo',
        amount: 55.50,
        transactionId: 'VENMO123',
        emailSubject: 'Payment received',
        sender: 'John Doe'
      };

      const result = await paymentEmailScanner.verifyAndUpdateOrder(payment);

      expect(result).toBe(true);

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentStatus).toBe('verified');
      expect(updatedOrder.v2PaymentVerifiedAt).toBeDefined();
      expect(updatedOrder.v2PaymentTransactionId).toBe('VENMO123');
      expect(updatedOrder.v2PaymentMethod).toBe('venmo');
    });

    it('should allow small amount variance', async () => {
      const payment = {
        orderId: testOrder._id,
        provider: 'paypal',
        amount: 55.75, // $0.25 variance
        transactionId: 'PP123',
        emailSubject: 'Payment received',
        sender: 'Jane Doe'
      };

      const result = await paymentEmailScanner.verifyAndUpdateOrder(payment);

      expect(result).toBe(true);
      
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentStatus).toBe('verified');
      expect(updatedOrder.v2PaymentNotes).toContain('Amount variance');
    });

    it('should reject large amount variance', async () => {
      const payment = {
        orderId: testOrder._id,
        provider: 'cashapp',
        amount: 45.00, // $10.50 variance
        transactionId: 'CA123',
        emailSubject: 'Payment received',
        sender: 'Bob Smith'
      };

      const result = await paymentEmailScanner.verifyAndUpdateOrder(payment);

      expect(result).toBe(true); // Still verifies but notes discrepancy
      
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentNotes).toContain('Amount variance');
    });

    it('should skip already verified orders', async () => {
      testOrder.v2PaymentStatus = 'verified';
      await testOrder.save();

      const payment = {
        orderId: testOrder._id,
        provider: 'venmo',
        amount: 55.50,
        transactionId: 'VENMO456'
      };

      const result = await paymentEmailScanner.verifyAndUpdateOrder(payment);

      expect(result).toBe(true);
      
      // Should not change transaction ID
      const unchangedOrder = await Order.findById(testOrder._id);
      expect(unchangedOrder.v2PaymentTransactionId).not.toBe('VENMO456');
    });
  });

  describe('Batch payment scanning', () => {
    it('should process multiple payment emails', async () => {
      const shortId = testOrder._id.toString().slice(-8).toUpperCase();
      
      imapScanner.connect.mockResolvedValue(true);
      imapScanner.getUnreadEmails.mockResolvedValue([
        {
          uid: 'email1',
          from: 'payment@venmo.com',
          subject: 'Payment received',
          text: `Payment of $55.50. Note: Order #${shortId}`,
          date: new Date()
        },
        {
          uid: 'email2',
          from: 'random@gmail.com',
          subject: 'Hello',
          text: 'Not a payment email',
          date: new Date()
        }
      ]);

      imapScanner.markAsRead.mockResolvedValue(true);
      imapScanner.disconnect.mockReturnValue(undefined);

      const results = await paymentEmailScanner.scanForPayments();

      expect(results).toHaveLength(1);
      expect(results[0].orderId.toString()).toBe(testOrder._id.toString());
      expect(imapScanner.markAsRead).toHaveBeenCalled();
      expect(imapScanner.disconnect).toHaveBeenCalled();
    });

    it('should handle empty email list', async () => {
      imapScanner.connect.mockResolvedValue(true);
      imapScanner.getUnreadEmails.mockResolvedValue([]);
      imapScanner.disconnect.mockReturnValue(undefined);

      const results = await paymentEmailScanner.scanForPayments();

      expect(results).toEqual([]);
      expect(imapScanner.markAsRead).not.toHaveBeenCalled();
    });

    it('should handle email parsing errors gracefully', async () => {
      imapScanner.connect.mockResolvedValue(true);
      imapScanner.getUnreadEmails.mockResolvedValue([
        {
          uid: 'email1',
          from: 'payment@venmo.com',
          // Missing required fields
          date: new Date()
        }
      ]);
      imapScanner.disconnect.mockReturnValue(undefined);

      const results = await paymentEmailScanner.scanForPayments();

      expect(results).toEqual([]);
    });
  });

  describe('Order payment checking', () => {
    it('should check specific order for payment', async () => {
      const shortId = testOrder._id.toString().slice(-8).toUpperCase();
      
      mailcowService.searchEmails.mockResolvedValue([
        {
          id: 'found1',
          from: 'service@paypal.com',
          subject: 'Payment confirmation',
          text: `$55.50 USD received. Order #${shortId}`,
          date: new Date()
        }
      ]);

      mailcowService.markEmailAsProcessed.mockResolvedValue(true);

      const result = await paymentEmailScanner.checkOrderPayment(testOrder._id);

      expect(result).toBe(true);
      expect(mailcowService.searchEmails).toHaveBeenCalledWith(`Order #${shortId}`);
      
      const verifiedOrder = await Order.findById(testOrder._id);
      expect(verifiedOrder.v2PaymentStatus).toBe('verified');
    });

    it('should return false if no payment found', async () => {
      mailcowService.searchEmails.mockResolvedValue([]);

      const result = await paymentEmailScanner.checkOrderPayment(testOrder._id);

      expect(result).toBe(false);
      
      const unchangedOrder = await Order.findById(testOrder._id);
      expect(unchangedOrder.v2PaymentStatus).toBe('awaiting');
    });
  });

  describe('Process all pending payments', () => {
    it('should process all orders awaiting payment', async () => {
      // Create additional test order
      const order2 = await Order.create({
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 15,
        numberOfBags: 1,
        status: 'processed',
        v2PaymentStatus: 'awaiting',
        v2PaymentAmount: 35.00,
        v2PaymentRequestedAt: new Date()
      });

      mailcowService.searchEmails.mockResolvedValue([]);

      const results = await paymentEmailScanner.processAllPendingPayments();

      expect(results.processed).toBe(2);
      expect(results.verified).toBe(0);
      expect(results.failed).toBe(0);
    });

    it('should handle verification errors', async () => {
      mailcowService.searchEmails.mockRejectedValue(new Error('API error'));

      const results = await paymentEmailScanner.processAllPendingPayments();

      expect(results.processed).toBe(1);
      expect(results.verified).toBe(0);
      expect(results.failed).toBe(0);
    });
  });
});
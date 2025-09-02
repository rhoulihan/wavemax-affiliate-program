const paymentVerificationJob = require('../../server/jobs/paymentVerificationJob');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const paymentLinkService = require('../../server/services/paymentLinkService');

// Mock dependencies
jest.mock('../../server/services/paymentEmailScanner');
jest.mock('../../server/services/paymentLinkService');

describe('PaymentVerificationJob', () => {
  let testAffiliate, testCustomer, testOrder;

  beforeAll(async () => {
    // Initialize test data
    await SystemConfig.create([
      { key: 'payment_version', value: 'v2', dataType: 'string', category: 'payment' },
      { key: 'payment_check_interval', value: 300000, dataType: 'number', category: 'payment' },
      { key: 'payment_check_max_attempts', value: 48, dataType: 'number', category: 'payment' }
    ]);
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Generate password hash for affiliate
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    
    // Create test affiliate
    testAffiliate = await Affiliate.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '555-0001',
      address: '123 Test St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      serviceLatitude: 30.123,
      serviceLongitude: -97.456,
      username: `affiliate${Date.now()}`,
      passwordHash: hash,
      passwordSalt: salt,
      paymentMethod: 'check'
    });

    // Create V2 test customer
    const customerSalt = crypto.randomBytes(16).toString('hex');
    const customerHash = crypto.pbkdf2Sync('testpass123', customerSalt, 1000, 64, 'sha512').toString('hex');
    
    testCustomer = await Customer.create({
      name: 'Test Customer',
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@test.com',
      phone: '555-0002',
      address: '456 Customer St',
      city: 'Customer City',
      state: 'TX',
      zipCode: '54321',
      username: `customer${Date.now()}`,
      passwordHash: customerHash,
      passwordSalt: customerSalt,
      affiliateId: testAffiliate._id,
      registrationVersion: 'v2',
      initialBagsRequested: 2
    });

    // Create test order awaiting payment
    testOrder = await Order.create({
      customerId: testCustomer.customerId,
      affiliateId: testAffiliate.affiliateId,
      pickupDate: new Date(),
      pickupTime: 'morning',
      estimatedWeight: 20,
      actualWeight: 22,
      numberOfBags: 2,
      status: 'processed', // WDF complete
      v2PaymentStatus: 'awaiting',
      v2PaymentAmount: 50.00,
      v2PaymentRequestedAt: new Date(),
      v2PaymentCheckAttempts: 0
    });
  });

  afterEach(async () => {
    // Clean up test data
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Affiliate.deleteMany({});
  });

  afterAll(async () => {
    await SystemConfig.deleteMany({ key: { $in: ['payment_version', 'payment_check_interval', 'payment_check_max_attempts'] } });
  });

  describe('Job initialization', () => {
    it('should start when V2 payment system is enabled', async () => {
      await paymentVerificationJob.start();
      
      expect(paymentVerificationJob.job).toBeDefined();
      expect(paymentVerificationJob.checkInterval).toBe(5);
      expect(paymentVerificationJob.maxAttempts).toBe(48);
      
      paymentVerificationJob.stop();
    });

    it('should not start when V1 payment system is active', async () => {
      await SystemConfig.updateOne(
        { key: 'payment_version' },
        { value: 'v1' }
      );
      
      await paymentVerificationJob.start();
      
      expect(paymentVerificationJob.job).toBeNull();
      
      // Reset to V2
      await SystemConfig.updateOne(
        { key: 'payment_version' },
        { value: 'v2' }
      );
    });
  });

  describe('Payment verification', () => {
    it('should check for payments via email scanner', async () => {
      paymentEmailScanner.scanForPayments.mockResolvedValue([
        { orderId: testOrder._id, provider: 'venmo', amount: 50.00 }
      ]);
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(true);

      await paymentVerificationJob.runVerification();

      expect(paymentEmailScanner.scanForPayments).toHaveBeenCalled();
    });

    it('should increment check attempts for unverified payments', async () => {
      paymentEmailScanner.scanForPayments.mockResolvedValue([]);
      paymentEmailScanner.checkOrderPayment.mockResolvedValue(false);

      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      await paymentVerificationJob.processOrder(testOrder);

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentCheckAttempts).toBe(1);
      expect(updatedOrder.v2LastPaymentCheck).toBeDefined();
    });

    it('should mark order as failed after max attempts', async () => {
      testOrder.v2PaymentCheckAttempts = 47; // One attempt away from max
      await testOrder.save();

      paymentEmailScanner.checkOrderPayment.mockResolvedValue(false);

      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      await paymentVerificationJob.processOrder(testOrder);

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentStatus).toBe('failed');
      expect(updatedOrder.v2PaymentCheckAttempts).toBe(48);
    });
  });

  describe('Payment reminders', () => {
    it('should send first reminder after 30 minutes (6 attempts)', () => {
      const shouldRemind = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 6 });
      expect(shouldRemind).toBe(true);
    });

    it('should send hourly reminders after first 30 minutes', () => {
      // After 1 hour (12 attempts from 30 min mark)
      const oneHour = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 18 });
      expect(oneHour).toBe(true);

      // After 2 hours
      const twoHours = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 30 });
      expect(twoHours).toBe(true);

      // After 3 hours
      const threeHours = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 42 });
      expect(threeHours).toBe(true);
    });

    it('should not send reminders between hourly intervals', () => {
      const notHourly = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 20 });
      expect(notHourly).toBe(false);

      const notHourly2 = paymentVerificationJob.shouldSendReminder({ v2PaymentCheckAttempts: 35 });
      expect(notHourly2).toBe(false);
    });

    it('should generate fresh payment links when sending reminder', async () => {
      paymentLinkService.generatePaymentLinks.mockResolvedValue({
        links: {
          venmo: 'venmo://test',
          paypal: 'https://paypal.me/test',
          cashapp: 'https://cash.app/test'
        },
        qrCodes: {
          venmo: 'qr1',
          paypal: 'qr2',
          cashapp: 'qr3'
        },
        shortOrderId: 'ABC12345'
      });

      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      await paymentVerificationJob.sendPaymentReminder(testOrder);

      expect(paymentLinkService.generatePaymentLinks).toHaveBeenCalledWith(
        testOrder._id,
        expect.any(Number), // Accept any calculated amount
        expect.any(String)
      );
    });

    it('should include urgency information in reminders', async () => {
      testOrder.v2PaymentCheckAttempts = 36; // 3 hours elapsed
      
      paymentLinkService.generatePaymentLinks.mockResolvedValue({
        links: {},
        qrCodes: {},
        shortOrderId: 'ABC12345'
      });

      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      
      const consoleSpy = jest.spyOn(console, 'log');
      await paymentVerificationJob.sendPaymentReminder(testOrder);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('3 hours elapsed')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Admin escalation', () => {
    it('should escalate to admin after 4 hours', async () => {
      testOrder.v2PaymentCheckAttempts = 48;
      testOrder.v2PaymentRequestedAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
      await testOrder.save();

      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      
      const consoleSpy = jest.spyOn(console, 'log');
      await paymentVerificationJob.escalateToAdmin(testOrder);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Escalating payment timeout')
      );

      consoleSpy.mockRestore();
    });

    it('should include detailed order information in escalation', async () => {
      // Populate the customer for the test
      testOrder.customerId = testCustomer;
      
      const consoleSpy = jest.spyOn(console, 'log');
      await paymentVerificationJob.escalateToAdmin(testOrder);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Admin escalation details:',
        expect.objectContaining({
          orderId: testOrder.orderId,
          customerName: expect.any(String),
          customerEmail: expect.any(String),
          paymentAmount: expect.any(Number),
          attemptsMade: expect.any(Number)
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Order processing', () => {
    it('should skip non-V2 customers', async () => {
      const crypto = require('crypto');
      const v1Salt = crypto.randomBytes(16).toString('hex');
      const v1Hash = crypto.pbkdf2Sync('testpass123', v1Salt, 1000, 64, 'sha512').toString('hex');
      
      const v1Customer = await Customer.create({
        firstName: 'V1',
        lastName: 'Customer',
        name: 'V1 Customer',
        email: 'v1@test.com',
        phone: '555-0003',
        address: '789 V1 St',
        city: 'V1 City',
        state: 'TX',
        zipCode: '11111',
        username: `v1customer${Date.now()}`,
        passwordHash: v1Hash,
        passwordSalt: v1Salt,
        affiliateId: testAffiliate._id,
        registrationVersion: 'v1'
      });

      const v1Order = await Order.create({
        customerId: v1Customer.customerId,
        affiliateId: testAffiliate.affiliateId,
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 15,
        numberOfBags: 1,
        status: 'processed',
        v2PaymentCheckAttempts: 0
      });

      // Populate the customer for the test
      v1Order.customerId = v1Customer;
      
      await paymentVerificationJob.processOrder(v1Order);

      // Should not update V1 order
      const unchangedOrder = await Order.findById(v1Order._id);
      expect(unchangedOrder.v2PaymentCheckAttempts).toBe(0);
    });

    it('should handle orders already verified', async () => {
      testOrder.v2PaymentStatus = 'verified';
      await testOrder.save();

      await paymentVerificationJob.processOrder(testOrder);

      // Should not increment attempts
      const unchangedOrder = await Order.findById(testOrder._id);
      expect(unchangedOrder.v2PaymentCheckAttempts).toBe(0);
    });
  });

  describe('Job status', () => {
    it('should return correct status information', () => {
      paymentVerificationJob.checkInterval = 5;
      paymentVerificationJob.maxAttempts = 48;
      paymentVerificationJob.running = true;
      paymentVerificationJob.job = {};

      const status = paymentVerificationJob.getStatus();

      expect(status).toEqual({
        running: true,
        scheduled: true,
        checkInterval: 5,
        maxAttempts: 48
      });
    });

    it('should allow manual triggering', async () => {
      paymentEmailScanner.scanForPayments.mockResolvedValue([]);
      
      // Reset running state to allow manual trigger
      paymentVerificationJob.running = false;
      
      await paymentVerificationJob.triggerManual();

      expect(paymentEmailScanner.scanForPayments).toHaveBeenCalled();
    });
  });
});
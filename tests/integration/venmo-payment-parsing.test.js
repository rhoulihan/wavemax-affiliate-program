const paymentEmailScanner = require('../../server/services/paymentEmailScanner');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const mongoose = require('mongoose');

describe('Venmo Payment Email Parsing', () => {
  let testOrder;
  let testCustomer;
  let scanner;

  beforeEach(async () => {
    scanner = paymentEmailScanner; // Already instantiated singleton
    
    // Create test customer
    testCustomer = await Customer.create({
      customerId: 'CUST-TEST-VENMO',
      firstName: 'John',
      lastName: 'Houlihan',
      email: 'john@example.com',
      phone: '555-1234',
      address: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      username: 'johntest',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      affiliateId: 'AFF-TEST'
    });

    // Create test order with specific ID that matches the email
    // The last 8 chars of the ID should be '79015010' to match 'TEST-1756579015010'
    testOrder = new Order({
      _id: new mongoose.Types.ObjectId('675f563d3a17565879015010'),
      customerId: testCustomer.customerId,
      affiliateId: 'AFF-TEST',
      pickupDate: new Date(),
      pickupTime: 'morning',
      estimatedWeight: 10,
      actualWeight: 0, // Set to 0 to prevent recalculation
      actualTotal: 2.35,
      numberOfBags: 1,
      status: 'processing',
      v2PaymentStatus: 'awaiting',
      v2PaymentAmount: 2.35,
      v2PaymentRequestedAt: new Date()
    });
    // Save without triggering the pre-save hook that recalculates
    await testOrder.save({ validateBeforeSave: false });
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('HTML Email Parsing', () => {
    it('should parse Venmo HTML payment confirmation email', async () => {
      // This is the actual HTML from the Venmo email
      const venmoHtml = `
        <div style="font-family: Arial; font-size: 18px; line-height: 24px; margin: 0px 0px 8px; padding: 0px; text-align: center;">John Houlihan paid you</div>
        <div style="display: flex; margin-bottom: 16px; text-align: center;">
          <div style="display: flex; margin: 0px auto;">
            <div style="font-family: Arial; font-size: 20px; line-height: 25px; padding-top: 1px;">$</div>
            <div style="color: rgb(46, 48, 52); font-family: Arial; font-size: 41px; line-height: 40px;">2</div>
            <div style="font-family: Arial; font-size: 20px; line-height: 25px; padding-top: 1px;">35</div>
          </div>
        </div>
        <p style="color: rgb(107, 110, 118); font-size: 18px; line-height: 24px; margin: 0px 32px 16px; padding: 0px;">WaveMAX Order TEST-1756579015010</p>
        <h3 style="color: rgb(107, 110, 118); font-size: 16px; line-height: 1.375; margin: 0px 0px 4px; padding: 0px; overflow-wrap: normal;">Transaction ID</h3>
        <p style="font-size: 14px; line-height: 1.375; margin: 0px 0px 24px; padding: 0px;">4410913674527352924</p>
      `;

      const mockEmail = {
        from: 'venmo@venmo.com',
        fromAddress: 'notifications@venmo.com',
        subject: 'You received $2.35 from John Houlihan',
        html: venmoHtml,
        text: null,
        date: new Date('2025-08-30')
      };

      const result = await scanner.parsePaymentEmail(mockEmail);

      expect(result).toBeDefined();
      expect(result.provider).toBe('venmo');
      expect(result.amount).toBe(2.35);
      expect(result.sender).toBe('John Houlihan');
      expect(result.shortOrderId).toBe('79015010');
      expect(result.transactionId).toBe('4410913674527352924');
    });

    it('should correctly extract amount from Venmo HTML format', () => {
      // Test the specific Venmo amount format: $2.35 displayed as separate divs
      const amountHtml = `
        <div style="display: flex; margin: 0px auto;">
          <div style="font-family: Arial; font-size: 20px;">$</div>
          <div style="font-size: 41px;">2</div>
          <div style="font-size: 20px;">35</div>
        </div>
      `;

      // Strip HTML and extract amount
      const stripped = scanner.stripHtml(amountHtml);
      expect(stripped).toContain('$ 2 35');
      
      // Parse amount using enhanced pattern
      const amountPattern = /\$\s*(\d+)\s+(\d{2})/;
      const match = stripped.match(amountPattern);
      expect(match).toBeTruthy();
      
      if (match) {
        const dollars = parseInt(match[1]);
        const cents = parseInt(match[2]);
        const amount = dollars + (cents / 100);
        expect(amount).toBe(2.35);
      }
    });

    it('should extract order ID from payment note', () => {
      const noteHtml = `<p style="color: rgb(107, 110, 118);">WaveMAX Order TEST-1756579015010</p>`;
      const stripped = scanner.stripHtml(noteHtml);
      
      // Extract full order reference
      const fullOrderPattern = /Order\s+([A-Z0-9-]+)/i;
      const match = stripped.match(fullOrderPattern);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('TEST-1756579015010');
      
      // Extract just the last 8 chars for matching
      const shortId = match[1].slice(-8);
      expect(shortId).toBe('79015010');
    });

    it('should verify payment amount matches order total', async () => {
      const payment = {
        orderId: testOrder._id,
        shortOrderId: '79015010',
        provider: 'venmo',
        amount: 2.35,
        sender: 'John Houlihan',
        transactionId: '4410913674527352924',
        emailDate: new Date('2025-08-30')
      };

      const verified = await scanner.verifyAndUpdateOrder(payment);
      expect(verified).toBe(true);

      // Check order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.v2PaymentStatus).toBe('verified');
      expect(updatedOrder.v2PaymentMethod).toBe('venmo');
      expect(updatedOrder.v2PaymentVerifiedAt).toBeDefined();
      expect(updatedOrder.v2PaymentTransactionId).toBe('4410913674527352924');
    });

    it('should reject payment with incorrect amount', async () => {
      const payment = {
        orderId: testOrder._id,
        shortOrderId: '79015010',
        provider: 'venmo',
        amount: 1.00, // Underpayment - less than order total of 2.35
        sender: 'John Houlihan',
        transactionId: '4410913674527352924',
        emailDate: new Date('2025-08-30')
      };

      const verified = await scanner.verifyAndUpdateOrder(payment);
      expect(verified).toBe(false);

      // Check order was not updated
      const order = await Order.findById(testOrder._id);
      expect(order.v2PaymentStatus).toBe('awaiting');
    });
  });

  describe('Order ID Matching', () => {
    it('should match order by last 8 characters of ID', async () => {
      const shortId = '79015010';
      const order = await scanner.findOrderByShortId(shortId);
      
      expect(order).toBeDefined();
      expect(order._id.toString()).toContain('79015010');
      expect(order.v2PaymentStatus).toBe('awaiting');
    });

    it('should handle TEST- prefix in order ID', async () => {
      const noteText = 'WaveMAX Order TEST-1756579015010';
      
      // Pattern to extract order ID with TEST- prefix
      const pattern = /Order\s+(?:TEST-)?(\d+)/i;
      const match = noteText.match(pattern);
      
      expect(match).toBeTruthy();
      expect(match[1]).toBe('1756579015010');
      
      // Get last 8 chars for matching
      const shortId = match[1].slice(-8);
      expect(shortId).toBe('79015010');
    });
  });

  describe('Email Provider Detection', () => {
    it('should identify Venmo emails', () => {
      const venmoAddresses = [
        'notifications@venmo.com',
        'venmo@venmo.com',
        'support@venmo.com'
      ];

      venmoAddresses.forEach(email => {
        const provider = scanner.identifyProvider(email);
        expect(provider).toBe('venmo');
      });
    });

    it('should return null for unknown providers', () => {
      const provider = scanner.identifyProvider('test@example.com');
      expect(provider).toBeNull();
    });
  });
});
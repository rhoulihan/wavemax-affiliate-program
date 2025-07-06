const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Operator = require('../../server/models/Operator');
const SystemConfig = require('../../server/models/SystemConfig');

describe('WDF Credit System', () => {
  let testCustomer;
  let testOperator;

  beforeAll(async () => {
    // Connect to test database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
  });

  beforeEach(async () => {
    // Clear collections
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Operator.deleteMany({});

    // Create test customer
    testCustomer = await Customer.create({
      customerId: 'CUST-TEST-001',
      affiliateId: 'AFF-TEST-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.com',
      phone: '1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      username: 'johndoe',
      passwordSalt: 'salt',
      passwordHash: 'hash'
    });

    // Create test operator
    testOperator = await Operator.create({
      operatorId: 'OP-TEST-001',
      firstName: 'Test',
      lastName: 'Operator',
      email: 'operator@test.com',
      passwordSalt: 'salt',
      passwordHash: 'hash'
    });
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await Operator.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('WDF Credit Calculation', () => {
    it('should calculate positive WDF credit when actual weight > estimated weight', async () => {
      // Create an order with estimated weight
      const order = await Order.create({
        orderId: 'ORD-TEST-001',
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20, // Customer estimated 20 lbs
        numberOfBags: 2,
        baseRate: 1.25,
        status: 'processing'
      });

      // Mock request and response
      const req = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [
            { bagId: 'BAG001', weight: 15 },
            { bagId: 'BAG002', weight: 10 }
          ]
        },
        user: { id: testOperator._id }
      });
      const res = httpMocks.createResponse();

      // Weigh bags (actual weight = 25 lbs)
      await weighBags(req, res);

      // Check response
      expect(res.statusCode).toBe(200);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);

      // Verify order was updated
      const updatedOrder = await Order.findOne({ orderId: order.orderId });
      expect(updatedOrder.actualWeight).toBe(25);
      expect(updatedOrder.weightDifference).toBe(5); // 25 - 20 = 5
      expect(updatedOrder.wdfCreditGenerated).toBe(6.25); // 5 * 1.25 = 6.25

      // Verify customer credit was updated
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(6.25);
      expect(updatedCustomer.wdfCreditFromOrderId).toBe(order.orderId);
    });

    it('should calculate negative WDF credit when actual weight < estimated weight', async () => {
      // Create an order with estimated weight
      const order = await Order.create({
        orderId: 'ORD-TEST-002',
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30, // Customer estimated 30 lbs
        numberOfBags: 2,
        baseRate: 1.25,
        status: 'processing'
      });

      // Mock request and response
      const req = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [
            { bagId: 'BAG003', weight: 10 },
            { bagId: 'BAG004', weight: 15 }
          ]
        },
        user: { id: testOperator._id }
      });
      const res = httpMocks.createResponse();

      // Weigh bags (actual weight = 25 lbs)
      await weighBags(req, res);

      // Verify order was updated
      const updatedOrder = await Order.findOne({ orderId: order.orderId });
      expect(updatedOrder.actualWeight).toBe(25);
      expect(updatedOrder.weightDifference).toBe(-5); // 25 - 30 = -5
      expect(updatedOrder.wdfCreditGenerated).toBe(-6.25); // -5 * 1.25 = -6.25

      // Verify customer credit was updated (negative = debit)
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(-6.25);
    });

    it('should only calculate credit when all bags are weighed', async () => {
      // Create an order with 3 bags
      const order = await Order.create({
        orderId: 'ORD-TEST-003',
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        numberOfBags: 3,
        baseRate: 1.25,
        status: 'processing'
      });

      // Weigh only 2 bags
      const req = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [
            { bagId: 'BAG005', weight: 10 },
            { bagId: 'BAG006', weight: 10 }
          ]
        },
        user: { id: testOperator._id }
      });
      const res = httpMocks.createResponse();

      await weighBags(req, res);

      // Verify credit was NOT calculated yet
      const updatedOrder = await Order.findOne({ orderId: order.orderId });
      expect(updatedOrder.bagsWeighed).toBe(2);
      expect(updatedOrder.wdfCreditGenerated).toBe(0);

      // Verify customer credit was NOT updated
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(0);
    });
  });

  describe('WDF Credit Application', () => {
    it('should apply positive WDF credit to new order', async () => {
      // Set customer's WDF credit
      testCustomer.wdfCredit = 10.00;
      testCustomer.wdfCreditFromOrderId = 'ORD-PREVIOUS';
      await testCustomer.save();

      // Mock request for new order
      const req = httpMocks.createRequest({
        body: {
          customerId: testCustomer.customerId,
          affiliateId: 'AFF-TEST-001',
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 25,
          numberOfBags: 2,
          specialPickupInstructions: 'Test instructions'
        },
        user: { role: 'customer', customerId: testCustomer.customerId }
      });
      const res = httpMocks.createResponse();

      // Create new order
      await createOrder(req, res);

      // Check response
      expect(res.statusCode).toBe(201);
      const responseData = JSON.parse(res._getData());
      expect(responseData.success).toBe(true);
      expect(responseData.wdfCreditApplied).toBe(10.00);

      // Verify order was created with credit applied
      const newOrder = await Order.findOne({ orderId: responseData.orderId });
      expect(newOrder.wdfCreditApplied).toBe(10.00);
      
      // Calculate expected total: (25 lbs * $1.25) + $10 delivery fee - $10 credit = $31.25
      expect(newOrder.estimatedTotal).toBe(31.25);

      // Verify customer's credit was reset
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(0);
    });

    it('should apply negative WDF credit (debit) to new order', async () => {
      // Set customer's WDF credit (negative = debit)
      testCustomer.wdfCredit = -5.00;
      testCustomer.wdfCreditFromOrderId = 'ORD-PREVIOUS';
      await testCustomer.save();

      // Mock request for new order
      const req = httpMocks.createRequest({
        body: {
          customerId: testCustomer.customerId,
          affiliateId: 'AFF-TEST-001',
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1,
          specialPickupInstructions: 'Test instructions'
        },
        user: { role: 'customer', customerId: testCustomer.customerId }
      });
      const res = httpMocks.createResponse();

      // Create new order
      await createOrder(req, res);

      // Check response
      expect(res.statusCode).toBe(201);
      const responseData = JSON.parse(res._getData());
      expect(responseData.wdfCreditApplied).toBe(-5.00);

      // Verify order was created with debit applied
      const newOrder = await Order.findOne({ orderId: responseData.orderId });
      expect(newOrder.wdfCreditApplied).toBe(-5.00);
      
      // Calculate expected total: (20 lbs * $1.25) + $10 delivery fee - (-$5 debit) = $40
      expect(newOrder.estimatedTotal).toBe(40.00);

      // Verify customer's credit was reset
      const updatedCustomer = await Customer.findOne({ customerId: testCustomer.customerId });
      expect(updatedCustomer.wdfCredit).toBe(0);
    });

    it('should not apply credit if customer has zero credit', async () => {
      // Ensure customer has no credit
      expect(testCustomer.wdfCredit).toBe(0);

      // Mock request for new order
      const req = httpMocks.createRequest({
        body: {
          customerId: testCustomer.customerId,
          affiliateId: 'AFF-TEST-001',
          pickupDate: new Date().toISOString(),
          pickupTime: 'morning',
          estimatedWeight: 20,
          numberOfBags: 1
        },
        user: { role: 'customer', customerId: testCustomer.customerId }
      });
      const res = httpMocks.createResponse();

      // Create new order
      await createOrder(req, res);

      // Verify no credit was applied
      const responseData = JSON.parse(res._getData());
      expect(responseData.wdfCreditApplied).toBe(0);

      const newOrder = await Order.findOne({ orderId: responseData.orderId });
      expect(newOrder.wdfCreditApplied).toBe(0);
    });
  });

  describe('Order Model WDF Credit Calculations', () => {
    it('should correctly calculate estimated total with positive credit', async () => {
      const order = new Order({
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        baseRate: 1.25,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: 5.00 // $5 credit
      });

      await order.save();

      // Expected: (30 * 1.25) + 10 - 5 = 42.50
      expect(order.estimatedTotal).toBe(42.50);
    });

    it('should correctly calculate actual total with negative credit', async () => {
      const order = await Order.create({
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 25,
        baseRate: 1.25,
        numberOfBags: 1,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 2,
          totalFee: 10,
          minimumApplied: true
        },
        wdfCreditApplied: -3.50 // $3.50 debit
      });

      // Update with actual weight
      order.actualWeight = 28;
      await order.save();

      // Expected: (28 * 1.25) + 10 - (-3.50) = 48.50
      expect(order.actualTotal).toBe(48.50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle precision correctly for credit calculations', async () => {
      const order = await Order.create({
        orderId: 'ORD-TEST-004',
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 23.7,
        numberOfBags: 1,
        baseRate: 1.25,
        status: 'processing'
      });

      const req = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [{ bagId: 'BAG007', weight: 24.3 }]
        },
        user: { id: testOperator._id }
      });
      const res = httpMocks.createResponse();

      await weighBags(req, res);

      const updatedOrder = await Order.findOne({ orderId: order.orderId });
      expect(updatedOrder.weightDifference).toBeCloseTo(0.6, 2); // 24.3 - 23.7
      expect(updatedOrder.wdfCreditGenerated).toBe(0.75); // 0.6 * 1.25 = 0.75
    });

    it('should handle concurrent bag weighing correctly', async () => {
      const order = await Order.create({
        orderId: 'ORD-TEST-005',
        customerId: testCustomer.customerId,
        affiliateId: 'AFF-TEST-001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 40,
        numberOfBags: 2,
        baseRate: 1.25,
        status: 'processing'
      });

      // Simulate concurrent weighing of bags
      const req1 = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [{ bagId: 'BAG008', weight: 20 }]
        },
        user: { id: testOperator._id }
      });
      const res1 = httpMocks.createResponse();

      const req2 = httpMocks.createRequest({
        body: {
          orderId: order.orderId,
          bags: [{ bagId: 'BAG009', weight: 25 }]
        },
        user: { id: testOperator._id }
      });
      const res2 = httpMocks.createResponse();

      // Execute both requests
      await Promise.all([
        weighBags(req1, res1),
        weighBags(req2, res2)
      ]);

      // Verify final state
      const updatedOrder = await Order.findOne({ orderId: order.orderId });
      expect(updatedOrder.bagsWeighed).toBe(2);
      expect(updatedOrder.actualWeight).toBe(45);
      expect(updatedOrder.wdfCreditGenerated).toBe(6.25); // (45-40) * 1.25
    });
  });
});
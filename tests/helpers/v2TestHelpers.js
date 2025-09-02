// V2 Payment Flow Test Helpers
// Provides reusable test data setup functions with deterministic IDs

const mongoose = require('mongoose');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const crypto = require('crypto');

// Deterministic test IDs for consistent data
const TEST_IDS = {
  affiliate: 'AFF-V2-TEST-001',
  customer: 'CUST-V2-TEST-001', 
  order: new mongoose.Types.ObjectId('607f1f77bcf86cd799439011'),
  // Additional IDs for multiple test scenarios
  customer2: 'CUST-V2-TEST-002',
  order2: new mongoose.Types.ObjectId('607f1f77bcf86cd799439012'),
  customer3: 'CUST-V2-TEST-003',
  order3: new mongoose.Types.ObjectId('607f1f77bcf86cd799439013'),
};

/**
 * Create or get test affiliate with deterministic ID
 */
async function ensureTestAffiliate(options = {}) {
  const affiliateId = options.affiliateId || TEST_IDS.affiliate;
  
  // Try to find existing affiliate
  let affiliate = await Affiliate.findOne({ affiliateId });
  
  if (!affiliate) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('TestPass@2024!', salt, 1000, 64, 'sha512').toString('hex');
    
    affiliate = await Affiliate.create({
      affiliateId,
      businessName: options.businessName || 'V2 Test Affiliate',
      email: options.email || 'v2-affiliate@test.com',
      username: options.username || 'v2affiliate',
      passwordHash: hash,
      passwordSalt: salt,
      phone: options.phone || '555-0001',
      firstName: options.firstName || 'Test',
      lastName: options.lastName || 'Affiliate',
      address: options.address || '123 Test St',
      city: options.city || 'Test City',
      state: options.state || 'TX',
      zipCode: options.zipCode || '78701',
      serviceLatitude: options.serviceLatitude || 30.2672,
      serviceLongitude: options.serviceLongitude || -97.7431,
      paymentMethod: options.paymentMethod || 'check',
      commissionRate: options.commissionRate || 20,
      minimumDeliveryFee: options.minimumDeliveryFee || 10,
      perBagDeliveryFee: options.perBagDeliveryFee || 2.50,
      isActive: true
    });
  }
  
  return affiliate;
}

/**
 * Create or get test customer with deterministic ID
 */
async function ensureTestCustomer(options = {}) {
  const customerId = options.customerId || TEST_IDS.customer;
  const affiliateId = options.affiliateId || TEST_IDS.affiliate;
  
  // Ensure affiliate exists first
  await ensureTestAffiliate({ affiliateId });
  
  // Try to find existing customer
  let customer = await Customer.findOne({ customerId });
  
  if (!customer) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('TestPass@2024!', salt, 1000, 64, 'sha512').toString('hex');
    
    customer = await Customer.create({
      customerId,
      firstName: options.firstName || 'V2Test',
      lastName: options.lastName || 'Customer',
      email: options.email || 'v2customer@test.com',
      phone: options.phone || '555-0199',
      username: options.username || 'v2testcustomer',
      passwordHash: hash,
      passwordSalt: salt,
      address: options.address || '123 Test St',
      city: options.city || 'Austin',
      state: options.state || 'TX',
      zipCode: options.zipCode || '78701',
      affiliateId,
      languagePreference: options.languagePreference || 'en',
      registrationVersion: 'v2',
      initialBagsRequested: options.initialBagsRequested || 2,
      bagCredit: options.bagCredit || 2,
      isActive: true
    });
  }
  
  return customer;
}

/**
 * Create test order in specific state
 */
async function createTestOrder(options = {}) {
  const orderId = options._id || TEST_IDS.order;
  const customerId = options.customerId || TEST_IDS.customer;
  const affiliateId = options.affiliateId || TEST_IDS.affiliate;
  
  // Ensure customer exists first
  await ensureTestCustomer({ customerId, affiliateId });
  
  // Delete existing order with same ID if it exists
  await Order.findByIdAndDelete(orderId);
  
  const orderData = {
    _id: orderId,
    customerId,
    affiliateId,
    pickupDate: options.pickupDate || new Date(Date.now() + 86400000),
    pickupTime: options.pickupTime || 'morning',
    numberOfBags: options.numberOfBags || 2,
    estimatedWeight: options.estimatedWeight || 20,
    status: options.status || 'pending',
    
    // V2 Payment fields
    v2PaymentStatus: options.v2PaymentStatus || 'pending',
    v2PaymentAmount: options.v2PaymentAmount || null,
    v2PaymentMethod: options.v2PaymentMethod || null,
    v2PaymentRequestedAt: options.v2PaymentRequestedAt || null,
    v2PaymentVerifiedAt: options.v2PaymentVerifiedAt || null,
    v2PaymentLinks: options.v2PaymentLinks || null,
    v2PaymentCheckAttempts: options.v2PaymentCheckAttempts || 0,
    v2PaymentReminderCount: options.v2PaymentReminderCount || 0,
    v2PaymentLastReminderAt: options.v2PaymentLastReminderAt || null,
    
    // Actual weight and processing
    actualWeight: options.actualWeight || null,
    actualTotal: options.actualTotal || null,
    bagsWeighed: options.bagsWeighed || 0,
    bagsProcessed: options.bagsProcessed || 0,
    bagsPickedUp: options.bagsPickedUp || 0,
    
    // Bags array
    bags: options.bags || [],
    
    // Payment status
    isPaid: options.isPaid !== undefined ? options.isPaid : false
  };
  
  // Remove null values to let defaults apply
  Object.keys(orderData).forEach(key => {
    if (orderData[key] === null) {
      delete orderData[key];
    }
  });
  
  const order = new Order(orderData);
  
  // Save without validation if we're setting specific values
  if (options.skipValidation) {
    await order.save({ validateBeforeSave: false });
  } else {
    await order.save();
  }
  
  return order;
}

/**
 * Create a complete V2 payment scenario
 * Returns customer and order ready for payment processing
 */
async function setupV2PaymentScenario(options = {}) {
  // Initialize SystemConfig
  await SystemConfig.deleteMany({});
  await SystemConfig.initializeDefaults();
  
  // Set to V2 payment mode
  await SystemConfig.findOneAndUpdate(
    { key: 'payment_version' },
    { value: 'v2' },
    { upsert: true }
  );
  
  const affiliate = await ensureTestAffiliate(options.affiliate || {});
  const customer = await ensureTestCustomer({
    ...options.customer,
    affiliateId: affiliate.affiliateId
  });
  
  // Create order in processing state with weight
  const order = await createTestOrder({
    ...options.order,
    customerId: customer.customerId,
    affiliateId: affiliate.affiliateId,
    status: 'processing',
    actualWeight: 10,
    actualTotal: 12.50,
    bagsWeighed: 2,
    v2PaymentStatus: 'awaiting',
    v2PaymentAmount: 12.50,
    v2PaymentRequestedAt: new Date(),
    v2PaymentLinks: {
      venmo: 'venmo://paycharge?txn=pay&recipients=wavemax&amount=12.50',
      paypal: 'https://paypal.me/wavemax/12.50',
      cashapp: 'https://cash.app/$wavemax/12.50'
    },
    bags: [
      { bagId: 'bag-001', weight: 5, status: 'processing', bagNumber: 1 },
      { bagId: 'bag-002', weight: 5, status: 'processing', bagNumber: 2 }
    ],
    skipValidation: true
  });
  
  return { affiliate, customer, order };
}

/**
 * Create order ready for payment verification
 */
async function setupOrderForPaymentVerification(options = {}) {
  const { affiliate, customer, order } = await setupV2PaymentScenario(options);
  
  // Update order to have payment verified
  order.v2PaymentStatus = 'verified';
  order.v2PaymentVerifiedAt = new Date();
  order.v2PaymentTransactionId = options.transactionId || 'TEST-TXN-001';
  order.v2PaymentMethod = options.paymentMethod || 'venmo';
  await order.save({ validateBeforeSave: false });
  
  return { affiliate, customer, order };
}

/**
 * Clean up test data
 */
async function cleanupV2TestData() {
  // Delete orders first (due to foreign key constraints)
  await Order.deleteMany({
    _id: { $in: [TEST_IDS.order, TEST_IDS.order2, TEST_IDS.order3] }
  });
  
  // Delete customers
  await Customer.deleteMany({
    customerId: { $in: [TEST_IDS.customer, TEST_IDS.customer2, TEST_IDS.customer3] }
  });
  
  // Delete affiliates
  await Affiliate.deleteMany({
    affiliateId: { $regex: /^AFF-V2-TEST-/ }
  });
}

/**
 * Create multiple test scenarios for different test cases
 */
async function createMultipleTestScenarios() {
  const scenarios = [];
  
  // Scenario 1: Order awaiting payment
  scenarios.push(await setupV2PaymentScenario({
    customer: { customerId: TEST_IDS.customer },
    order: { _id: TEST_IDS.order }
  }));
  
  // Scenario 2: Order with payment verified
  scenarios.push(await setupOrderForPaymentVerification({
    customer: { customerId: TEST_IDS.customer2 },
    order: { _id: TEST_IDS.order2 }
  }));
  
  // Scenario 3: Order ready for pickup
  const scenario3 = await setupOrderForPaymentVerification({
    customer: { customerId: TEST_IDS.customer3 },
    order: { _id: TEST_IDS.order3 }
  });
  scenario3.order.status = 'processed';
  scenario3.order.bagsProcessed = 2;
  await scenario3.order.save({ validateBeforeSave: false });
  scenarios.push(scenario3);
  
  return scenarios;
}

module.exports = {
  TEST_IDS,
  ensureTestAffiliate,
  ensureTestCustomer,
  createTestOrder,
  setupV2PaymentScenario,
  setupOrderForPaymentVerification,
  cleanupV2TestData,
  createMultipleTestScenarios
};
// Order/affiliate/customer test data helpers with deterministic IDs.
// (Payment-scenario helpers were removed with the V2 payment subsystem.)

const mongoose = require('mongoose');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
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
    bagId: options.bagId || `BAG-${require('uuid').v4()}`,
    bagToken: options.bagToken || require('crypto').randomBytes(16).toString('hex'),
    feeBreakdown: options.feeBreakdown || {
      numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true
    },
    status: options.status || 'in_progress',

    // Actual weight and processing
    actualWeight: options.actualWeight || null,
    actualTotal: options.actualTotal || null,

    // Bags array
    bags: options.bags || []
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

module.exports = {
  TEST_IDS,
  ensureTestAffiliate,
  ensureTestCustomer,
  createTestOrder,
  cleanupV2TestData
};
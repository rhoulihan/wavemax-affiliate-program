const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');
const Order = require('../server/models/Order');
const Administrator = require('../server/models/Administrator');
const Operator = require('../server/models/Operator');
const SystemConfig = require('../server/models/SystemConfig');
const encryptionUtil = require('../server/utils/encryption');

let testDataIds = {
  affiliates: [],
  customers: [],
  orders: [],
  administrators: [],
  operators: []
};

async function createTestAffiliate(data = {}) {
  // Generate proper password hash and salt if not provided
  let passwordHash = data.passwordHash;
  let passwordSalt = data.passwordSalt;
  
  if (!passwordHash || !passwordSalt) {
    const { hash, salt } = encryptionUtil.hashPassword('password123');
    passwordHash = hash;
    passwordSalt = salt;
  }
  
  const affiliateData = {
    affiliateId: data.affiliateId || `TEST_AFF_${Date.now()}`,
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'Affiliate',
    email: data.email || `test${Date.now()}@example.com`,
    phone: data.phone || '555-0123',
    businessName: data.businessName || 'Test Business',
    address: data.address || '123 Test St',
    city: data.city || 'Test City',
    state: data.state || 'CA',
    zipCode: data.zipCode || '90210',
    deliveryFee: data.deliveryFee !== undefined ? data.deliveryFee : 5.00,
    username: data.username || `testaffiliate${Date.now()}`,
    passwordSalt: passwordSalt,
    passwordHash: passwordHash,
    paymentMethod: data.paymentMethod || 'check',
    referralCode: data.referralCode || `TEST${Date.now()}`,
    commissionRate: data.commissionRate || 10,
    isActive: data.isActive !== undefined ? data.isActive : true,
    ...data
  };

  const affiliate = new Affiliate(affiliateData);
  await affiliate.save();
  testDataIds.affiliates.push(affiliate._id);
  return affiliate;
}

async function createTestCustomer(affiliateId, data = {}) {
  // Generate proper password hash and salt if not provided
  let passwordHash = data.passwordHash;
  let passwordSalt = data.passwordSalt;
  
  if (!passwordHash || !passwordSalt) {
    const { hash, salt } = encryptionUtil.hashPassword('password123');
    passwordHash = hash;
    passwordSalt = salt;
  }
  
  const customerData = {
    customerId: data.customerId || `TEST_CUST_${Date.now()}`,
    affiliateId: affiliateId,
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'Customer',
    email: data.email || `testcustomer${Date.now()}@example.com`,
    phone: data.phone || '555-0456',
    address: data.address || '456 Test Ave',
    city: data.city || 'Test City',
    state: data.state || 'CA',
    zipCode: data.zipCode || '90210',
    username: data.username || `testcustomer${Date.now()}`,
    passwordSalt: passwordSalt,
    passwordHash: passwordHash,
    bagCredit: data.bagCredit || 0,
    bagCreditApplied: data.bagCreditApplied || false,
    wdfCredit: data.wdfCredit || 0,
    wdfCreditApplied: data.wdfCreditApplied || false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    serviceFrequency: data.serviceFrequency || 'weekly',
    ...data
  };

  const customer = new Customer(customerData);
  await customer.save();
  testDataIds.customers.push(customer._id);
  return customer;
}

async function createTestOrder(customerId, affiliateId, data = {}) {
  const bagToken = data.bagToken || require('crypto').randomBytes(16).toString('hex');
  const orderData = {
    orderId: `TEST_ORD_${Date.now()}`,
    customerId: customerId,
    affiliateId: affiliateId,
    bagId: data.bagId || `BAG-${require('uuid').v4()}`,
    bagToken,
    actualWeight: data.actualWeight !== undefined ? data.actualWeight : 20,
    feeBreakdown: data.feeBreakdown || {
      numberOfBags: 1, minimumFee: 10, perBagFee: 2, totalFee: 10, minimumApplied: true
    },
    wdfCreditApplied: data.wdfCreditApplied || 0,
    status: data.status || 'in_progress',
    ...data
  };

  const order = new Order(orderData);
  await order.save();
  testDataIds.orders.push(order._id);
  return order;
}

async function cleanupTestData() {
  // Clean up all test data
  if (testDataIds.orders.length > 0) {
    await Order.deleteMany({ _id: { $in: testDataIds.orders } });
  }
  if (testDataIds.customers.length > 0) {
    await Customer.deleteMany({ _id: { $in: testDataIds.customers } });
  }
  if (testDataIds.affiliates.length > 0) {
    await Affiliate.deleteMany({ _id: { $in: testDataIds.affiliates } });
  }
  if (testDataIds.administrators.length > 0) {
    await Administrator.deleteMany({ _id: { $in: testDataIds.administrators } });
  }
  if (testDataIds.operators.length > 0) {
    await Operator.deleteMany({ _id: { $in: testDataIds.operators } });
  }

  // Reset the arrays
  testDataIds = {
    affiliates: [],
    customers: [],
    orders: [],
    administrators: [],
    operators: []
  };
}

module.exports = {
  createTestAffiliate,
  createTestCustomer,
  createTestOrder,
  cleanupTestData,
  testDataIds
};
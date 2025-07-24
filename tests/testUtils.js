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
    serviceLatitude: data.serviceLatitude || 34.0522,
    serviceLongitude: data.serviceLongitude || -118.2437,
    serviceRadius: data.serviceRadius || 5,
    minimumDeliveryFee: data.minimumDeliveryFee || 5.00,
    perBagDeliveryFee: data.perBagDeliveryFee || 2.00,
    username: data.username || `testaffiliate${Date.now()}`,
    passwordSalt: passwordSalt,
    passwordHash: passwordHash,
    paymentMethod: data.paymentMethod || 'check',
    registrationMethod: data.registrationMethod || 'traditional',
    referralCode: data.referralCode || `TEST${Date.now()}`,
    commissionRate: data.commissionRate || 10,
    isActive: data.isActive !== undefined ? data.isActive : true,
    w9OnFile: data.w9OnFile || false,
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
  const orderData = {
    orderId: `TEST_ORD_${Date.now()}`,
    customerId: customerId,
    affiliateId: affiliateId,
    pickupDate: data.pickupDate || new Date(Date.now() + 86400000),
    pickupTime: data.pickupTime || 'morning',
    estimatedWeight: data.estimatedWeight || 20,
    numberOfBags: data.numberOfBags || 2,
    estimatedTotal: data.estimatedTotal || 30.00,
    bagCreditApplied: data.bagCreditApplied || 0,
    wdfCreditApplied: data.wdfCreditApplied || 0,
    status: data.status || 'pending',
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
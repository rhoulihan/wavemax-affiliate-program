#!/usr/bin/env node

/**
 * Generate Sample Data Script
 * Creates realistic test data for the WaveMAX Laundry Affiliate Program
 * 
 * Creates:
 * - 20 affiliates
 * - 10-20 customers per affiliate
 * - 7-12 orders per customer over the last 60 days
 * - 1-2 bags per order averaging 30 lbs each
 * - ~1/3 of customers have an order in process (placed within last 24 hours)
 * - All other orders are completed with 20-30 hours processing time
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const crypto = require('crypto');

// Import models
const Administrator = require('../server/models/Administrator');
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');
const Order = require('../server/models/Order');
const SystemConfig = require('../server/models/SystemConfig');

// Set seed for consistent data
faker.seed(12345);

// Configuration
const NUM_AFFILIATES = 20;
const MIN_CUSTOMERS_PER_AFFILIATE = 10;
const MAX_CUSTOMERS_PER_AFFILIATE = 20;
const MIN_ORDERS_PER_CUSTOMER = 7;
const MAX_ORDERS_PER_CUSTOMER = 12;
const MIN_BAGS_PER_ORDER = 1;
const MAX_BAGS_PER_ORDER = 2;
const AVG_LBS_PER_BAG = 30;
const LBS_VARIANCE = 10; // +/- 10 lbs
const DAYS_HISTORY = 60;
const MIN_PROCESSING_HOURS = 20;
const MAX_PROCESSING_HOURS = 30;
const DEFAULT_PASSWORD = 'TestPass123!';

// Austin, TX area zip codes
const AUSTIN_ZIP_CODES = ['78701', '78702', '78703', '78704', '78705', '78731', '78745', '78746', '78748', '78749'];

// Helper functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function hashPassword(password) {
  // Generate a random salt
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Hash the password with PBKDF2
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    100000, // 100,000 iterations
    64,     // 64 bytes
    'sha512'
  ).toString('hex');
  
  return { salt, hash };
}

function generateAustinAddress() {
  const streetNumber = faker.number.int({ min: 100, max: 9999 });
  const streetName = faker.location.street();
  const zipCode = getRandomElement(AUSTIN_ZIP_CODES);
  
  return {
    street: `${streetNumber} ${streetName}`,
    city: 'Austin',
    state: 'TX',
    zipCode: zipCode
  };
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax');
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Initialize system configuration
async function initializeSystemConfig() {
  try {
    await SystemConfig.initializeDefaults();
    console.log('✓ System configuration initialized');
  } catch (error) {
    console.error('✗ Error initializing system config:', error);
  }
}

// Clean existing data
async function cleanData() {
  console.log('\n🧹 Cleaning existing sample data...');
  
  // Only delete test data (affiliates with email ending in @example.com)
  const testAffiliates = await Affiliate.find({ email: /@example\.com$/ });
  const testAffiliateIds = testAffiliates.map(a => a._id);
  
  if (testAffiliateIds.length > 0) {
    // Delete related data
    await Order.deleteMany({ affiliateId: { $in: testAffiliateIds } });
    await Customer.deleteMany({ affiliateId: { $in: testAffiliateIds } });
    await Affiliate.deleteMany({ _id: { $in: testAffiliateIds } });
    
    console.log(`✓ Cleaned ${testAffiliateIds.length} test affiliates and related data`);
  } else {
    console.log('✓ No test data to clean');
  }
}

// Generate affiliates
async function generateAffiliates() {
  console.log('\n👥 Generating affiliates...');
  const affiliates = [];
  
  for (let i = 1; i <= NUM_AFFILIATES; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const address = generateAustinAddress();
    
    const longitude = -97.7431 + (Math.random() - 0.5) * 0.2; // Austin longitude +/- variance
    const latitude = 30.2672 + (Math.random() - 0.5) * 0.2;   // Austin latitude +/- variance
    const paymentMethod = getRandomElement(['directDeposit', 'check', 'paypal']);
    
    // Hash the password
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    
    const affiliateData = {
      affiliateId: `AFF${String(i).padStart(3, '0')}`,
      username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      firstName,
      lastName,
      businessName: faker.company.name() + ' Services',
      phone: faker.phone.number({ style: 'national' }),
      address: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      serviceLatitude: latitude,
      serviceLongitude: longitude,
      serviceRadius: getRandomInt(5, 15), // 5-15 miles radius
      minimumDeliveryFee: getRandomFloat(10, 15),
      perBagDeliveryFee: getRandomFloat(5, 8),
      paymentMethod: paymentMethod,
      isActive: true,
      termsAccepted: true,
      registrationDate: faker.date.past(1),
      registrationMethod: 'traditional',
      passwordSalt: salt,
      passwordHash: hash
    };
    
    // Add payment-specific fields based on payment method
    if (paymentMethod === 'directDeposit') {
      affiliateData.accountNumber = faker.finance.accountNumber();
      affiliateData.routingNumber = faker.finance.routingNumber();
    } else if (paymentMethod === 'paypal') {
      affiliateData.paypalEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@paypal.com`;
    }
    
    const affiliate = new Affiliate(affiliateData);
    
    await affiliate.save();
    affiliates.push(affiliate);
    
    process.stdout.write(`\r✓ Created ${i}/${NUM_AFFILIATES} affiliates`);
  }
  
  console.log('\n✓ All affiliates created');
  return affiliates;
}

// Generate customers for each affiliate
async function generateCustomers(affiliates) {
  console.log('\n👤 Generating customers...');
  const allCustomers = [];
  let totalCustomers = 0;
  
  for (const affiliate of affiliates) {
    const numCustomers = getRandomInt(MIN_CUSTOMERS_PER_AFFILIATE, MAX_CUSTOMERS_PER_AFFILIATE);
    const customers = [];
    
    for (let i = 1; i <= numCustomers; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const address = generateAustinAddress();
      
      // Hash the password for customer
      const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
      
      const customer = new Customer({
        customerId: `CUST${Date.now()}${getRandomInt(1000, 9999)}`,
        username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${totalCustomers + i}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${totalCustomers + i}@example.com`,
        passwordSalt: salt,
        passwordHash: hash,
        firstName,
        lastName,
        phone: faker.phone.number({ style: 'national' }),
        address: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        affiliateId: affiliate._id,
        specialInstructions: faker.lorem.words(5),
        paymentMethods: [{
          type: 'card',
          isDefault: true,
          cardLast4: faker.finance.creditCardNumber().slice(-4),
          cardBrand: getRandomElement(['visa', 'mastercard', 'amex', 'discover']),
          expiryMonth: getRandomInt(1, 12),
          expiryYear: getRandomInt(2025, 2030)
        }],
        registrationDate: faker.date.between({
          from: new Date(Date.now() - DAYS_HISTORY * 24 * 60 * 60 * 1000),
          to: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // At least 7 days ago
        }),
        isActive: true,
        registrationMethod: 'traditional'
      });
      
      await customer.save();
      customers.push(customer);
    }
    
    totalCustomers += customers.length;
    allCustomers.push(...customers);
    process.stdout.write(`\r✓ Created ${totalCustomers} customers`);
  }
  
  console.log(`\n✓ All customers created (${totalCustomers} total)`);
  return allCustomers;
}

// Generate orders for customers
async function generateOrders(customers) {
  console.log('\n📦 Generating orders...');
  let totalOrders = 0;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Shuffle customers and select ~1/3 for in-process orders
  const shuffledCustomers = [...customers].sort(() => Math.random() - 0.5);
  const numInProcessCustomers = Math.floor(customers.length / 3);
  const inProcessCustomers = new Set(shuffledCustomers.slice(0, numInProcessCustomers).map(c => c._id.toString()));
  
  for (const customer of customers) {
    const numOrders = getRandomInt(MIN_ORDERS_PER_CUSTOMER, MAX_ORDERS_PER_CUSTOMER);
    const affiliate = await Affiliate.findById(customer.affiliateId);
    const hasInProcessOrder = inProcessCustomers.has(customer._id.toString());
    
    for (let i = 1; i <= numOrders; i++) {
      const isLastOrder = i === numOrders;
      const isInProcess = hasInProcessOrder && isLastOrder;
      
      // Determine order date - distribute evenly over time
      let orderDate;
      if (isInProcess) {
        // In-process order: placed within last 24 hours
        orderDate = faker.date.between({ from: twentyFourHoursAgo, to: now });
      } else {
        // Completed order: randomly spread over the last 60 days with some variation
        // Use a more natural distribution - slightly weighted towards recent days
        const daysAgo = Math.floor(Math.random() * (DAYS_HISTORY - 2)) + 2;
        
        // Add some weight to recent days (20% chance to be in last 7 days)
        if (Math.random() < 0.2) {
          const recentDaysAgo = getRandomInt(2, 7);
          orderDate = new Date(now.getTime() - recentDaysAgo * 24 * 60 * 60 * 1000);
        } else {
          orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        }
        
        // Add randomness within the day
        orderDate.setHours(getRandomInt(8, 20), getRandomInt(0, 59), getRandomInt(0, 59), 0);
      }
      
      // Generate bags for the order
      const numBags = getRandomInt(MIN_BAGS_PER_ORDER, MAX_BAGS_PER_ORDER);
      const bags = [];
      let totalWeight = 0;
      
      for (let j = 1; j <= numBags; j++) {
        const weight = getRandomFloat(
          AVG_LBS_PER_BAG - LBS_VARIANCE,
          AVG_LBS_PER_BAG + LBS_VARIANCE,
          1
        );
        bags.push({
          bagNumber: j,
          weight: weight,
          description: `Bag ${j} - Mixed laundry`
        });
        totalWeight += weight;
      }
      
      // Calculate pricing
      const wdfRate = 1.25; // $1.25 per pound
      const wdfTotal = totalWeight * wdfRate;
      const deliveryFee = Math.max(
        affiliate.minimumDeliveryFee,
        numBags * affiliate.perBagDeliveryFee
      );
      const orderTotal = wdfTotal + deliveryFee;
      const affiliateCommission = wdfTotal * 0.10; // 10% commission
      
      // Determine order status and dates
      let status, pickupDate, processingStartDate, processingEndDate, deliveryDate;
      
      if (isInProcess) {
        // In-process order
        status = getRandomElement(['scheduled', 'processing', 'processed']);
        pickupDate = new Date(orderDate.getTime() + getRandomInt(1, 4) * 60 * 60 * 1000); // 1-4 hours after order
        
        if (status === 'processing' || status === 'processed') {
          processingStartDate = new Date(pickupDate.getTime() + getRandomInt(1, 2) * 60 * 60 * 1000);
        }
        if (status === 'processed') {
          // Processed but not yet delivered
          const processingHours = getRandomInt(MIN_PROCESSING_HOURS, MAX_PROCESSING_HOURS);
          processingEndDate = new Date(processingStartDate.getTime() + processingHours * 60 * 60 * 1000);
        }
      } else {
        // Completed order
        status = 'complete';
        pickupDate = new Date(orderDate.getTime() + getRandomInt(2, 6) * 60 * 60 * 1000); // 2-6 hours after order
        processingStartDate = new Date(pickupDate.getTime() + getRandomInt(1, 3) * 60 * 60 * 1000);
        const processingHours = getRandomInt(MIN_PROCESSING_HOURS, MAX_PROCESSING_HOURS);
        processingEndDate = new Date(processingStartDate.getTime() + processingHours * 60 * 60 * 1000);
        deliveryDate = new Date(processingEndDate.getTime() + getRandomInt(1, 3) * 60 * 60 * 1000);
      }
      
      const order = new Order({
        orderId: `ORD${Date.now()}${getRandomInt(1000, 9999)}`,
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        status,
        pickupDate: pickupDate,
        pickupTime: getRandomElement(['morning', 'afternoon', 'evening']),
        estimatedWeight: totalWeight,
        actualWeight: (status !== 'pending' && status !== 'scheduled') ? totalWeight : undefined,
        numberOfBags: numBags,
        baseRate: wdfRate,
        feeBreakdown: {
          numberOfBags: numBags,
          minimumFee: affiliate.minimumDeliveryFee,
          perBagFee: affiliate.perBagDeliveryFee,
          totalFee: deliveryFee,
          minimumApplied: deliveryFee === affiliate.minimumDeliveryFee
        },
        estimatedTotal: orderTotal,
        actualTotal: (status === 'complete') ? orderTotal : undefined,
        affiliateCommission,
        paymentStatus: (status === 'complete') ? 'completed' : 'pending',
        paymentMethod: 'card',
        paymentDate: (status === 'complete') ? deliveryDate : undefined,
        processingStarted: processingStartDate,
        processingCompleted: processingEndDate,
        scheduledAt: pickupDate, // Add scheduledAt
        completedAt: deliveryDate, // Add completedAt for completed orders
        specialPickupInstructions: faker.lorem.words(3),
        washInstructions: faker.lorem.words(2),
        createdAt: orderDate
      });
      
      await order.save();
      totalOrders++;
    }
    
    process.stdout.write(`\r✓ Created ${totalOrders} orders`);
  }
  
  console.log(`\n✓ All orders created (${totalOrders} total)`);
  
  // Print summary statistics
  const inProcessOrders = await Order.countDocuments({ 
    status: { $in: ['scheduled', 'pickedUp', 'processing'] } 
  });
  const completedOrders = await Order.countDocuments({ status: 'complete' });
  
  console.log('\n📊 Order Statistics:');
  console.log(`   - In-process orders: ${inProcessOrders}`);
  console.log(`   - Completed orders: ${completedOrders}`);
  console.log(`   - Total orders: ${totalOrders}`);
}

// Main function
async function main() {
  try {
    console.log('🚀 WaveMAX Sample Data Generator');
    console.log('================================\n');
    
    // Connect to database
    await connectDB();
    
    // Initialize system config
    await initializeSystemConfig();
    
    // Clean existing test data
    const args = process.argv.slice(2);
    if (args.includes('--clean')) {
      await cleanData();
    }
    
    // Generate data
    const affiliates = await generateAffiliates();
    const customers = await generateCustomers(affiliates);
    await generateOrders(customers);
    
    // Print sample login credentials
    console.log('\n🔐 Sample Login Credentials:');
    console.log('   All passwords: TestPass123!\n');
    
    const sampleAffiliate = affiliates[0];
    console.log('   Sample Affiliate:');
    console.log(`   - Username: ${sampleAffiliate.username}`);
    console.log(`   - Email: ${sampleAffiliate.email}\n`);
    
    const sampleCustomer = await Customer.findOne({ affiliateId: sampleAffiliate._id });
    if (sampleCustomer) {
      console.log('   Sample Customer:');
      console.log(`   - Username: ${sampleCustomer.username}`);
      console.log(`   - Email: ${sampleCustomer.email}`);
    }
    
    console.log('\n✅ Sample data generation complete!');
    
  } catch (error) {
    console.error('\n❌ Error generating sample data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = main;
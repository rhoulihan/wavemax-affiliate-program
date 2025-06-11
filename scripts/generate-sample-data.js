#!/usr/bin/env node

/**
 * Sample Data Generation Script
 * Creates 10 affiliates, each with 10 customers, and orders for each customer
 * All passwords: R8der50!2025
 * 
 * New Features:
 * - Orders spread over 90 days
 * - 95% of orders complete within 24 hours
 * - Orders spread across all customers
 * - Today has exactly 25 orders
 * - In-progress orders have a mix of states
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Models
const Affiliate = require('../server/models/Affiliate');
const Customer = require('../server/models/Customer');
const Order = require('../server/models/Order');
const SystemConfig = require('../server/models/SystemConfig');
const encryptionUtil = require('../server/utils/encryption');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Generate unique affiliate names and data
const affiliateData = [
    { firstName: 'John', lastName: 'Anderson', email: 'john.anderson@example.com', company: 'Anderson Enterprises' },
    { firstName: 'Sarah', lastName: 'Martinez', email: 'sarah.martinez@example.com', company: 'Martinez Solutions' },
    { firstName: 'Michael', lastName: 'Thompson', email: 'michael.thompson@example.com', company: 'Thompson Services' },
    { firstName: 'Emily', lastName: 'Rodriguez', email: 'emily.rodriguez@example.com', company: 'Rodriguez Group' },
    { firstName: 'David', lastName: 'Wilson', email: 'david.wilson@example.com', company: 'Wilson Industries' },
    { firstName: 'Jessica', lastName: 'Garcia', email: 'jessica.garcia@example.com', company: 'Garcia Corp' },
    { firstName: 'Robert', lastName: 'Brown', email: 'robert.brown@example.com', company: 'Brown Holdings' },
    { firstName: 'Lisa', lastName: 'Davis', email: 'lisa.davis@example.com', company: 'Davis Ventures' },
    { firstName: 'William', lastName: 'Miller', email: 'william.miller@example.com', company: 'Miller Associates' },
    { firstName: 'Amanda', lastName: 'Johnson', email: 'amanda.johnson@example.com', company: 'Johnson LLC' }
];

// Generate customer names (10 per affiliate)
const customerFirstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'];
const customerLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

// Generate unique email
const generateUniqueEmail = (firstName, lastName, index) => {
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;
};

// Generate order date spread over 90 days
const generateOrderDate = (daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    return date;
};

// Determine order status based on age and completion rate
const determineOrderStatus = (orderDate, isToday) => {
    const now = new Date();
    const hoursOld = (now - orderDate) / (1000 * 60 * 60);
    
    // For today's orders, ensure mix of in-progress states
    if (isToday) {
        const rand = Math.random();
        if (rand < 0.2) return 'pending';
        if (rand < 0.4) return 'scheduled';
        if (rand < 0.6) return 'processing';
        if (rand < 0.8) return 'processed';
        return 'complete';
    }
    
    // For older orders
    if (hoursOld < 24) {
        // Recent orders - mix of states
        const rand = Math.random();
        if (rand < 0.05) return 'pending';
        if (rand < 0.15) return 'scheduled';
        if (rand < 0.30) return 'processing';
        if (rand < 0.50) return 'processed';
        return 'complete';
    } else {
        // Orders older than 24 hours - 95% complete
        const rand = Math.random();
        if (rand < 0.95) return 'complete';
        if (rand < 0.97) return 'processing'; // 2% still processing (delays)
        if (rand < 0.99) return 'processed';  // 2% processed but not delivered
        return 'cancelled';  // 1% cancelled
    }
};

// Generate sample data
const generateSampleData = async () => {
    try {
        // Clean existing data if requested
        if (process.argv.includes('--clean')) {
            console.log('Cleaning existing data...');
            await Affiliate.deleteMany({});
            await Customer.deleteMany({});
            await Order.deleteMany({});
            console.log('Existing data cleaned');
        }

        const { salt: passwordSalt, hash: passwordHash } = encryptionUtil.hashPassword('R8der50!2025');
        
        // Initialize SystemConfig
        await SystemConfig.initializeDefaults();
        console.log('System configuration initialized');

        let totalAffiliates = 0;
        let totalCustomers = 0;
        let totalOrders = 0;
        let todayOrders = 0;
        
        const allCustomers = [];
        const allAffiliates = [];

        // Create affiliates
        for (let i = 0; i < affiliateData.length; i++) {
            const affiliateInfo = affiliateData[i];
            
            // Create affiliate
            const affiliate = new Affiliate({
                firstName: affiliateInfo.firstName,
                lastName: affiliateInfo.lastName,
                email: affiliateInfo.email,
                username: affiliateInfo.email.split('@')[0],
                passwordSalt: passwordSalt,
                passwordHash: passwordHash,
                phone: `555-${String(1000 + i).padStart(4, '0')}`,
                businessName: affiliateInfo.company,
                taxId: `XX-${String(1000000 + i).padStart(7, '0')}`,
                address: `${100 + i} Main Street`,
                city: 'Sample City',
                state: 'CA',
                zipCode: `90${String(200 + i).padStart(3, '0')}`,
                serviceLatitude: 34.0522 + (Math.random() * 0.1 - 0.05), // Los Angeles area
                serviceLongitude: -118.2437 + (Math.random() * 0.1 - 0.05),
                serviceRadius: 5,
                minimumDeliveryFee: 25,
                perBagDeliveryFee: 5,
                referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
                isActive: true,
                agreedToTerms: true,
                preferredLanguage: 'en',
                registrationMethod: 'traditional',
                paymentMethod: 'directDeposit',
                accountNumber: encryptionUtil.encrypt('123456789'),
                routingNumber: encryptionUtil.encrypt('987654321')
            });

            await affiliate.save();
            totalAffiliates++;
            allAffiliates.push(affiliate);
            console.log(`Created affiliate: ${affiliate.firstName} ${affiliate.lastName} (${affiliate.affiliateId})`);

            // Create customers for this affiliate
            for (let j = 0; j < 10; j++) {
                const customerFirstName = customerFirstNames[j];
                const customerLastName = customerLastNames[j];
                const customerEmail = generateUniqueEmail(customerFirstName, customerLastName, i * 10 + j);

                const customer = new Customer({
                    firstName: customerFirstName,
                    lastName: customerLastName,
                    email: customerEmail,
                    username: customerEmail.split('@')[0],
                    passwordSalt: passwordSalt,
                    passwordHash: passwordHash,
                    phone: `555-${String(2000 + i * 10 + j).padStart(4, '0')}`,
                    address: `${200 + j} Oak Avenue`,
                    city: 'Sample City',
                    state: 'CA',
                    zipCode: `90${String(300 + i).padStart(3, '0')}`,
                    affiliateId: affiliate.affiliateId,
                    referredBy: affiliate.referralCode,
                    isActive: true,
                    preferredLanguage: 'en',
                    registrationMethod: 'traditional'
                });

                await customer.save();
                totalCustomers++;
                allCustomers.push({ customer, affiliate });
                
                console.log(`  - Created customer: ${customer.firstName} ${customer.lastName}`);
            }
        }

        // Create orders spread over 90 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // First, create exactly 25 orders for today
        console.log('\nCreating orders for today...');
        for (let i = 0; i < 25; i++) {
            const customerData = allCustomers[Math.floor(Math.random() * allCustomers.length)];
            const customer = customerData.customer;
            const affiliate = customerData.affiliate;
            
            const numBags = Math.floor(Math.random() * 2) + 2; // 2-3 bags
            const orderDate = generateOrderDate(0); // Today
            const status = determineOrderStatus(orderDate, true);
            
            const order = await createOrder(customer, affiliate, orderDate, status, numBags);
            totalOrders++;
            todayOrders++;
        }
        
        // Then create orders for the previous 89 days
        console.log('\nCreating historical orders...');
        const ordersPerDay = 15; // Average orders per day for historical data
        
        for (let daysAgo = 1; daysAgo < 90; daysAgo++) {
            const numOrdersToday = Math.floor(Math.random() * 10) + 10; // 10-20 orders per day
            
            for (let i = 0; i < numOrdersToday; i++) {
                const customerData = allCustomers[Math.floor(Math.random() * allCustomers.length)];
                const customer = customerData.customer;
                const affiliate = customerData.affiliate;
                
                const numBags = Math.floor(Math.random() * 2) + 2; // 2-3 bags
                const orderDate = generateOrderDate(daysAgo);
                const status = determineOrderStatus(orderDate, false);
                
                const order = await createOrder(customer, affiliate, orderDate, status, numBags);
                totalOrders++;
            }
        }

        // Display summary
        console.log('\n=== Sample Data Generation Complete ===');
        console.log(`Total Affiliates: ${totalAffiliates}`);
        console.log(`Total Customers: ${totalCustomers}`);
        console.log(`Total Orders: ${totalOrders}`);
        console.log(`Orders Today: ${todayOrders}`);
        
        // Get status distribution
        const statusCounts = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('\nOrder Status Distribution:');
        statusCounts.forEach(s => {
            console.log(`  ${s._id}: ${s.count}`);
        });
        
        // Get in-progress orders (not complete or cancelled)
        const inProgressCount = await Order.countDocuments({
            status: { $in: ['pending', 'scheduled', 'processing', 'processed'] }
        });
        console.log(`\nIn-Progress Orders: ${inProgressCount}`);
        
        // Get delayed orders (processing > 24 hours)
        const delayedCount = await Order.countDocuments({
            status: 'processing',
            processingStartedAt: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        console.log(`Delayed Orders (>24h): ${delayedCount}`);
        
        console.log('\nAll passwords: R8der50!2025');
        console.log('\nSample logins:');
        console.log('Affiliate: john.anderson@example.com / R8der50!2025');
        console.log('Customer: james.smith0@example.com / R8der50!2025');

    } catch (error) {
        console.error('Error generating sample data:', error);
        throw error;
    }
};

// Helper function to create an order
async function createOrder(customer, affiliate, orderDate, status, numBags) {
    const baseRate = 1.89; // Per pound
    const estimatedWeight = numBags * 30; // 30 pounds per bag
    const actualWeight = ['pending', 'scheduled'].includes(status) ? undefined : estimatedWeight + (Math.random() * 10 - 5);
    
    const pickupDate = new Date(orderDate);
    if (status === 'pending' || status === 'scheduled') {
        // Future pickup for pending/scheduled orders
        pickupDate.setDate(pickupDate.getDate() + Math.floor(Math.random() * 7) + 1);
    }
    
    const deliveryDate = new Date(pickupDate);
    deliveryDate.setDate(deliveryDate.getDate() + 2);
    
    const order = new Order({
        customerId: customer.customerId,
        affiliateId: affiliate.affiliateId,
        pickupDate: pickupDate,
        pickupTime: ['morning', 'afternoon', 'evening'][Math.floor(Math.random() * 3)],
        deliveryDate: deliveryDate,
        deliveryTime: ['morning', 'afternoon', 'evening'][Math.floor(Math.random() * 3)],
        estimatedWeight: estimatedWeight,
        actualWeight: actualWeight,
        numberOfBags: numBags,
        baseRate: baseRate,
        deliveryFee: Math.max(affiliate.minimumDeliveryFee, numBags * affiliate.perBagDeliveryFee),
        minimumDeliveryFee: affiliate.minimumDeliveryFee,
        perBagDeliveryFee: affiliate.perBagDeliveryFee,
        status: status,
        washInstructions: `Standard wash for ${customer.firstName}`,
        specialPickupInstructions: `Ring doorbell`,
        specialDeliveryInstructions: `Leave at door if no answer`,
        createdAt: orderDate,
        updatedAt: orderDate
    });
    
    // Set status timestamps based on status
    if (status !== 'pending') {
        order.scheduledAt = new Date(orderDate.getTime() + 30 * 60 * 1000); // 30 mins after creation
    }
    
    if (['processing', 'processed', 'complete'].includes(status)) {
        order.processingStartedAt = new Date(orderDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after creation
    }
    
    if (['processed', 'complete'].includes(status)) {
        const processingDuration = status === 'complete' && Math.random() < 0.95 
            ? Math.random() * 20 * 60 * 60 * 1000 // 95% within 20 hours
            : (24 + Math.random() * 48) * 60 * 60 * 1000; // 5% take 24-72 hours
        order.processedAt = new Date(order.processingStartedAt.getTime() + processingDuration);
    }
    
    if (status === 'complete') {
        order.completedAt = new Date(order.processedAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours after processed
        order.paymentStatus = 'completed';
        order.paidAt = order.completedAt;
        
        // Calculate totals for completed orders
        if (actualWeight) {
            const deliveryFee = order.deliveryFee || 0;
            order.actualTotal = parseFloat(((actualWeight * baseRate) + deliveryFee).toFixed(2));
        }
    }
    
    if (status === 'cancelled') {
        order.cancelledAt = new Date(orderDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours after creation
        order.cancellationReason = 'Customer request';
    }
    
    await order.save();
    return order;
}

// Main execution
const main = async () => {
    try {
        await connectDB();
        
        // Confirm before proceeding
        console.log('This script will create sample data in the database.');
        if (process.argv.includes('--clean')) {
            console.log('WARNING: --clean flag detected. This will DELETE existing affiliates, customers, and orders!');
        }
        console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...\n');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await generateSampleData();
        
        console.log('\nDisconnecting from database...');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Script failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

// Run the script
main();
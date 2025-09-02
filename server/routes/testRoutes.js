// Test routes for development and testing
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { generateQRCode } = require('../utils/qrCodeGenerator');
const encryptionUtil = require('../utils/encryption');

// Middleware to ensure test routes are only available in development
const testOnlyMiddleware = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ROUTES) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
};

router.use(testOnlyMiddleware);

// Get or create test customer
router.get('/customer', async (req, res) => {
    try {
        let customer = await Customer.findOne({ email: 'spam-me@wavemax.promo' });
        
        if (!customer) {
            return res.status(404).json({ error: 'Test customer not found' });
        }
        
        res.json(customer);
    } catch (error) {
        console.error('Error fetching test customer:', error);
        res.status(500).json({ error: 'Failed to fetch test customer' });
    }
});

// Create test customer
router.post('/customer', async (req, res) => {
    try {
        const testEmail = req.body.email || 'spam-me@wavemax.promo';
        
        // Check if test customer already exists
        let customer = await Customer.findOne({ email: testEmail });
        
        if (customer) {
            return res.json(customer);
        }

        // Generate QR code for the customer
        const qrCode = await generateQRCode('customer');

        // First, find or create a test affiliate with same email
        let testAffiliate = await require('../models/Affiliate').findOne({ email: testEmail });
        if (!testAffiliate) {
            const Affiliate = require('../models/Affiliate');
            
            // Hash password for affiliate
            const { salt: affSalt, hash: affHash } = encryptionUtil.hashPassword('TestPassword123!');
            
            testAffiliate = new Affiliate({
                firstName: 'Test',
                lastName: 'Affiliate',
                email: testEmail,  // Use same email as customer
                username: 'testaffiliate_' + Date.now(),  // Unique username
                phone: '512-555-0200',
                businessName: 'Test Business',
                address: '456 Test Ave',
                city: 'Austin',
                state: 'TX',
                zipCode: '78702',
                isActive: true,
                serviceRadius: 5,
                minimumDeliveryFee: 1,  // Set to $1 for testing
                perBagDeliveryFee: 1,   // Set to $1 for testing
                serviceLatitude: 30.2672,
                serviceLongitude: -97.7431,
                registrationMethod: 'traditional',
                paymentMethod: 'check',
                passwordSalt: affSalt,
                passwordHash: affHash
            });
            
            await testAffiliate.save();
        }

        // Hash password for customer
        const { salt, hash } = encryptionUtil.hashPassword('TestPassword123!');
        
        // Create new test customer
        customer = new Customer({
            firstName: req.body.firstName || 'Test',
            lastName: req.body.lastName || 'Customer',
            email: testEmail,
            username: 'testcustomer_' + Date.now(),  // Unique username
            phone: req.body.phone || '512-555-0100',
            address: req.body.address?.street || '123 Test Street',
            city: req.body.address?.city || 'Austin',
            state: req.body.address?.state || 'TX',
            zipCode: req.body.address?.zipCode || '78701',
            isActive: true,
            affiliateId: testAffiliate.affiliateId || testAffiliate._id,
            registrationMethod: 'traditional',
            passwordSalt: salt,
            passwordHash: hash
        });

        await customer.save();
        res.json(customer);
    } catch (error) {
        console.error('Error creating test customer:', error);
        res.status(500).json({ error: 'Failed to create test customer' });
    }
});

// Create test order
router.post('/order', async (req, res) => {
    try {
        let { customerId, recreate, numberOfBags = 1, orderType = 'v2', isV2Order = true } = req.body;

        // Find customer
        let customer;
        if (customerId) {
            try {
                customer = await Customer.findById(customerId);
            } catch (e) {
                // Invalid ID format, ignore
            }
        }
        
        if (!customer) {
            // Try to find test customer by email (try both old and new test emails)
            customer = await Customer.findOne({ email: 'spam-me@wavemax.promo' }) || 
                      await Customer.findOne({ email: 'test.customer@wavemax.test' });
            if (!customer) {
                return res.status(400).json({ error: 'Test customer not found' });
            }
            customerId = customer._id;
        }

        // Delete existing test orders if recreate is true
        if (recreate) {
            await Order.deleteMany({ 
                customerId: customer.customerId,
                orderId: { $regex: /^TEST-/ }
            });
        }

        // Get affiliate for fee calculation
        const Affiliate = require('../models/Affiliate');
        // affiliateId is a string in UUID format, not ObjectId
        const affiliate = customer.affiliateId ? await Affiliate.findOne({ 
            affiliateId: customer.affiliateId
        }) : null;
        
        // Calculate delivery fee
        const minimumFee = affiliate?.minimumDeliveryFee || 1;
        const perBagFee = affiliate?.perBagDeliveryFee || 1;
        const calculatedFee = numberOfBags * perBagFee;
        const totalFee = Math.max(minimumFee, calculatedFee);
        
        // Create new test order with delivery fee and fabric softener add-on
        const orderData = {
            orderId: `TEST-${Date.now()}`,
            customerId: customer.customerId,
            affiliateId: customer.affiliateId,
            pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            pickupTime: 'morning',
            estimatedWeight: numberOfBags * 10, // Estimate 10 lbs per bag
            status: 'pending',
            specialPickupInstructions: 'Test order for operator scanning',
            numberOfBags: numberOfBags,
            baseRate: 1.25, // V2 rate per pound
            paymentMethod: 'card',
            // Add delivery fee breakdown
            feeBreakdown: {
                numberOfBags: numberOfBags,
                minimumFee: minimumFee,
                perBagFee: perBagFee,
                totalFee: totalFee,
                minimumApplied: totalFee === minimumFee
            },
            // Add fabric softener add-on for testing
            addOns: {
                premiumDetergent: false,
                fabricSoftener: true,  // Enable fabric softener for testing
                stainRemover: false
            }
        };

        // Set V2-specific fields
        if (isV2Order) {
            orderData.isV2Order = true;
            orderData.orderType = 'v2';
            orderData.v2PaymentStatus = 'pending';
            orderData.paymentStatus = 'pending';
            // V2 orders don't have upfront payment, amount calculated after weighing
            orderData.estimatedTotal = 0;
        } else {
            // Regular WDF order
            orderData.baseRate = 2.99;
            orderData.estimatedTotal = orderData.estimatedWeight * 2.99;
            orderData.paymentStatus = 'pending';
        }

        const order = new Order(orderData);
        await order.save();
        
        res.json(order);
    } catch (error) {
        console.error('Error creating test order:', error);
        res.status(500).json({ error: 'Failed to create test order: ' + error.message });
    }
});

// Delete all test data
router.delete('/cleanup', async (req, res) => {
    try {
        const Affiliate = require('../models/Affiliate');
        
        // Delete test orders (using orderId pattern)
        await Order.deleteMany({ orderId: { $regex: /^TEST-/ } });
        
        // Find and delete test customers and affiliates with any test email
        const testEmails = ['spam-me@wavemax.promo', 'test.customer@wavemax.test', 'test.affiliate@wavemax.test'];
        const customers = await Customer.find({ email: { $in: testEmails } });
        
        // Delete orders for these customers
        for (const customer of customers) {
            await Order.deleteMany({ customerId: customer.customerId });
        }
        
        // Delete test customers
        await Customer.deleteMany({ email: { $in: testEmails } });
        
        // Delete test affiliates (including any with old test emails)
        await Affiliate.deleteMany({ email: { $in: testEmails } });
        
        res.json({ message: 'Test data cleaned up successfully' });
    } catch (error) {
        console.error('Error cleaning up test data:', error);
        res.status(500).json({ error: 'Failed to cleanup test data' });
    }
});

module.exports = router;
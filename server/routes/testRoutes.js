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
        let customer = await Customer.findOne({ email: 'test.customer@wavemax.test' });
        
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
        // Check if test customer already exists
        let customer = await Customer.findOne({ email: 'test.customer@wavemax.test' });
        
        if (customer) {
            return res.json(customer);
        }

        // Generate QR code for the customer
        const qrCode = await generateQRCode('customer');

        // First, find or create a test affiliate
        let testAffiliate = await require('../models/Affiliate').findOne({ email: 'test.affiliate@wavemax.test' });
        if (!testAffiliate) {
            const Affiliate = require('../models/Affiliate');
            testAffiliate = new Affiliate({
                firstName: 'Test',
                lastName: 'Affiliate',
                email: 'test.affiliate@wavemax.test',
                username: 'testaffiliate',
                phone: '512-555-0200',
                businessName: 'Test Business',
                address: '456 Test Ave',
                city: 'Austin',
                state: 'TX',
                zipCode: '78702',
                isActive: true,
                serviceRadius: 5,
                minimumDeliveryFee: 25,
                perBagDeliveryFee: 5,
                serviceLatitude: 30.2672,
                serviceLongitude: -97.7431,
                registrationMethod: 'traditional', // Explicitly set to traditional to work with password
                paymentMethod: 'directDeposit',
                accountNumber: '123456789',
                routingNumber: '987654321',
                password: 'TestPassword123!' // This will be hashed by the pre-save middleware
            });
            
            await testAffiliate.save();
        }

        // Hash password for customer
        const { salt, hash } = encryptionUtil.hashPassword('TestPassword123!');
        
        // Create new test customer
        customer = new Customer({
            firstName: req.body.firstName || 'Test',
            lastName: req.body.lastName || 'Customer',
            email: 'test.customer@wavemax.test',
            username: 'testcustomer',
            phone: req.body.phone || '512-555-0100',
            address: '123 Test Street',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
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
        let { customerId, recreate } = req.body;

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
            // Try to find test customer by email
            customer = await Customer.findOne({ email: 'test.customer@wavemax.test' });
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

        // Create new test order
        const order = new Order({
            orderId: `TEST-${Date.now()}`,
            customerId: customer.customerId,
            affiliateId: customer.affiliateId,
            pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            pickupTime: 'morning',
            estimatedWeight: 20,
            status: 'pending',
            specialPickupInstructions: 'Test order for operator scanning',
            numberOfBags: 2,
            baseRate: 2.99, // Default WDF rate per pound
            estimatedTotal: 59.80, // 20 lbs * $2.99
            paymentStatus: 'pending',
            paymentMethod: 'card'
        });

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
        // Delete test orders
        await Order.deleteMany({ orderNumber: { $regex: /^TEST-/ } });
        
        // Delete test customer
        await Customer.deleteMany({ email: 'test.customer@wavemax.test' });
        
        res.json({ message: 'Test data cleaned up successfully' });
    } catch (error) {
        console.error('Error cleaning up test data:', error);
        res.status(500).json({ error: 'Failed to cleanup test data' });
    }
});

module.exports = router;
// Test routes for development and testing
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { generateQRCode } = require('../utils/qrCodeGenerator');
const encryptionUtil = require('../utils/encryption');
const logger = require('../utils/logger');

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
        let customer = await Customer.findOne({ email: 'spam-me@rundberglaundry.com' });
        
        if (!customer) {
            return res.status(404).json({ error: 'Test customer not found' });
        }
        
        res.json(customer);
    } catch (error) {
        logger.error('Error fetching test customer:', error);
        res.status(500).json({ error: 'Failed to fetch test customer' });
    }
});

// Create test customer
router.post('/customer', async (req, res) => {
    try {
        const testEmail = req.body.email || 'spam-me@rundberglaundry.com';
        
        // Check if test customer already exists
        let customer = await Customer.findOne({ email: testEmail });

        if (customer) {
            // PR 7: customers are registration-only (no username/password).
            await customer.save();
            return res.json(customer);
        }

        // Generate QR code for the customer
        const qrCode = await generateQRCode('customer');

        // First, find or create a test affiliate with same email
        let testAffiliate = await require('../models/Affiliate').findOne({ email: testEmail });
        if (!testAffiliate) {
            const Affiliate = require('../models/Affiliate');

            // Check if username 'testuser' is already taken by another affiliate
            const existingAffiliate = await Affiliate.findOne({ username: 'testuser', email: { $ne: testEmail } });
            if (existingAffiliate) {
                // Update the existing affiliate if it's not our test email
                await Affiliate.deleteOne({ username: 'testuser', email: { $ne: testEmail } });
            }

            // Hash password for affiliate
            const { salt: affSalt, hash: affHash } = encryptionUtil.hashPassword('TestPass!');

            testAffiliate = new Affiliate({
                firstName: 'Test',
                lastName: 'Affiliate',
                email: testEmail,  // Use same email as customer
                username: 'testuser',  // Fixed username for testing
                phone: '512-555-0200',
                businessName: 'Test Business',
                address: '456 Test Ave',
                city: 'Austin',
                state: 'TX',
                zipCode: '78702',
                isActive: true,
                minimumDeliveryFee: 1,  // Set to $1 for testing
                perBagDeliveryFee: 1,   // Set to $1 for testing
                paymentMethod: 'check',
                passwordSalt: affSalt,
                passwordHash: affHash
            });
            
            await testAffiliate.save();
        } else {
            // Update existing affiliate's password to TestPass!
            const { salt: affSalt, hash: affHash } = encryptionUtil.hashPassword('TestPass!');
            testAffiliate.passwordSalt = affSalt;
            testAffiliate.passwordHash = affHash;
            testAffiliate.username = 'testuser';  // Ensure username is set
            await testAffiliate.save();
        }

        // Create new test customer (PR 7: registration-only, no credentials)
        customer = new Customer({
            firstName: req.body.firstName || 'Test',
            lastName: req.body.lastName || 'Customer',
            email: testEmail,
            phone: req.body.phone || '512-555-0100',
            address: req.body.address?.street || '123 Test Street',
            city: req.body.address?.city || 'Austin',
            state: req.body.address?.state || 'TX',
            zipCode: req.body.address?.zipCode || '78701',
            isActive: true,
            affiliateId: testAffiliate.affiliateId || testAffiliate._id
        });

        await customer.save();
        res.json(customer);
    } catch (error) {
        logger.error('Error creating test customer:', error);
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
            // Try to find test customer by email (try both old and new test emails)
            customer = await Customer.findOne({ email: 'spam-me@rundberglaundry.com' }) || 
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
                isTestOrder: true
            });
        }

        // Create new test order in the slimmed state-record shape.
        // Money/weight/commission moved to Cents (external) in Phase 1.
        const orderData = {
            // orderId will be auto-generated as ORD-[UUID]
            customerId: customer.customerId,
            affiliateId: customer.affiliateId,
            bagId: `BAG-${require('uuid').v4()}`,
            bagToken: require('crypto').randomBytes(16).toString('hex'),
            isTestOrder: true // Mark as test order for cleanup
        };

        const order = new Order(orderData);
        await order.save();
        
        res.json(order);
    } catch (error) {
        logger.error('Error creating test order:', error);
        res.status(500).json({ error: 'Failed to create test order: ' + error.message });
    }
});

// Get test order details
router.get('/order/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            $or: [
                { _id: req.params.orderId },
                { orderId: req.params.orderId }
            ]
        });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        logger.error('Error fetching test order:', error);
        res.status(500).json({ error: 'Failed to fetch test order' });
    }
});

// Advance order stage for testing
router.post('/order/advance-stage', async (req, res) => {
    try {
        const { orderId, currentStage, nextStage, action } = req.body;

        // Find the order
        const order = await Order.findOne({
            $or: [
                { _id: orderId },
                { orderId: orderId }
            ]
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        logger.info(`Advancing order ${orderId} from ${currentStage} to ${nextStage}`);

        // Walk the slimmed status machine:
        // pending -> in_progress -> out_for_delivery -> complete.
        // Money/weight/commission live externally in Cents (Phase 1).
        switch (action) {
            case 'weigh':
                order.status = 'in_progress';
                order.intake = { at: new Date(), by: null, role: 'operator' };
                break;

            case 'process':
                order.status = 'out_for_delivery';
                order.storePickup = { at: new Date(), by: null, role: 'affiliate' };
                break;

            case 'pickup':
                order.status = 'complete';
                order.delivery = { at: new Date(), by: null, role: 'affiliate' };
                order.completedAt = new Date();
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        // Save the updated order
        await order.save();

        logger.info(`Order ${orderId} successfully advanced to ${order.status}`);

        res.json(order);
    } catch (error) {
        logger.error('Error advancing order stage:', error);
        res.status(500).json({ error: 'Failed to advance order stage: ' + error.message });
    }
});

// Delete all test data
router.delete('/cleanup', async (req, res) => {
    try {
        const Affiliate = require('../models/Affiliate');
        
        // Delete test orders (using orderId pattern)
        await Order.deleteMany({ isTestOrder: true });
        
        // Find and delete test customers and affiliates with any test email
        const testEmails = ['spam-me@rundberglaundry.com', 'test.customer@wavemax.test', 'test.affiliate@wavemax.test'];
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
        logger.error('Error cleaning up test data:', error);
        res.status(500).json({ error: 'Failed to cleanup test data' });
    }
});

module.exports = router;
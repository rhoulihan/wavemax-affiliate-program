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
            // Update existing customer's password and username to ensure consistency
            const { salt, hash } = encryptionUtil.hashPassword('TestPass!');
            customer.passwordSalt = salt;
            customer.passwordHash = hash;
            customer.username = 'testuser';  // Ensure username is set
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
        } else {
            // Update existing affiliate's password to TestPass!
            const { salt: affSalt, hash: affHash } = encryptionUtil.hashPassword('TestPass!');
            testAffiliate.passwordSalt = affSalt;
            testAffiliate.passwordHash = affHash;
            testAffiliate.username = 'testuser';  // Ensure username is set
            await testAffiliate.save();
        }

        // Check if username 'testuser' is already taken by another customer
        const existingCustomer = await Customer.findOne({ username: 'testuser', email: { $ne: testEmail } });
        if (existingCustomer) {
            // Delete the existing customer if it's not our test email
            await Customer.deleteOne({ username: 'testuser', email: { $ne: testEmail } });
        }

        // Hash password for customer
        const { salt, hash } = encryptionUtil.hashPassword('TestPass!');

        // Create new test customer
        customer = new Customer({
            firstName: req.body.firstName || 'Test',
            lastName: req.body.lastName || 'Customer',
            email: testEmail,
            username: 'testuser',  // Fixed username for testing
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
                isTestOrder: true
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
            // orderId will be auto-generated as ORD-[UUID]
            customerId: customer.customerId,
            affiliateId: customer.affiliateId,
            pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            pickupTime: 'morning',
            estimatedWeight: numberOfBags * 10, // Estimate 10 lbs per bag
            status: 'pending',
            specialPickupInstructions: 'Test order for operator scanning',
            isTestOrder: true, // Mark as test order for cleanup
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
        console.error('Error fetching test order:', error);
        res.status(500).json({ error: 'Failed to fetch test order' });
    }
});

// Send test payment email
router.post('/send-payment-email', async (req, res) => {
    try {
        const { to, subject, html, orderId } = req.body;
        
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
        }
        
        // Import email service
        const emailService = require('../utils/emailService');
        
        // Send the email
        await emailService.sendEmail(to, subject, html);
        
        // Log the test email for debugging
        console.log(`Test payment email sent to ${to} for order ${orderId}`);
        
        res.json({ 
            success: true, 
            message: 'Test payment email sent successfully',
            orderId 
        });
    } catch (error) {
        console.error('Error sending test payment email:', error);
        res.status(500).json({ error: 'Failed to send test payment email: ' + error.message });
    }
});

// Advance order stage for testing
router.post('/order/advance-stage', async (req, res) => {
    try {
        const { orderId, currentStage, nextStage, action, weights, actualWeight, processedBags, pickedUpBags } = req.body;

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

        console.log(`Advancing order ${orderId} from ${currentStage} to ${nextStage}`);

        // Handle stage transitions
        switch (action) {
            case 'weigh':
                // Simulate drop-off and weighing
                if (!order.bags || order.bags.length === 0) {
                    // Initialize bags if not already present
                    order.bags = [];
                    for (let i = 0; i < order.numberOfBags; i++) {
                        order.bags.push({
                            bagNumber: i + 1,
                            bagId: `BAG-${order.orderId}-${i + 1}`,
                            weight: weights ? weights[i] : 30, // Use provided weight or default to 30 lbs
                            status: 'processing',
                            scannedAt: {
                                processing: new Date()
                            },
                            scannedBy: {}  // Initialize empty for test mode
                        });
                    }
                }

                // Set actual weight and calculate total
                order.actualWeight = actualWeight || (order.numberOfBags * 30);
                order.bagsWeighed = order.numberOfBags;

                // Calculate pricing for V2 orders
                if (order.isV2Order) {
                    const basePrice = order.actualWeight * (order.baseRate || 1.25);

                    // Add delivery fee
                    const deliveryFee = order.feeBreakdown?.totalFee || 0;

                    // Add fabric softener add-on ($2.00)
                    const fabricSoftenerFee = order.addOns?.fabricSoftener ? 2.00 : 0;

                    order.actualTotal = basePrice + deliveryFee + fabricSoftenerFee;
                    order.wdfCredit = 0; // No WDF credit initially
                }

                order.status = 'processing';
                order.receivedAt = new Date();
                break;

            case 'process':
                // Simulate marking bags as processed (washed/dried)
                if (order.bags && order.bags.length > 0) {
                    order.bags.forEach(bag => {
                        bag.status = 'processed';
                        if (!bag.scannedAt) bag.scannedAt = {};
                        bag.scannedAt.processed = new Date();
                    });
                }
                order.bagsProcessed = order.numberOfBags;
                order.status = 'processed';
                order.processedAt = new Date();
                break;

            case 'pickup':
                // Simulate customer pickup
                if (order.bags && order.bags.length > 0) {
                    order.bags.forEach(bag => {
                        bag.status = 'completed';
                        if (!bag.scannedAt) bag.scannedAt = {};
                        bag.scannedAt.completed = new Date();
                    });
                }
                order.bagsPickedUp = order.numberOfBags;
                order.status = 'complete';
                order.completedAt = new Date();

                // Mark payment as completed for testing
                if (order.isV2Order) {
                    order.v2PaymentStatus = 'verified';
                    order.v2PaymentMethod = 'test';
                } else {
                    order.paymentStatus = 'completed';
                }
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        // Save the updated order
        await order.save();

        console.log(`Order ${orderId} successfully advanced to ${order.status}`);

        res.json(order);
    } catch (error) {
        console.error('Error advancing order stage:', error);
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
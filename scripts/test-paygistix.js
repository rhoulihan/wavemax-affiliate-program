#!/usr/bin/env node

/**
 * Manual Testing Script for Paygistix Integration
 * 
 * This script allows you to test various payment scenarios
 * against the Paygistix sandbox environment.
 * 
 * Usage: node scripts/test-paygistix.js [command] [options]
 * 
 * Commands:
 *   create-intent     Create a payment intent
 *   capture          Capture a payment
 *   refund           Process a refund
 *   webhook          Simulate webhook events
 *   stress           Run stress tests
 *   full-flow        Run complete payment flow
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
const mongoose = require('mongoose');

// Models
const Payment = require('../server/models/Payment');
const Order = require('../server/models/Order');
const Customer = require('../server/models/Customer');

// Services
const paygistixService = require('../server/services/paygistixService');

// Test configuration
const TEST_CONFIG = {
    baseUrl: process.env.PAYGISTIX_API_URL || 'https://sandbox.paygistix.com/v1',
    apiKey: process.env.PAYGISTIX_API_KEY,
    apiSecret: process.env.PAYGISTIX_API_SECRET,
    merchantId: process.env.PAYGISTIX_MERCHANT_ID,
    webhookSecret: process.env.PAYGISTIX_WEBHOOK_SECRET
};

// Test data
const TEST_CARDS = {
    success: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
        description: 'Success'
    },
    decline: {
        number: '4000000000000002',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
        description: 'Decline'
    },
    insufficient_funds: {
        number: '4000000000000127',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
        description: 'Insufficient funds'
    },
    expired: {
        number: '4000000000000069',
        exp_month: 12,
        exp_year: 2020,
        cvc: '123',
        description: 'Expired card'
    }
};

// Utility functions
const log = {
    info: (msg) => console.log('ℹ', msg),
    success: (msg) => console.log('✓', msg),
    error: (msg) => console.log('✗', msg),
    warning: (msg) => console.log('⚠', msg),
    data: (label, data) => {
        console.log(`\n${label}:`);
        console.log(JSON.stringify(data, null, 2));
    }
};

const prompt = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question + ' ', (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// Database connection
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wavemax-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        log.success('Connected to database');
    } catch (error) {
        log.error('Failed to connect to database: ' + error.message);
        process.exit(1);
    }
}

// Test functions
async function createTestCustomer() {
    const customer = await Customer.create({
        name: 'Test Customer',
        email: `test.${Date.now()}@example.com`,
        password: 'Test123!@#',
        phone: '+1234567890',
        addresses: [{
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            isDefault: true
        }]
    });
    
    log.success(`Created test customer: ${customer.email}`);
    return customer;
}

async function createTestOrder(customerId) {
    const order = await Order.create({
        customerId,
        orderNumber: `TEST-${Date.now()}`,
        items: [{
            servicetype: 'wash-dry-fold',
            quantity: 10,
            pricePerUnit: 2.50,
            totalPrice: 25.00
        }],
        totalAmount: 25.00,
        serviceType: 'wash-dry-fold',
        status: 'pending',
        paymentStatus: 'pending'
    });
    
    log.success(`Created test order: ${order.orderNumber}`);
    return order;
}

// Command: Create Payment Intent
async function createPaymentIntent(options) {
    log.info('Creating payment intent...');
    
    try {
        await connectDB();
        
        // Create test data
        const customer = await createTestCustomer();
        const order = await createTestOrder(customer._id);
        
        // Create payment intent
        const paymentIntent = await paygistixService.createPaymentIntent({
            amount: Math.round(order.totalAmount * 100),
            currency: 'USD',
            customerId: customer._id.toString(),
            orderId: order._id.toString(),
            description: `Test Order ${order.orderNumber}`,
            metadata: {
                orderNumber: order.orderNumber,
                customerEmail: customer.email,
                testMode: 'true'
            }
        });
        
        log.success('Payment intent created successfully!');
        log.data('Payment Intent', paymentIntent);
        
        // Save payment record
        const payment = new Payment({
            orderId: order._id,
            customerId: customer._id,
            paygistixTransactionId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'pending',
            paymentMethod: { type: 'card' }
        });
        
        await payment.save();
        log.success('Payment record saved to database');
        
        return paymentIntent;
        
    } catch (error) {
        log.error('Failed to create payment intent: ' + error.message);
        if (error.response) {
            log.data('Error Response', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
    }
}

// Command: Capture Payment
async function capturePayment(options) {
    const paymentIntentId = options.paymentIntent || await prompt('Enter payment intent ID:');
    
    log.info(`Capturing payment ${paymentIntentId}...`);
    
    try {
        await connectDB();
        
        // Find payment record
        const payment = await Payment.findOne({ paygistixTransactionId: paymentIntentId });
        if (!payment) {
            throw new Error('Payment record not found in database');
        }
        
        // Select test card
        console.log('\nSelect test card:');
        Object.entries(TEST_CARDS).forEach(([key, card], index) => {
            console.log(`${index + 1}. ${card.description}`);
        });
        
        const cardChoice = await prompt('Enter choice (1-4):');
        const cardKey = Object.keys(TEST_CARDS)[parseInt(cardChoice) - 1];
        const testCard = TEST_CARDS[cardKey];
        
        log.info(`Using ${testCard.description} card...`);
        
        // Simulate card tokenization (in real scenario, this happens on frontend)
        const token = `tok_test_${Date.now()}`;
        
        // Capture payment
        const result = await paygistixService.capturePayment(paymentIntentId);
        
        if (result.status === 'succeeded') {
            log.success('Payment captured successfully!');
            
            // Update payment record
            payment.status = 'completed';
            payment.paymentMethod.last4 = testCard.number.slice(-4);
            payment.paymentMethod.brand = 'visa';
            await payment.save();
            
            // Update order
            await Order.findByIdAndUpdate(payment.orderId, {
                paymentStatus: 'paid',
                paidAt: new Date()
            });
            
        } else {
            log.error('Payment capture failed');
            payment.status = 'failed';
            payment.errorMessage = result.error?.message;
            await payment.save();
        }
        
        log.data('Capture Result', result);
        
    } catch (error) {
        log.error('Failed to capture payment: ' + error.message);
        if (error.response) {
            log.data('Error Response', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
    }
}

// Command: Process Refund
async function processRefund(options) {
    const transactionId = options.transaction || await prompt('Enter transaction ID:');
    const amount = options.amount || await prompt('Enter refund amount (leave empty for full refund):');
    const reason = options.reason || await prompt('Enter refund reason:');
    
    log.info('Processing refund...');
    
    try {
        await connectDB();
        
        // Find payment
        const payment = await Payment.findOne({ paygistixTransactionId: transactionId });
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        if (payment.status !== 'completed') {
            throw new Error('Can only refund completed payments');
        }
        
        const refundAmount = amount ? parseInt(amount) : payment.amount;
        
        // Process refund
        const refund = await paygistixService.refundPayment(
            transactionId,
            refundAmount,
            reason
        );
        
        log.success('Refund processed successfully!');
        log.data('Refund Result', refund);
        
        // Update payment record
        payment.refunds.push({
            refundId: refund.id,
            amount: refundAmount,
            reason: reason,
            createdAt: new Date(),
            status: refund.status
        });
        
        if (refundAmount >= payment.amount) {
            payment.status = 'refunded';
        } else {
            payment.status = 'partially_refunded';
        }
        
        await payment.save();
        
        // Update order
        await Order.findByIdAndUpdate(payment.orderId, {
            paymentStatus: payment.status
        });
        
    } catch (error) {
        log.error('Failed to process refund: ' + error.message);
        if (error.response) {
            log.data('Error Response', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
    }
}

// Command: Simulate Webhook
async function simulateWebhook(options) {
    const event = options.event || await prompt('Enter event type (payment.succeeded, payment.failed, refund.succeeded):');
    const paymentIntentId = options.paymentIntent || await prompt('Enter payment intent ID:');
    
    log.info(`Simulating ${event} webhook...`);
    
    try {
        const webhookData = {
            event,
            timestamp: new Date().toISOString(),
            data: {
                paymentIntentId,
                amount: 2500,
                currency: 'USD',
                payment_method: {
                    type: 'card',
                    last4: '4242',
                    brand: 'visa'
                }
            }
        };
        
        if (event.includes('refund')) {
            webhookData.data.refundId = `ref_test_${Date.now()}`;
            webhookData.data.refundAmount = 1000;
        }
        
        const payload = JSON.stringify(webhookData);
        const signature = crypto
            .createHmac('sha256', TEST_CONFIG.webhookSecret)
            .update(payload)
            .digest('hex');
        
        log.data('Webhook Payload', webhookData);
        log.info(`Signature: ${signature}`);
        
        // Send webhook to local server
        const serverUrl = options.url || 'http://localhost:3000/api/webhooks/paygistix';
        
        const response = await axios.post(serverUrl, webhookData, {
            headers: {
                'Content-Type': 'application/json',
                'X-Paygistix-Signature': signature
            }
        });
        
        log.success('Webhook delivered successfully!');
        log.data('Server Response', response.data);
        
    } catch (error) {
        log.error('Failed to deliver webhook: ' + error.message);
        if (error.response) {
            log.data('Error Response', error.response.data);
        }
    }
}

// Command: Stress Test
async function stressTest(options) {
    const count = parseInt(options.count) || 10;
    const concurrent = parseInt(options.concurrent) || 5;
    
    log.info(`Running stress test: ${count} payments with ${concurrent} concurrent requests...`);
    
    try {
        await connectDB();
        
        const customer = await createTestCustomer();
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };
        
        const startTime = Date.now();
        
        // Process payments in batches
        for (let i = 0; i < count; i += concurrent) {
            const batch = [];
            
            for (let j = 0; j < concurrent && i + j < count; j++) {
                batch.push(processStressTestPayment(customer._id, i + j, results));
            }
            
            await Promise.all(batch);
            
            log.info(`Progress: ${Math.min(i + concurrent, count)}/${count}`);
        }
        
        const duration = (Date.now() - startTime) / 1000;
        
        log.success('\nStress test completed!');
        console.log('\nResults:');
        console.log(`  Total payments: ${count}`);
        console.log(`  Successful: ${results.success}`);
        console.log(`  Failed: ${results.failed}`);
        console.log(`  Duration: ${duration}s`);
        console.log(`  Rate: ${(count / duration).toFixed(2)} payments/second`);
        
        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.slice(0, 5).forEach(err => {
                console.log(`  - ${err}`);
            });
            if (results.errors.length > 5) {
                console.log(`  ... and ${results.errors.length - 5} more`);
            }
        }
        
    } catch (error) {
        log.error('Stress test failed: ' + error.message);
    } finally {
        await mongoose.disconnect();
    }
}

async function processStressTestPayment(customerId, index, results) {
    try {
        // Create order
        const order = await Order.create({
            customerId,
            orderNumber: `STRESS-${Date.now()}-${index}`,
            totalAmount: 10 + (index % 90),
            serviceType: 'wash-dry-fold',
            status: 'pending',
            paymentStatus: 'pending'
        });
        
        // Create payment intent
        const paymentIntent = await paygistixService.createPaymentIntent({
            amount: Math.round(order.totalAmount * 100),
            currency: 'USD',
            customerId: customerId.toString(),
            orderId: order._id.toString(),
            description: `Stress test order ${index}`
        });
        
        // Simulate capture
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        
        results.success++;
    } catch (error) {
        results.failed++;
        results.errors.push(`Payment ${index}: ${error.message}`);
    }
}

// Command: Full Flow Test
async function fullFlowTest(options) {
    log.info('Running full payment flow test...\n');
    
    try {
        await connectDB();
        
        // Step 1: Create test data
        log.info('Step 1: Creating test data...');
        const customer = await createTestCustomer();
        const order = await createTestOrder(customer._id);
        
        // Step 2: Create payment intent
        log.info('\nStep 2: Creating payment intent...');
        const paymentIntent = await paygistixService.createPaymentIntent({
            amount: Math.round(order.totalAmount * 100),
            currency: 'USD',
            customerId: customer._id.toString(),
            orderId: order._id.toString(),
            description: `Test Order ${order.orderNumber}`
        });
        
        log.success(`Payment intent created: ${paymentIntent.id}`);
        
        // Save payment record
        const payment = new Payment({
            orderId: order._id,
            customerId: customer._id,
            paygistixTransactionId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: 'pending',
            paymentMethod: { type: 'card' }
        });
        await payment.save();
        
        // Step 3: Capture payment
        log.info('\nStep 3: Capturing payment...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate user entering card
        
        const captureResult = await paygistixService.capturePayment(paymentIntent.id);
        log.success('Payment captured successfully!');
        
        // Update records
        payment.status = 'completed';
        payment.paymentMethod.last4 = '4242';
        payment.paymentMethod.brand = 'visa';
        await payment.save();
        
        order.paymentStatus = 'paid';
        order.paidAt = new Date();
        await order.save();
        
        // Step 4: Simulate webhook
        log.info('\nStep 4: Simulating webhook confirmation...');
        const webhookData = {
            event: 'payment.succeeded',
            data: {
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                payment_method: {
                    last4: '4242',
                    brand: 'visa'
                }
            }
        };
        
        log.success('Webhook event processed');
        
        // Step 5: Process partial refund
        log.info('\nStep 5: Processing partial refund...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const refundAmount = Math.floor(payment.amount * 0.4);
        const refund = await paygistixService.refundPayment(
            paymentIntent.id,
            refundAmount,
            'Testing partial refund'
        );
        
        payment.refunds.push({
            refundId: refund.id,
            amount: refundAmount,
            reason: 'Testing partial refund',
            createdAt: new Date(),
            status: 'succeeded'
        });
        payment.status = 'partially_refunded';
        await payment.save();
        
        log.success(`Partial refund processed: $${(refundAmount / 100).toFixed(2)}`);
        
        // Final summary
        console.log('\n=== Test Summary ===');
        console.log(`Customer: ${customer.email}`);
        console.log(`Order: ${order.orderNumber}`);
        console.log(`Payment Intent: ${paymentIntent.id}`);
        console.log(`Original Amount: $${(payment.amount / 100).toFixed(2)}`);
        console.log(`Refunded: $${(refundAmount / 100).toFixed(2)}`);
        console.log(`Final Status: ${payment.status}`);
        console.log('\n✓ Full flow test completed successfully!');
        
    } catch (error) {
        log.error('Full flow test failed: ' + error.message);
        if (error.response) {
            log.data('Error Details', error.response.data);
        }
    } finally {
        await mongoose.disconnect();
    }
}

// Command line argument parsing
const args = process.argv.slice(2);
const command = args[0];
const options = {};

// Parse options
for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        options[key] = args[i + 1] || true;
        i++;
    }
}

// Main execution
if (require.main === module) {
    // Check configuration
    if (!TEST_CONFIG.apiKey || !TEST_CONFIG.apiSecret) {
        log.error('Missing Paygistix API credentials in environment variables');
        log.info('Please set PAYGISTIX_API_KEY and PAYGISTIX_API_SECRET');
        process.exit(1);
    }
    
    // Execute command
    switch (command) {
        case 'create-intent':
            createPaymentIntent(options);
            break;
        case 'capture':
            capturePayment(options);
            break;
        case 'refund':
            processRefund(options);
            break;
        case 'webhook':
            simulateWebhook(options);
            break;
        case 'stress':
            stressTest(options);
            break;
        case 'full-flow':
            fullFlowTest(options);
            break;
        default:
            console.log('Manual Testing Script for Paygistix Integration\n');
            console.log('Usage: node scripts/test-paygistix.js [command] [options]\n');
            console.log('Commands:');
            console.log('  create-intent     Create a payment intent');
            console.log('  capture          Capture a payment');
            console.log('  refund           Process a refund');
            console.log('  webhook          Simulate webhook events');
            console.log('  stress           Run stress tests');
            console.log('  full-flow        Run complete payment flow\n');
            console.log('Examples:');
            console.log('  node scripts/test-paygistix.js create-intent');
            console.log('  node scripts/test-paygistix.js capture --payment-intent pi_test_123');
            console.log('  node scripts/test-paygistix.js refund --transaction pi_test_123 --amount 1000');
            console.log('  node scripts/test-paygistix.js stress --count 50 --concurrent 10');
    }
}

module.exports = {
    createPaymentIntent,
    capturePayment,
    processRefund,
    simulateWebhook,
    stressTest,
    fullFlowTest
};
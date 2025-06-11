const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const emailService = require('../utils/emailService');
const auditLogger = require('../utils/auditLogger');
const bcrypt = require('bcryptjs');

/**
 * Handle Paygistix payment callback for both registration and orders
 * This endpoint receives the callback from Paygistix after payment processing
 */
router.get('/', async (req, res) => {
    try {
        console.log('Paygistix general callback received:', req.query);
        
        // Extract callback parameters
        const {
            status,
            transactionId,
            orderId,
            amount,
            authCode,
            responseCode,
            responseMessage,
            cardType,
            maskedCard,
            hash,
            type,
            customerData
        } = req.query;
        
        // Determine the type of payment from the query parameter
        const paymentType = type || 'order';
        
        if (paymentType === 'registration') {
            // Handle registration payment
            return handleRegistrationPayment(req, res);
        } else {
            // Handle order payment
            return handleOrderPayment(req, res);
        }
        
    } catch (error) {
        console.error('Payment callback error:', error);
        res.redirect('/payment-error?message=An error occurred processing your payment');
    }
});

/**
 * Handle registration payment callback
 */
async function handleRegistrationPayment(req, res) {
    try {
        const {
            status,
            transactionId,
            amount,
            authCode,
            responseCode,
            responseMessage,
            cardType,
            maskedCard
        } = req.query;
        
        if (status === 'approved' || status === 'success') {
            // For registration, we need to complete the customer creation
            // The customer data should be in session or passed as encoded parameter
            
            // Try to get registration data from session/cookie
            // In a real implementation, you'd retrieve this from a secure session store
            // For now, we'll redirect to success page with transaction info
            
            res.redirect(`/embed-app.html?route=/customer-success&transactionId=${transactionId}&paymentStatus=success`);
            
        } else {
            // Payment failed
            res.redirect(`/embed-app.html?route=/customer-register&error=payment_failed&message=${encodeURIComponent(responseMessage || 'Payment failed')}`);
        }
        
    } catch (error) {
        console.error('Registration payment callback error:', error);
        res.redirect('/embed-app.html?route=/customer-register&error=processing_error');
    }
}

/**
 * Handle order payment callback
 */
async function handleOrderPayment(req, res) {
    try {
        const {
            status,
            transactionId,
            orderId,
            amount,
            authCode,
            responseCode,
            responseMessage,
            cardType,
            maskedCard
        } = req.query;
        
        // Find the order
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            console.error('Order not found for callback:', orderId);
            return res.redirect(`/payment-error?message=Order not found`);
        }
        
        // Create or update payment record
        let payment = await Payment.findOne({ orderId: order._id });
        
        if (!payment) {
            payment = new Payment({
                orderId: order._id,
                customerId: order.customerId,
                paygistixTransactionId: transactionId,
                amount: parseFloat(amount) || order.estimatedTotal,
                currency: 'USD',
                status: 'pending'
            });
        }
        
        // Update payment based on status
        if (status === 'approved' || status === 'success') {
            payment.status = 'completed';
            payment.paymentMethod = {
                type: 'card',
                brand: cardType,
                last4: maskedCard ? maskedCard.slice(-4) : '',
            };
            payment.metadata = new Map([
                ['authCode', authCode],
                ['responseCode', responseCode],
                ['responseMessage', responseMessage]
            ]);
            
            // Update order payment status
            order.paymentStatus = 'paid';
            order.paidAt = new Date();
            await order.save();
            
            // Get customer for email
            const customer = await Customer.findOne({ customerId: order.customerId });
            
            // Send confirmation email
            if (customer) {
                try {
                    await emailService.sendPaymentConfirmationEmail(customer, order, payment);
                } catch (emailError) {
                    console.error('Failed to send payment confirmation email:', emailError);
                }
            }
            
            // Log success
            await auditLogger.log({
                userId: order.customerId,
                userType: 'customer',
                action: 'payment.completed',
                resourceType: 'payment',
                resourceId: payment._id,
                details: {
                    orderId: order.orderId,
                    amount: payment.amount,
                    transactionId: transactionId
                }
            });
            
            await payment.save();
            
            // Redirect to success page
            res.redirect(`/payment-success?orderId=${orderId}&transactionId=${transactionId}`);
            
        } else if (status === 'declined' || status === 'failed') {
            payment.status = 'failed';
            payment.errorMessage = responseMessage || 'Payment declined';
            payment.attempts += 1;
            
            await payment.save();
            
            // Log failure
            await auditLogger.log({
                userId: order.customerId,
                userType: 'customer',
                action: 'payment.failed',
                resourceType: 'payment',
                resourceId: payment._id,
                details: {
                    orderId: order.orderId,
                    reason: responseMessage,
                    responseCode: responseCode
                }
            });
            
            // Redirect to error page
            res.redirect(`/payment-error?orderId=${orderId}&message=${encodeURIComponent(responseMessage || 'Payment failed')}`);
            
        } else {
            // Unknown status
            console.error('Unknown payment status:', status);
            res.redirect(`/payment-error?orderId=${orderId}&message=Unknown payment status`);
        }
        
    } catch (error) {
        console.error('Order payment callback error:', error);
        res.redirect('/payment-error?message=An error occurred processing your payment');
    }
}

/**
 * Handle Paygistix payment callback (POST version)
 */
router.post('/', async (req, res) => {
    try {
        console.log('Paygistix POST callback received:', req.body);
        
        // Extract type from body
        const paymentType = req.body.type || 'order';
        
        if (paymentType === 'registration') {
            // Handle registration payment
            
            const {
                status,
                transactionId,
                amount,
                responseMessage
            } = req.body;
            
            if (status === 'approved' || status === 'success') {
                // Check for pending registration data
                const pendingRegistration = req.session?.pendingRegistration;
                
                if (pendingRegistration) {
                    try {
                        // Create the customer
                        const hashedPassword = await bcrypt.hash(pendingRegistration.password, 10);
                        
                        const customer = new Customer({
                            ...pendingRegistration,
                            password: hashedPassword,
                            paymentVerified: true,
                            paymentTransactionId: transactionId,
                            createdAt: new Date()
                        });
                        
                        await customer.save();
                        
                        // Clear pending registration
                        delete req.session.pendingRegistration;
                        
                        // Log the registration
                        await auditLogger.log({
                            userId: customer.customerId,
                            userType: 'customer',
                            action: 'customer.registered',
                            resourceType: 'customer',
                            resourceId: customer._id,
                            details: {
                                paymentTransactionId: transactionId,
                                registrationType: 'paid'
                            }
                        });
                        
                        res.status(200).json({ 
                            received: true, 
                            success: true,
                            customerId: customer.customerId 
                        });
                    } catch (error) {
                        console.error('Error creating customer after payment:', error);
                        res.status(500).json({ 
                            received: true, 
                            success: false,
                            error: 'Failed to create customer account' 
                        });
                    }
                } else {
                    res.status(400).json({ 
                        received: true, 
                        success: false,
                        error: 'No pending registration found' 
                    });
                }
            } else {
                res.status(200).json({ 
                    received: true, 
                    success: false,
                    error: responseMessage || 'Payment failed' 
                });
            }
        } else {
            // Handle order payment POST
            res.status(200).json({ received: true });
        }
        
    } catch (error) {
        console.error('Payment POST callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

module.exports = router;
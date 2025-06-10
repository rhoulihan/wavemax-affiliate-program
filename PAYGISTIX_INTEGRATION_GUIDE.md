# Paygistix Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Implementation Steps](#implementation-steps)
5. [API Integration](#api-integration)
6. [Security Best Practices](#security-best-practices)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Checklist](#deployment-checklist)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

## Overview

Paygistix is WaveMAX's payment processing solution that provides secure, reliable payment processing for laundry services. This guide covers the complete integration process from development to production deployment.

### Key Features
- PCI-compliant payment processing
- Credit/debit card payments
- ACH transfers
- Recurring payments for subscriptions
- Tokenization for saved payment methods
- Real-time webhook notifications
- Comprehensive fraud protection

### Prerequisites
- Node.js 16.0.0 or higher
- MongoDB 4.4 or higher
- SSL certificate for production
- Paygistix merchant account
- Basic understanding of payment processing concepts

## Quick Start

### 1. Install Dependencies
```bash
npm install axios crypto-js express-validator
npm install --save-dev jest supertest
```

### 2. Environment Setup
```bash
# Copy example environment file
cp .env.example .env

# Add Paygistix credentials
PAYGISTIX_API_URL=https://sandbox.paygistix.com/v1
PAYGISTIX_MERCHANT_ID=your_merchant_id
PAYGISTIX_API_KEY=your_api_key
PAYGISTIX_API_SECRET=your_api_secret
PAYGISTIX_WEBHOOK_SECRET=your_webhook_secret
```

### 3. Database Migration
```bash
# Run migration script to add payment tables
node scripts/migrate-payment-system.js
```

### 4. Test Integration
```bash
# Run payment tests
npm test tests/integration/payment.test.js

# Test with sample transaction
node scripts/test-paygistix.js
```

## Architecture

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API    │────▶│   Paygistix     │
│   (React/Vue)   │     │   (Express.js)   │     │      API        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐          ┌────────────────┐
                        │   MongoDB    │          │    Webhooks    │
                        │  Database    │◀─────────│    Handler     │
                        └──────────────┘          └────────────────┘
```

### Data Flow

1. **Payment Initiation**
   - Customer selects items and proceeds to checkout
   - Frontend collects payment information
   - Backend creates payment intent with Paygistix

2. **Payment Processing**
   - Frontend submits payment details to Paygistix
   - Paygistix processes the payment
   - Backend receives webhook confirmation

3. **Order Fulfillment**
   - Payment confirmation triggers order processing
   - Customer receives confirmation email
   - Order status updated in database

## Implementation Steps

### Step 1: Create Payment Model

```javascript
// server/models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    paygistixTransactionId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: {
            type: String,
            enum: ['card', 'ach', 'saved_card'],
            required: true
        },
        last4: String,
        brand: String,
        tokenId: String
    },
    refunds: [{
        refundId: String,
        amount: Number,
        reason: String,
        createdAt: Date,
        status: String
    }],
    attempts: {
        type: Number,
        default: 1
    },
    errorMessage: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
```

### Step 2: Implement Service Layer

```javascript
// server/services/paygistixService.js
const axios = require('axios');
const crypto = require('crypto');

class PaygistixService {
    constructor() {
        this.apiUrl = process.env.PAYGISTIX_API_URL;
        this.merchantId = process.env.PAYGISTIX_MERCHANT_ID;
        this.apiKey = process.env.PAYGISTIX_API_KEY;
        this.apiSecret = process.env.PAYGISTIX_API_SECRET;
        
        this.client = axios.create({
            baseURL: this.apiUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-Merchant-ID': this.merchantId
            }
        });
    }
    
    generateSignature(method, path, timestamp, body) {
        const payload = [method, path, timestamp, JSON.stringify(body)].join('|');
        return crypto.createHmac('sha256', this.apiSecret)
            .update(payload)
            .digest('hex');
    }
    
    async createPaymentIntent(data) {
        const timestamp = Date.now().toString();
        const signature = this.generateSignature('POST', '/payment-intents', timestamp, data);
        
        const response = await this.client.post('/payment-intents', data, {
            headers: {
                'X-Api-Key': this.apiKey,
                'X-Timestamp': timestamp,
                'X-Signature': signature
            }
        });
        
        return response.data;
    }
}

module.exports = new PaygistixService();
```

### Step 3: Create API Routes

```javascript
// server/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');

router.post('/payment-intent',
    requireAuth,
    [
        body('orderId').isMongoId().withMessage('Invalid order ID')
    ],
    paymentController.createPaymentIntent
);

router.post('/process',
    requireAuth,
    [
        body('paymentIntentId').notEmpty()
    ],
    paymentController.processPayment
);

router.post('/:paymentId/refund',
    requireAuth,
    [
        body('reason').notEmpty()
    ],
    paymentController.refundPayment
);

module.exports = router;
```

### Step 4: Implement Webhook Handler

```javascript
// server/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Raw body parser for webhook signature verification
router.post('/paygistix',
    express.raw({ type: 'application/json' }),
    webhookController.handlePaygistixWebhook
);

module.exports = router;
```

### Step 5: Frontend Integration

```javascript
// Frontend payment component example
import { loadPaygistix } from '@paygistix/js';

const PaymentForm = ({ orderId, amount }) => {
    const [clientSecret, setClientSecret] = useState('');
    
    useEffect(() => {
        // Create payment intent
        fetch('/api/payments/payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ orderId })
        })
        .then(res => res.json())
        .then(data => setClientSecret(data.clientSecret));
    }, [orderId]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const paygistix = await loadPaygistix(PAYGISTIX_PUBLIC_KEY);
        const result = await paygistix.confirmPayment({
            clientSecret,
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: customerName,
                    email: customerEmail
                }
            }
        });
        
        if (result.error) {
            // Handle error
        } else {
            // Payment successful
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            {/* Payment form fields */}
        </form>
    );
};
```

## API Integration

### Authentication

All API requests must include authentication headers:

```javascript
const headers = {
    'X-Api-Key': process.env.PAYGISTIX_API_KEY,
    'X-Timestamp': Date.now().toString(),
    'X-Signature': generateSignature(method, path, timestamp, body),
    'Content-Type': 'application/json'
};
```

### Core API Methods

#### Create Payment Intent
```javascript
async createPaymentIntent(amount, currency, metadata) {
    return await paygistixService.post('/payment-intents', {
        amount,
        currency,
        metadata
    });
}
```

#### Capture Payment
```javascript
async capturePayment(paymentIntentId) {
    return await paygistixService.post(
        `/payment-intents/${paymentIntentId}/capture`
    );
}
```

#### Process Refund
```javascript
async refundPayment(transactionId, amount, reason) {
    return await paygistixService.post('/refunds', {
        transactionId,
        amount,
        reason
    });
}
```

### Error Handling

```javascript
try {
    const payment = await paygistixService.createPaymentIntent(data);
} catch (error) {
    if (error.response) {
        // API error response
        console.error('API Error:', error.response.data);
        
        switch (error.response.status) {
            case 400:
                // Invalid request
                break;
            case 401:
                // Authentication failed
                break;
            case 402:
                // Payment required (insufficient funds)
                break;
            case 429:
                // Rate limit exceeded
                break;
            default:
                // Other errors
        }
    } else if (error.request) {
        // Network error
        console.error('Network Error:', error.message);
    }
}
```

## Security Best Practices

### 1. API Key Management
- Store API keys in environment variables
- Never commit API keys to version control
- Rotate API keys regularly
- Use different keys for development and production

### 2. Request Signing
```javascript
function generateSignature(method, path, timestamp, body, secret) {
    const payload = [
        method.toUpperCase(),
        path,
        timestamp,
        body ? JSON.stringify(body) : ''
    ].join('|');
    
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}
```

### 3. Webhook Security
```javascript
function verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}
```

### 4. PCI Compliance
- Never store raw card data
- Use tokenization for saved cards
- Implement proper access controls
- Log all payment-related activities
- Regular security audits

### 5. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests
    message: 'Too many payment attempts'
});

app.use('/api/payments', paymentLimiter);
```

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/paygistixService.test.js
describe('PaygistixService', () => {
    it('should generate correct signature', () => {
        const signature = paygistixService.generateSignature(
            'POST',
            '/payment-intents',
            '1234567890',
            { amount: 1000 }
        );
        
        expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
    
    it('should create payment intent', async () => {
        const mockResponse = {
            data: {
                id: 'pi_test_123',
                clientSecret: 'pi_test_123_secret',
                amount: 1000
            }
        };
        
        axios.post.mockResolvedValue(mockResponse);
        
        const result = await paygistixService.createPaymentIntent({
            amount: 1000,
            currency: 'USD'
        });
        
        expect(result.id).toBe('pi_test_123');
        expect(result.amount).toBe(1000);
    });
});
```

### Integration Tests

```javascript
// tests/integration/payment.test.js
describe('Payment Integration', () => {
    it('should process payment end-to-end', async () => {
        // Create order
        const order = await Order.create({
            customerId: testCustomer._id,
            totalAmount: 25.00,
            serviceType: 'wash-dry-fold'
        });
        
        // Create payment intent
        const intentResponse = await request(app)
            .post('/api/payments/payment-intent')
            .set('Authorization', `Bearer ${token}`)
            .send({ orderId: order._id });
            
        expect(intentResponse.status).toBe(200);
        expect(intentResponse.body.paymentIntentId).toBeDefined();
        
        // Process payment
        const paymentResponse = await request(app)
            .post('/api/payments/process')
            .set('Authorization', `Bearer ${token}`)
            .send({
                paymentIntentId: intentResponse.body.paymentIntentId
            });
            
        expect(paymentResponse.status).toBe(200);
        expect(paymentResponse.body.status).toBe('completed');
    });
});
```

### Test Data

Use these test card numbers in the sandbox environment:

| Card Number | Type | Result |
|-------------|------|--------|
| 4242424242424242 | Visa | Success |
| 4000000000000002 | Visa | Decline |
| 5555555555554444 | Mastercard | Success |
| 378282246310005 | Amex | Success |

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Database migrations completed
- [ ] Webhook endpoints configured in Paygistix dashboard
- [ ] Error monitoring configured
- [ ] Logging configured

### Security Review
- [ ] API keys secured
- [ ] Request signing implemented
- [ ] Webhook signature verification enabled
- [ ] Rate limiting configured
- [ ] HTTPS enforced
- [ ] Access controls implemented

### Production Configuration
```bash
# Production environment variables
NODE_ENV=production
PAYGISTIX_API_URL=https://api.paygistix.com/v1
PAYGISTIX_MERCHANT_ID=prod_merchant_id
PAYGISTIX_API_KEY=prod_api_key
PAYGISTIX_API_SECRET=prod_api_secret
PAYGISTIX_WEBHOOK_SECRET=prod_webhook_secret

# Security settings
ENABLE_HTTPS=true
FORCE_SSL=true
SESSION_SECRET=strong_random_secret
ENCRYPTION_KEY=32_byte_hex_key
```

### Post-deployment
- [ ] Test payment flow in production
- [ ] Verify webhook delivery
- [ ] Monitor error rates
- [ ] Check payment success rates
- [ ] Review security logs

## Monitoring & Maintenance

### Key Metrics

1. **Payment Success Rate**
   ```javascript
   const successRate = await Payment.aggregate([
       {
           $group: {
               _id: null,
               total: { $sum: 1 },
               successful: {
                   $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
               }
           }
       },
       {
           $project: {
               successRate: {
                   $multiply: [{ $divide: ['$successful', '$total'] }, 100]
               }
           }
       }
   ]);
   ```

2. **Average Processing Time**
   ```javascript
   const avgProcessingTime = await Payment.aggregate([
       { $match: { status: 'completed' } },
       {
           $project: {
               processingTime: {
                   $subtract: ['$updatedAt', '$createdAt']
               }
           }
       },
       {
           $group: {
               _id: null,
               avgTime: { $avg: '$processingTime' }
           }
       }
   ]);
   ```

3. **Failed Payment Analysis**
   ```javascript
   const failureReasons = await Payment.aggregate([
       { $match: { status: 'failed' } },
       {
           $group: {
               _id: '$errorMessage',
               count: { $sum: 1 }
           }
       },
       { $sort: { count: -1 } }
   ]);
   ```

### Maintenance Tasks

#### Daily
- Monitor payment success rates
- Review failed transactions
- Check webhook delivery status

#### Weekly
- Analyze payment trends
- Review security logs
- Update fraud rules if needed

#### Monthly
- Reconcile transactions
- Review and optimize payment flows
- Update documentation

## Troubleshooting

### Common Issues

#### 1. Authentication Failures
**Problem**: "Invalid API credentials" error

**Solutions**:
- Verify API key and secret are correct
- Check if using correct environment (sandbox vs production)
- Ensure merchant ID matches your account
- Verify signature generation algorithm

```javascript
// Debug authentication
console.log('API Key:', process.env.PAYGISTIX_API_KEY);
console.log('Merchant ID:', process.env.PAYGISTIX_MERCHANT_ID);
console.log('API URL:', process.env.PAYGISTIX_API_URL);
```

#### 2. Webhook Signature Failures
**Problem**: Webhook verification fails

**Solutions**:
- Ensure using raw request body for verification
- Check webhook secret is correct
- Verify no middleware is modifying the request

```javascript
// Correct webhook setup
app.use('/webhooks/paygistix', 
    express.raw({ type: 'application/json' }),
    webhookHandler
);
```

#### 3. Payment Declines
**Problem**: Payments being declined

**Solutions**:
- Check decline reason in response
- Verify card details are correct
- Check for fraud blocks
- Contact Paygistix support for specific decline codes

```javascript
// Handle specific decline reasons
switch (error.code) {
    case 'insufficient_funds':
        // Suggest alternative payment method
        break;
    case 'card_declined':
        // Ask customer to contact their bank
        break;
    case 'expired_card':
        // Request updated card information
        break;
}
```

#### 4. Timeout Errors
**Problem**: Requests timing out

**Solutions**:
- Increase timeout settings
- Implement retry logic
- Check network connectivity
- Verify Paygistix API status

```javascript
// Implement retry logic
async function retryableRequest(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

### Debug Mode

Enable detailed logging for troubleshooting:

```javascript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
    axios.interceptors.request.use(request => {
        console.log('Starting Request:', request);
        return request;
    });
    
    axios.interceptors.response.use(
        response => {
            console.log('Response:', response);
            return response;
        },
        error => {
            console.log('Error:', error.response);
            return Promise.reject(error);
        }
    );
}
```

### Support Resources

- **Paygistix Support**: support@paygistix.com
- **API Status Page**: https://status.paygistix.com
- **Developer Documentation**: https://docs.paygistix.com
- **Community Forum**: https://forum.paygistix.com

### Emergency Contacts

- **24/7 Technical Support**: +1-800-PAYGISTIX
- **Security Issues**: security@paygistix.com
- **Escalation**: escalation@paygistix.com
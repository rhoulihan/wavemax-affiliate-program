# V2 Payment System - Complete Implementation Plan

## Executive Summary
Transitioning from credit card payments (Paygistix) to payment links for Venmo, PayPal, and CashApp with automated verification via email scanning.

## System Architecture

### Payment Flow Diagram
```
Customer Registration (V2)
    ↓ (No payment, 1-2 free bags)
Schedule Pickup
    ↓ (No payment required)
Laundry Weighed
    ↓
Generate Payment Links
    ↓
Send Payment Request Email
    ↓
Customer Makes Payment → Email to payments@wavemax.promo
    ↓                           ↓
WDF Process Complete    Email Scanner Detects Payment
    ↓                           ↓
Check Payment Status ← ← ← ← ← ↓
    ↓
If Paid: Send Pickup Notification
If Not: Continue Checking (max 4 hours)
```

## Phase 1: Configuration & Feature Toggle

### 1.1 SystemConfig Entries
```javascript
const v2PaymentConfigs = [
  {
    key: 'payment_version',
    value: 'v1', // Toggle: 'v1' or 'v2'
    defaultValue: 'v1',
    dataType: 'string',
    category: 'payment',
    description: 'Payment system version toggle'
  },
  {
    key: 'payment_notification_email',
    value: 'payments@wavemax.promo',
    defaultValue: 'payments@wavemax.promo',
    dataType: 'string',
    category: 'payment',
    description: 'Email address for payment notifications'
  },
  {
    key: 'venmo_handle',
    value: '@wavemax',
    defaultValue: '@wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'Venmo business handle'
  },
  {
    key: 'paypal_handle',
    value: 'wavemax',
    defaultValue: 'wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'PayPal.me handle'
  },
  {
    key: 'cashapp_handle',
    value: '$wavemax',
    defaultValue: '$wavemax',
    dataType: 'string',
    category: 'payment',
    description: 'CashApp cashtag'
  },
  {
    key: 'free_initial_bags',
    value: 2,
    defaultValue: 2,
    dataType: 'number',
    category: 'customer',
    description: 'Number of free bags for V2 registration'
  },
  {
    key: 'payment_check_interval',
    value: 300000, // 5 minutes in ms
    defaultValue: 300000,
    dataType: 'number',
    category: 'payment',
    description: 'Interval for checking payment status (ms)'
  },
  {
    key: 'payment_check_max_attempts',
    value: 48, // 4 hours with 5-minute intervals
    defaultValue: 48,
    dataType: 'number',
    category: 'payment',
    description: 'Maximum payment check attempts'
  },
  {
    key: 'mailcow_api_url',
    value: 'https://mail.wavemax.promo/api/v1',
    defaultValue: 'https://mail.wavemax.promo/api/v1',
    dataType: 'string',
    category: 'system',
    description: 'Mailcow API endpoint'
  },
  {
    key: 'mailcow_api_key',
    value: '', // Will be encrypted
    defaultValue: '',
    dataType: 'encrypted',
    category: 'system',
    description: 'Mailcow API key (encrypted)'
  }
];
```

### 1.2 Database Schema Updates

#### Customer Model Updates
```javascript
// Add to Customer schema
registrationVersion: {
  type: String,
  enum: ['v1', 'v2'],
  default: 'v1'
},
initialBagsRequested: {
  type: Number,
  min: 1,
  max: 2,
  default: 1
},
// Remove payment requirement from v2 registration validation
```

#### Order Model Updates
```javascript
// Add to Order schema
paymentStatus: {
  type: String,
  enum: ['pending', 'awaiting', 'verified', 'failed'],
  default: 'pending'
},
paymentMethod: {
  type: String,
  enum: ['venmo', 'paypal', 'cashapp', 'multiple', 'pending'],
  default: 'pending'
},
paymentAmount: {
  type: Number,
  default: 0
},
paymentRequestedAt: Date,
paymentVerifiedAt: Date,
paymentTransactionId: String,
paymentLinks: {
  venmo: String,
  paypal: String,
  cashapp: String
},
paymentQRCodes: {
  venmo: String, // Base64 encoded
  paypal: String,
  cashapp: String
},
paymentCheckAttempts: {
  type: Number,
  default: 0
},
lastPaymentCheck: Date,
paymentNotes: String // For storing verification details
```

## Phase 2: Payment Link Generation Service

### 2.1 Payment Link Service
```javascript
// server/services/paymentLinkService.js
const QRCode = require('qrcode');
const SystemConfig = require('../models/SystemConfig');

class PaymentLinkService {
  async generatePaymentLinks(orderId, amount, customerName) {
    // Get handles from SystemConfig
    const venmoHandle = await SystemConfig.getValue('venmo_handle');
    const paypalHandle = await SystemConfig.getValue('paypal_handle');
    const cashappHandle = await SystemConfig.getValue('cashapp_handle');
    
    // Use last 8 characters of order ID for reference
    const shortOrderId = orderId.toString().slice(-8).toUpperCase();
    const note = `WaveMAX Order #${shortOrderId}`;
    
    // Generate payment links
    const links = {
      venmo: `venmo://paycharge?txn=pay&recipients=${venmoHandle.replace('@', '')}&amount=${amount}&note=${encodeURIComponent(note)}`,
      paypal: `https://paypal.me/${paypalHandle}/${amount}USD?notes=${encodeURIComponent(note)}`,
      cashapp: `https://cash.app/${cashappHandle}/${amount}?note=${encodeURIComponent(note)}`
    };
    
    // Generate QR codes
    const qrCodes = {};
    for (const [provider, link] of Object.entries(links)) {
      qrCodes[provider] = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    }
    
    return { links, qrCodes };
  }
}
```

## Phase 3: Email Integration & Payment Verification

### 3.1 Mailcow Service
```javascript
// server/services/mailcowService.js
const axios = require('axios');
const { decrypt } = require('../utils/encryption');

class MailcowService {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
    this.initialized = false;
  }
  
  async initialize() {
    this.apiUrl = await SystemConfig.getValue('mailcow_api_url');
    const encryptedKey = await SystemConfig.getValue('mailcow_api_key');
    this.apiKey = decrypt(encryptedKey);
    this.initialized = true;
  }
  
  async getUnreadPaymentEmails() {
    if (!this.initialized) await this.initialize();
    
    // Mailcow API call to get unread emails to payments@wavemax.promo
    const response = await axios.get(`${this.apiUrl}/mail/messages`, {
      headers: { 'X-API-Key': this.apiKey },
      params: {
        to: 'payments@wavemax.promo',
        unread: true,
        limit: 50
      }
    });
    
    return response.data;
  }
  
  async markEmailAsProcessed(messageId) {
    // Mark email as read and add processed label
    await axios.put(`${this.apiUrl}/mail/messages/${messageId}`, {
      read: true,
      labels: ['processed', 'payment-verified']
    }, {
      headers: { 'X-API-Key': this.apiKey }
    });
  }
}
```

### 3.2 Payment Email Scanner
```javascript
// server/services/paymentEmailScanner.js
class PaymentEmailScanner {
  constructor() {
    this.mailcow = new MailcowService();
  }
  
  async scanForPayments() {
    const emails = await this.mailcow.getUnreadPaymentEmails();
    const verifiedPayments = [];
    
    for (const email of emails) {
      const payment = await this.parsePaymentEmail(email);
      if (payment) {
        verifiedPayments.push(payment);
        await this.mailcow.markEmailAsProcessed(email.id);
      }
    }
    
    return verifiedPayments;
  }
  
  async parsePaymentEmail(email) {
    const { subject, body, from } = email;
    
    // Detect provider
    let provider = null;
    if (from.includes('venmo.com')) provider = 'venmo';
    else if (from.includes('paypal.com')) provider = 'paypal';
    else if (from.includes('cash.app')) provider = 'cashapp';
    
    if (!provider) return null;
    
    // Extract order ID from body
    const orderIdMatch = body.match(/Order\s*#?\s*([A-Z0-9]{8})/i);
    if (!orderIdMatch) return null;
    
    const shortOrderId = orderIdMatch[1];
    
    // Extract amount
    const amountMatch = body.match(/\$?([\d,]+\.?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null;
    
    // Find full order ID
    const order = await Order.findOne({
      _id: { $regex: new RegExp(shortOrderId + '$', 'i') },
      paymentStatus: 'awaiting'
    });
    
    if (!order) return null;
    
    return {
      orderId: order._id,
      provider,
      amount,
      transactionId: email.id,
      emailSubject: subject,
      verifiedAt: new Date()
    };
  }
  
  async verifyOrderPayment(orderId) {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus === 'verified') return false;
    
    const emails = await this.mailcow.getUnreadPaymentEmails();
    
    for (const email of emails) {
      const payment = await this.parsePaymentEmail(email);
      if (payment && payment.orderId.toString() === orderId.toString()) {
        // Verify amount matches (allow small variance for fees)
        const variance = Math.abs(payment.amount - order.paymentAmount);
        if (variance <= 0.50) {
          // Update order
          order.paymentStatus = 'verified';
          order.paymentVerifiedAt = new Date();
          order.paymentTransactionId = payment.transactionId;
          order.paymentMethod = payment.provider;
          order.paymentNotes = `Verified via email: ${payment.emailSubject}`;
          await order.save();
          
          // Mark email as processed
          await this.mailcow.markEmailAsProcessed(email.id);
          
          return true;
        }
      }
    }
    
    return false;
  }
}
```

### 3.3 Payment Verification Job
```javascript
// server/jobs/paymentVerificationJob.js
const cron = require('node-cron');
const Order = require('../models/Order');
const PaymentEmailScanner = require('../services/paymentEmailScanner');
const emailService = require('../utils/emailService');

class PaymentVerificationJob {
  constructor() {
    this.scanner = new PaymentEmailScanner();
    this.running = false;
  }
  
  start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      if (this.running) return;
      this.running = true;
      
      try {
        await this.checkPendingPayments();
      } catch (error) {
        console.error('Payment verification job error:', error);
      } finally {
        this.running = false;
      }
    });
  }
  
  async checkPendingPayments() {
    // Get orders awaiting payment that have completed WDF
    const orders = await Order.find({
      paymentStatus: 'awaiting',
      status: 'processed', // WDF complete
      paymentCheckAttempts: { $lt: 48 }
    });
    
    for (const order of orders) {
      const verified = await this.scanner.verifyOrderPayment(order._id);
      
      if (verified) {
        // Send payment confirmation
        await emailService.sendPaymentConfirmation(order);
        
        // Send pickup ready notification
        await emailService.sendPickupReadyNotification(order);
      } else {
        // Increment check attempts
        order.paymentCheckAttempts++;
        order.lastPaymentCheck = new Date();
        
        if (order.paymentCheckAttempts >= 48) {
          // Max attempts reached - escalate
          order.paymentStatus = 'failed';
          await emailService.notifyAdminPaymentTimeout(order);
        } else if (order.paymentCheckAttempts % 6 === 0) {
          // Send reminder every 30 minutes
          await emailService.sendPaymentReminder(order);
        }
        
        await order.save();
      }
    }
  }
}
```

## Phase 4: V2 Registration & Scheduling Forms

### 4.1 V2 Customer Registration
- Remove all Paygistix integration
- Remove payment collection
- Add bag selection (1-2 bags, free)
- Simplify to single-step registration

### 4.2 V2 Schedule Pickup
- Remove payment requirement
- Create order with `paymentStatus: 'pending'`
- Send confirmation without payment details

## Phase 5: Order Processing Updates

### 5.1 After Weighing
```javascript
// In orderController.js - updateOrderAfterWeighing
async function processWeighedOrder(order) {
  const customer = await Customer.findById(order.customerId);
  
  if (customer.registrationVersion === 'v2') {
    // Calculate total
    const total = calculateOrderTotal(order);
    order.paymentAmount = total;
    order.paymentStatus = 'awaiting';
    order.paymentRequestedAt = new Date();
    
    // Generate payment links
    const { links, qrCodes } = await paymentLinkService.generatePaymentLinks(
      order._id,
      total,
      customer.name
    );
    
    order.paymentLinks = links;
    order.paymentQRCodes = qrCodes;
    await order.save();
    
    // Send payment request
    await emailService.sendPaymentRequest(order);
  }
}
```

### 5.2 After WDF Complete
```javascript
// In orderController.js - after WDF processing
async function handleWDFComplete(order) {
  const customer = await Customer.findById(order.customerId);
  
  if (customer.registrationVersion === 'v1' || order.paymentStatus === 'verified') {
    // V1 customer or payment already verified - send pickup notification
    await emailService.sendPickupReadyNotification(order);
  } else {
    // V2 customer - check payment status
    const verified = await paymentEmailScanner.verifyOrderPayment(order._id);
    
    if (verified) {
      await emailService.sendPickupReadyNotification(order);
    } else {
      // Payment verification will be handled by cron job
      console.log(`Order ${order._id} awaiting payment verification`);
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Payment link generation
- QR code generation
- Email parsing for each provider
- Order status updates

### Integration Tests
- End-to-end V2 registration
- Payment request flow
- Email scanning simulation
- Payment verification flow

### Manual Testing Checklist
- [ ] V2 registration without payment
- [ ] Schedule pickup without payment
- [ ] Receive payment request after weighing
- [ ] Payment links work for all providers
- [ ] QR codes scan correctly
- [ ] Email parsing detects payments
- [ ] Pickup notification held until payment
- [ ] Payment reminders sent on schedule
- [ ] Admin notified of timeouts

## Rollback Plan

1. **Feature Toggle**: Set `payment_version` to 'v1' in SystemConfig
2. **Database**: Payment fields are additive, no data loss
3. **Forms**: V1 forms remain unchanged
4. **Email**: Payment emails can be manually processed

## Security Considerations

1. **No payment data stored**: Only transaction IDs and status
2. **Encrypted API keys**: Mailcow credentials encrypted at rest
3. **Rate limiting**: Scanner runs at controlled intervals
4. **Audit logging**: All payment verifications logged
5. **Order ID obfuscation**: Only last 8 characters in payment notes

## Performance Considerations

1. **Email scanning**: Limited to 50 emails per check
2. **Cron job**: 5-minute intervals to prevent overload
3. **Database queries**: Indexed on paymentStatus
4. **QR code generation**: Cached after first generation

## Monitoring & Alerts

1. **Scanner health**: Alert if no scan in 15 minutes
2. **Payment timeouts**: Alert admin after 4 hours
3. **Email errors**: Log and alert on API failures
4. **Verification metrics**: Dashboard showing success rates

---

*Last Updated: 2025-01-27*
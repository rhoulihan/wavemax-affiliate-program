# Paygistix Quick Reference Guide

## Environment Setup

```bash
# Required environment variables
PAYGISTIX_API_URL=https://api.paygistix.com/v1
PAYGISTIX_API_KEY=your_api_key
PAYGISTIX_API_SECRET=your_api_secret
PAYGISTIX_WEBHOOK_SECRET=your_webhook_secret
```

## Common API Calls

### Process Payment
```javascript
const paygistix = require('./services/paygistix');

// Process a payment
const payment = await paygistix.payment.createPayment({
  amount: 5000, // $50.00 in cents
  currency: 'USD',
  paymentMethodId: 'pm_xxxxx',
  metadata: {
    orderId: 'ORD123',
    customerId: 'CUST456'
  }
});
```

### Create Payout
```javascript
// Send money to affiliate
const payout = await paygistix.payment.createPayout({
  amount: 10000, // $100.00 in cents
  currency: 'USD',
  destination: 'ba_xxxxx', // Bank account token
  metadata: {
    affiliateId: 'AFF789',
    type: 'commission'
  }
});
```

### Tokenize Card
```javascript
// Tokenize credit card (client-side)
const token = await paygistix.token.tokenizeCard({
  number: '4242424242424242',
  expMonth: 12,
  expYear: 2025,
  cvc: '123'
});
```

### Add Payment Method
```javascript
// Store payment method for customer
const paymentMethod = await paygistix.token.createPaymentMethod({
  type: 'card',
  tokenId: token.id,
  customerId: 'CUST456'
});
```

## Webhook Events

### Payment Events
- `payment.succeeded` - Payment completed successfully
- `payment.failed` - Payment failed
- `payment.refunded` - Payment was refunded

### Payout Events
- `payout.completed` - Payout sent successfully
- `payout.failed` - Payout failed
- `payout.returned` - Payout was returned

### Example Webhook Handler
```javascript
app.post('/webhooks/paygistix', async (req, res) => {
  const event = req.body;
  
  switch (event.type) {
    case 'payment.succeeded':
      // Update order status
      await Order.updateOne(
        { orderId: event.data.metadata.orderId },
        { paymentStatus: 'paid' }
      );
      break;
  }
  
  res.json({ received: true });
});
```

## Error Handling

### Common Errors
```javascript
try {
  await paygistix.payment.createPayment({...});
} catch (error) {
  switch (error.code) {
    case 'card_declined':
      // Handle declined card
      break;
    case 'insufficient_funds':
      // Handle insufficient funds
      break;
    case 'invalid_token':
      // Token expired or invalid
      break;
    default:
      // Generic error handling
  }
}
```

## Testing

### Test Cards
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Insufficient Funds: `4000 0000 0000 9995`

### Test API Calls
```javascript
// Enable test mode
const paygistix = require('./services/paygistix');
paygistix.setTestMode(true);

// Test payment
const testPayment = await paygistix.payment.createPayment({
  amount: 100, // $1.00
  paymentMethodId: 'pm_test_success',
  metadata: { test: true }
});
```

## Useful Commands

### Check Integration Status
```javascript
// Verify API connection
const status = await paygistix.getStatus();
console.log('Paygistix connected:', status.connected);
```

### List Recent Transactions
```javascript
// Get recent payments
const payments = await paygistix.payment.listPayments({
  limit: 10,
  status: 'succeeded'
});
```

### Debug Mode
```javascript
// Enable detailed logging
paygistix.enableDebugMode();

// Disable logging
paygistix.disableDebugMode();
```

## Support

- API Docs: https://docs.paygistix.com
- Status: https://status.paygistix.com
- Support: support@paygistix.com
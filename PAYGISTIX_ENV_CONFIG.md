# Paygistix Environment Configuration

## Date: January 11, 2025

### Environment Variables Added

The following environment variables have been added to support secure Paygistix configuration:

```bash
# Paygistix Form Configuration
PAYGISTIX_MERCHANT_ID=wmaxaustWEB
PAYGISTIX_FORM_ID=55015031208
PAYGISTIX_FORM_HASH=your_paygistix_form_hash_value_here
PAYGISTIX_FORM_ACTION_URL=https://safepay.paymentlogistics.net/transaction.asp
```

### Implementation Details

1. **Environment Variables** (`.env.example`)
   - Added configuration for merchant ID, form ID, hash, and action URL
   - These values are now configurable per environment

2. **Payment Form Component** (`paygistix-payment-form.js`)
   - Updated to accept configuration values as options
   - Falls back to default values if not provided
   - Form action URL is now dynamic

3. **Payment Config Endpoint** (`/api/v1/payments/config`)
   - New public endpoint to retrieve payment configuration
   - Returns non-sensitive configuration values
   - Validates that hash is set in production

4. **Payment Embed Page** (`paygistix-payment-embed.html`)
   - Loads configuration from server before initializing form
   - Passes configuration to payment form component
   - Handles configuration loading errors

### Security Considerations

1. **Hash Value Security**
   - The form hash should be kept secure and only stored in environment variables
   - Never commit the actual hash value to version control
   - Production will fail if hash is not properly configured

2. **Configuration Endpoint**
   - Only returns non-sensitive values (no API secrets)
   - Validates configuration before returning
   - Returns proper error if misconfigured

### Usage

1. **Development Setup**:
   ```bash
   # Add to your .env file
   PAYGISTIX_MERCHANT_ID=wmaxaustWEB
   PAYGISTIX_FORM_ID=55015031208
   PAYGISTIX_FORM_HASH=dev_test_hash_value
   ```

2. **Production Setup**:
   ```bash
   # Set in production environment
   PAYGISTIX_MERCHANT_ID=wmaxaustWEB
   PAYGISTIX_FORM_ID=55015031208
   PAYGISTIX_FORM_HASH=actual_production_hash_from_paygistix
   ```

3. **Client Usage**:
   ```javascript
   // Configuration is automatically loaded from server
   const paymentForm = new PaygistixPaymentForm('container', {
       orderId: 'ORD-123',
       customerId: 'CUST-456'
       // Config values are fetched automatically
   });
   ```

### Next Steps

1. Obtain the actual hash value from Paygistix
2. Set the environment variables in production
3. Test the payment flow with real credentials
4. Monitor the configuration endpoint for any issues
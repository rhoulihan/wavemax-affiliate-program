# Customer Registration with Paygistix Payment Integration

## Date: January 11, 2025

### Overview
Replaced the payment information section on the customer registration form with the Paygistix payment component. The form now uses context-based filtering to show only the bag fee (BF) line item during registration.

### Implementation Details

#### 1. Payment Context
- Added hidden `PAYCONTEXT` element with value "REGISTRATION"
- This ensures only the BF (Bag Fee) line item is visible in the payment form
- All other line items (WDF, delivery fees) are hidden

#### 2. Form Structure Changes
- Removed manual payment fields (card number, CVV, expiry, etc.)
- Added `paymentFormContainer` div where Paygistix form is loaded
- Changed submit button from type="submit" to type="button" with custom handler

#### 3. Bag Fee Integration
- Updated bag descriptions to show $1.00 per bag (from system config)
- Select options updated: "1 bag - $1.00", "2 bags - $2.00", etc.
- Bag quantity automatically updates the Paygistix form

#### 4. Registration Flow
1. Customer fills out registration form
2. Selects number of bags needed
3. Paygistix payment form shows only bag fee
4. Click "Register for Laundry Service"
5. Form validates all fields
6. Customer data stored in sessionStorage
7. Paygistix form submits to payment gateway
8. Callback handles registration completion

#### 5. JavaScript Changes
```javascript
// Initialize payment form on page load
await initializePaymentForm();

// Update bag quantity in payment form when selection changes
function updateBagQuantity() {
    const numberOfBags = document.getElementById('numberOfBags').value;
    if (paymentForm && numberOfBags) {
        paymentForm.setPrefilledAmounts({
            BF: parseInt(numberOfBags)
        });
    }
}

// Handle registration submission
function handleRegistrationSubmit() {
    // Validate form
    // Check payment form has data
    // Store customer data in session
    // Submit Paygistix form
}
```

#### 6. Payment Callback Processing
After successful payment:
1. Paygistix redirects to `/api/v1/payment_callback`
2. Callback reads `pendingRegistration` from sessionStorage
3. Creates customer account with payment confirmation
4. Redirects to success page

### Security Considerations
- No payment card data is handled by our servers
- All payment processing goes through Paygistix
- Customer data stored temporarily in sessionStorage
- Payment confirmation required before account creation

### Configuration Required
1. Set `PAYGISTIX_FORM_HASH` environment variable
2. Ensure `bag_fee` system configuration is set
3. Configure return URL in Paygistix dashboard

### Testing
1. Load customer registration page
2. Verify only BF line item shows in payment form
3. Select number of bags
4. Verify payment form updates with correct quantity
5. Submit registration
6. Verify redirect to Paygistix
7. Complete payment
8. Verify account creation and success page
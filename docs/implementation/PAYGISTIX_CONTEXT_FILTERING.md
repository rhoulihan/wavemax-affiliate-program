# Paygistix Payment Form Context Filtering

## Date: January 11, 2025

### Overview
The Paygistix payment form now dynamically shows/hides line items based on the payment context and loads affiliate-specific pricing from the system configuration.

### Implementation Details

#### 1. Payment Contexts

The payment form looks for a page element with ID `PAYCONTEXT` to determine which line items to display:

- **REGISTRATION Context**:
  - Only shows the BF (Bag Fee) line item at $1.00
  - All other line items are hidden
  - Used for one-time registration payments

- **ORDER Context**:
  - Shows WDF (Wash Dry Fold) with system-configured price per pound
  - Shows appropriate delivery fee based on affiliate settings
  - Shows minimum fee if applicable
  - Looks for `AFFILIATEID` element to load affiliate-specific pricing

#### 2. Dynamic Pricing

The form loads pricing from multiple sources:

1. **System Configuration**:
   - WDF price per pound from `/api/v1/system/config/wdf_price_per_pound`
   - Default: $1.25 per pound

2. **Affiliate Settings** (when AFFILIATEID is provided):
   - Per bag delivery fee (e.g., $5, $10, $15, $20)
   - Minimum delivery fee (e.g., $25, $30, $40, $50, $75)
   - Loaded from `/api/v1/affiliates/{affiliateId}`

#### 3. Line Item Filtering Logic

```javascript
// For REGISTRATION context
if (payContext === 'REGISTRATION') {
    // Only show BF (Bag Fee)
}

// For ORDER context
if (payContext === 'ORDER') {
    // Show WDF (always)
    // Show matching delivery fee (DF5, DF10, etc.) based on affiliate's perBagDeliveryFee
    // Show matching minimum fee (MC25, MC30, etc.) based on affiliate's minimumDeliveryFee
}
```

#### 4. Usage Examples

##### Registration Payment Page
```html
<!-- Set context for registration -->
<input type="hidden" id="PAYCONTEXT" value="REGISTRATION" />

<!-- Initialize payment form -->
<div id="paymentFormContainer"></div>

<script>
const paymentForm = new PaygistixPaymentForm('paymentFormContainer', {
    customerId: 'CUST-123',
    // Form will automatically show only BF line item
});
</script>
```

##### Order Payment Page
```html
<!-- Set context and affiliate -->
<input type="hidden" id="PAYCONTEXT" value="ORDER" />
<input type="hidden" id="AFFILIATEID" value="AFF-789" />

<!-- Initialize payment form -->
<div id="paymentFormContainer"></div>

<script>
const paymentForm = new PaygistixPaymentForm('paymentFormContainer', {
    orderId: 'ORD-456',
    customerId: 'CUST-123',
    // Form will load affiliate pricing and show relevant line items
});
</script>
```

#### 5. Pre-built Payment Pages

Two ready-to-use payment pages have been created:

1. **Registration Payment** (`/paygistix-registration-payment.html`)
   - Pre-configured for REGISTRATION context
   - Shows only bag fee
   - Pre-fills quantity to 1

2. **Order Payment** (`/paygistix-order-payment.html`)
   - Pre-configured for ORDER context
   - Loads order details and affiliate settings
   - Shows order summary
   - Pre-fills quantities based on order

#### 6. Dynamic Context Updates

The form can be updated dynamically:

```javascript
// Change context after initialization
paymentForm.setContext('ORDER', 'AFF-123');

// This will:
// 1. Update the context
// 2. Load new affiliate pricing
// 3. Re-render the form with appropriate line items
```

### Security Considerations

- Affiliate pricing is loaded from authenticated API endpoints
- System configuration is publicly accessible (read-only)
- Form validates that only visible items are included in total calculation
- Hidden items are not submitted with the form

### Next Steps

1. Test with different affiliate configurations
2. Verify line item filtering in production
3. Add support for custom service codes if needed
4. Implement dynamic pricing updates without page reload
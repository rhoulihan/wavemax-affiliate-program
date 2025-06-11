# Bag Fee Line Item Implementation

## Date: January 11, 2025

### Overview
Added BF (Bag Fee) as a permanent line item in the Paygistix payment form that is shown/hidden based on context rather than dynamically created.

### Changes Made:

1. **Added Bag Fee to Service List**
   - BF is now the first line item in the form (index 1)
   - Price is loaded from system configuration `laundry_bag_fee` setting
   - Default price: $10.00

2. **System Configuration**
   - Uses existing `laundry_bag_fee` system configuration
   - Located in payment category
   - Current value: $10.00

3. **Dynamic Pricing**
   - Bag fee price is loaded from `/api/v1/system/config/laundry_bag_fee`
   - Falls back to $10.00 if not configured

4. **Context Filtering**
   - **REGISTRATION context**: Only BF line item is visible
   - **ORDER context**: BF is hidden, WDF and delivery fees are visible

### Line Item Structure:

```javascript
{ code: 'BF', description: 'Bag Fee', price: bagFeePrice, index: 1 },
{ code: 'WDF', description: 'Wash Dry Fold Service', price: wdfPrice, index: 2 },
{ code: 'DF5', description: '$5 per bag delivery fee', price: 5.00, index: 3 },
// ... other delivery fees
```

### Usage:

1. **Bag fee is already configured in system**:
   - Key: `laundry_bag_fee`
   - Value: $10.00
   - No additional setup required

2. **For registration payments**:
   ```html
   <input type="hidden" id="PAYCONTEXT" value="REGISTRATION" />
   <!-- Only BF line item will be visible -->
   ```

3. **For order payments**:
   ```html
   <input type="hidden" id="PAYCONTEXT" value="ORDER" />
   <input type="hidden" id="AFFILIATEID" value="AFF-123" />
   <!-- BF will be hidden, WDF and delivery fees will be visible -->
   ```

### Key Benefits:

1. All line items are permanently in the form HTML
2. Show/hide is controlled via CSS display property
3. No dynamic creation/removal of form elements
4. Maintains consistent form structure for Paygistix
5. Bag fee price is centrally managed in system config
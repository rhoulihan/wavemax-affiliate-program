# Operator QR Code Scanning Workflow

## Overview

The WaveMAX Affiliate Program includes a comprehensive operator workflow for processing laundry orders using QR code scanning. This document details the three-stage scanning process that tracks bags from receiving through delivery.

## Hardware Requirements

- **QR Code Scanner**: Keyboard-based USB scanner (e.g., Amazon ASIN B0DNDNYJ53)
- **Computer/Tablet**: Any device with web browser and USB support
- **Internet Connection**: Required for real-time order updates

## Workflow Stages

### Stage 1: Receiving & Weighing (First Scan)

**Purpose**: Register incoming bags and capture weights for pricing

**Process**:
1. Customer arrives with laundry bags
2. Operator scans customer's QR card (contains Customer ID)
3. System displays order details and prompts for bag weights
4. Operator weighs each bag and enters weight
5. Click "Mark as In Progress" to begin processing
6. Order status changes to "processing"

**Key Points**:
- All bags for a customer use the SAME QR code
- Weight entry is required for accurate pricing
- Order is assigned to the operator who scans it

### Stage 2: After WDF Processing (Second Scan)

**Purpose**: Mark bags as processed after wash/dry/fold completion

**Process**:
1. After completing WDF process for customer's bags
2. Operator scans customer's QR card again
3. System automatically increments processed bag count
4. Repeat for each bag as it's completed
5. When all bags are processed:
   - Order status changes to "ready"
   - Affiliate receives email notification for pickup

**Key Points**:
- No weight entry required at this stage
- Scanning automatically marks bag as processed
- System tracks processed vs. total bag count

### Stage 3: Affiliate Pickup (Third Scan)

**Purpose**: Track bags as they're handed to affiliate for delivery

**Process**:
1. Affiliate arrives to pick up processed bags
2. Operator scans customer's QR card during handoff
3. System shows confirmation (auto-dismisses after 5 seconds)
4. Repeat for each bag being picked up
5. When all bags are picked up:
   - Order status changes to "complete"
   - Customer receives email notification

**Key Points**:
- Quick scan-and-go process
- Auto-dismiss prevents workflow interruption
- Real-time tracking of pickup progress

## User Interface

### Main Scanner Page (`/operator-scan-embed.html`)

The operator interface includes:

1. **Header**: Shows operator name and logout button
2. **Statistics Dashboard**:
   - Orders Today: Total orders processed
   - Bags Scanned: Total bags handled
   - Ready for Pickup: Orders awaiting affiliate

3. **Scan Prompt**:
   - Large, clear "Scan to Process Order" message
   - Hidden input field captures scanner data
   - Manual entry button for fallback

4. **Scan Type Guide**: Visual indicators showing the three stages

### Order Details Modal

When scanning brings up an order:
- Customer name and affiliate information
- Total bags and current progress
- Weight entry fields (Stage 1 only)
- Action buttons based on current stage

## Technical Details

### QR Code Format
- **Content**: Customer ID only (e.g., "CUST123456")
- **Generation**: Administrator dashboard creates printable cards
- **Sharing**: All bags for one customer use the same code

### API Endpoints

```javascript
// Scan customer card
POST /api/v1/operators/scan-customer
Body: { customerId: "CUST123456" }

// Submit bag weights (Stage 1)
POST /api/v1/operators/orders/:orderId/receive
Body: { 
  bagWeights: [
    { bagNumber: 1, weight: 15.5 },
    { bagNumber: 2, weight: 12.3 }
  ],
  totalWeight: 27.8
}

// Mark bag as processed (Stage 2)
POST /api/v1/operators/orders/:orderId/process-bag

// Confirm pickup (Stage 3)
POST /api/v1/operators/confirm-pickup
Body: { orderId: "ORD123456", numberOfBags: 1 }

// Get operator statistics
GET /api/v1/operators/stats/today
```

### Order Model Updates

```javascript
{
  // Bag tracking fields
  numberOfBags: Number,        // Total bags for order
  bagsWeighed: Number,        // Bags received and weighed
  bagsProcessed: Number,      // Bags completed WDF
  bagsPickedUp: Number,       // Bags picked up by affiliate
  
  // Weight tracking
  bagWeights: [{
    bagNumber: Number,
    weight: Number,
    receivedAt: Date
  }],
  
  // Status fields
  actualWeight: Number,       // Sum of all bag weights
  processingStartedAt: Date,  // When first bag was scanned
  processedAt: Date,         // When all bags were processed
  completedAt: Date          // When all bags were picked up
}
```

## Error Handling

### Common Issues and Solutions

1. **"Customer not found"**
   - Customer ID doesn't exist in system
   - Verify QR code is valid
   - Check if customer is registered

2. **"No active order"**
   - Customer has no scheduled pickup
   - Order may already be completed
   - Check order status in system

3. **Scanner not working**
   - Ensure scanner is plugged in
   - Try manual entry option
   - Check browser permissions

## Security & Audit

- All scan operations are logged with:
  - Operator ID and name
  - Timestamp
  - Action performed
  - Order/Customer details
  
- Operators can only:
  - View orders assigned to facility
  - Update order status through scanning
  - Cannot modify pricing or customer data

## Best Practices

1. **Always verify bag count** before starting Stage 1
2. **Weigh bags accurately** for proper pricing
3. **Scan each bag individually** in Stages 2 and 3
4. **Keep customer cards organized** by order status
5. **Use manual entry** only when scanner fails

## Training Resources

### Quick Reference Card
```
Stage 1 (Receiving):
- Scan → Enter weights → Mark as In Progress

Stage 2 (After WDF):
- Scan each processed bag → Auto-notifies affiliate

Stage 3 (Pickup):
- Scan during handoff → Auto-confirms pickup
```

### Common Workflows

**Multiple bags, same customer**:
1. Scan once in Stage 1, enter all weights
2. Scan once per bag in Stage 2
3. Scan once per bag in Stage 3

**Rush orders**:
- Process normally through all stages
- System automatically notifies affiliate when ready

**Damaged QR code**:
- Use "Enter ID Manually" button
- Type customer ID (e.g., CUST123456)
- Continue normal workflow

## Email Notifications

### To Affiliate (Stage 2 Complete)
- Subject: "Order Ready for Pickup - [Customer Name]"
- Contains order details and pickup instructions
- Sent when ALL bags are marked as processed

### To Customer (Stage 3 Complete)
- Subject: "Your Laundry Has Been Picked Up"
- Confirms order completion
- Sent when ALL bags are picked up by affiliate

## Troubleshooting

### Scanner Issues
1. **Scanner not recognized**:
   - Unplug and reconnect USB
   - Try different USB port
   - Restart browser

2. **Double scanning**:
   - Scanner may be set to add Enter key
   - Adjust scanner settings if needed

3. **Slow response**:
   - Check internet connection
   - Clear browser cache
   - Contact IT support

### System Issues
1. **Can't log in**:
   - Verify username/password
   - Check caps lock
   - Contact administrator

2. **Orders not showing**:
   - Refresh the page
   - Check order status filter
   - Verify facility assignment

3. **Email not sending**:
   - Confirm email addresses are correct
   - Check spam folders
   - System may have email queuing

## Support Contacts

- **Technical Support**: tech@wavemaxlaundry.com
- **Administrator**: Contact facility manager
- **Emergency**: Use manual order tracking as backup
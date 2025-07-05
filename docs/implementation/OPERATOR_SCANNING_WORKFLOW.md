# Operator QR Code Scanning Workflow

## Overview

The WaveMAX Affiliate Program includes a comprehensive operator workflow for processing laundry orders using QR code scanning. This document details the three-stage scanning process that tracks individual bags from receiving through delivery. Each bag has its own unique QR code for precise tracking throughout the process.

## Hardware Requirements

- **QR Code Scanner**: Keyboard-based USB scanner (e.g., Amazon ASIN B0DNDNYJ53)
- **Computer/Tablet**: Any device with web browser and USB support
- **Internet Connection**: Required for real-time order updates

## Workflow Stages

### Stage 1: Receiving & Weighing (First Scan)

**Purpose**: Register incoming bags and capture weights for pricing

**Process**:
1. Customer arrives with laundry bags
2. Operator scans each bag's unique QR code (format: customerId#bagId)
3. System displays order details and registers the specific bag
4. Operator weighs the bag and enters weight
5. Repeat for each additional bag
6. Click "Mark as In Progress" after all bags are scanned
7. Order status changes to "processing", individual bags show status "processing"

**Key Points**:
- Each bag has a UNIQUE QR code containing both customer ID and bag ID
- Bags are tracked individually throughout the entire process
- Weight entry is required for each bag for accurate pricing
- Order is assigned to the operator who scans it

### Stage 2: After WDF Processing (Second Scan)

**Purpose**: Mark individual bags as processed after wash/dry/fold completion

**Process**:
1. After completing WDF process for a specific bag
2. Operator scans the bag's unique QR code
3. System updates the specific bag's status to "processed"
4. Repeat for each bag as it's completed
5. When all bags are processed:
   - Order status changes to "ready"
   - Affiliate receives email notification for pickup

**Key Points**:
- No weight entry required at this stage
- Each bag is scanned individually when its WDF is complete
- Bag status changes from "processing" to "processed"
- System tracks processed vs. total bag count in real-time

### Stage 3: Affiliate Pickup (Third Scan)

**Purpose**: Track bags as they're handed to affiliate for delivery

**Process**:
1. Affiliate arrives to pick up processed bags
2. Operator clicks "Confirm Pickup" button to open pickup modal
3. Modal displays all bags for the order with their scan status
4. Operator scans each bag's QR code as it's handed to affiliate
5. System shows checkmark for each scanned bag
6. Once ALL bags are scanned, "Confirm Pickup" button becomes enabled
7. Click "Confirm Pickup" to complete the handoff
8. Order status changes to "complete" and bag statuses change to "completed"
9. Customer receives email notification

**Key Points**:
- Pickup modal requires ALL bags to be scanned before confirmation
- Each bag must be individually scanned during handoff
- Visual feedback shows which bags have been scanned
- Prevents partial pickups and ensures complete order delivery
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
- Individual bag status display (processing, processed, completed)
- Bag-specific details (ID, weight, status)
- Weight entry field for the scanned bag (Stage 1 only)
- Action buttons based on current stage

### Pickup Confirmation Modal

Displayed when confirming affiliate pickup:
- List of all bags for the order
- Visual indicators for scanned/unscanned bags
- Real-time scan status updates
- "Confirm Pickup" button (enabled only after all bags scanned)
- Cancel option to close without confirming

## Technical Details

### QR Code Format
- **Content**: Customer ID + Bag ID (format: "customerId#bagId", e.g., "CUST123456#BAG001")
- **Generation**: Administrator dashboard creates unique QR codes for each bag
- **Uniqueness**: Each bag has its own unique QR code for individual tracking
- **Components**:
  - Customer ID: Identifies the customer
  - Separator: "#" character
  - Bag ID: Unique identifier for each bag

### API Endpoints

```javascript
// Scan bag QR code
POST /api/v1/operators/scan-bag
Body: { qrCode: "CUST123456#BAG001" }

// Submit bag weight (Stage 1)
POST /api/v1/operators/bags/:bagId/receive
Body: { 
  weight: 15.5,
  customerId: "CUST123456",
  orderId: "ORD123456"
}

// Mark bag as processed (Stage 2)
POST /api/v1/operators/bags/:bagId/process
Body: {
  customerId: "CUST123456",
  orderId: "ORD123456"
}

// Scan bag for pickup (Stage 3)
POST /api/v1/operators/bags/:bagId/scan-pickup
Body: {
  customerId: "CUST123456",
  orderId: "ORD123456"
}

// Confirm all bags picked up (Stage 3)
POST /api/v1/operators/orders/:orderId/confirm-pickup
Body: { 
  scannedBagIds: ["BAG001", "BAG002", "BAG003"]
}

// Get operator statistics
GET /api/v1/operators/stats/today
```

### Order Model Updates

```javascript
{
  // Order-level tracking
  numberOfBags: Number,        // Total bags for order
  bagsWeighed: Number,        // Bags received and weighed
  bagsProcessed: Number,      // Bags completed WDF
  bagsPickedUp: Number,       // Bags picked up by affiliate
  
  // Individual bag tracking
  bags: [{
    bagId: String,            // Unique bag identifier
    status: String,           // 'pending', 'processing', 'processed', 'completed'
    weight: Number,           // Individual bag weight
    qrCode: String,           // Full QR code (customerId#bagId)
    receivedAt: Date,         // When bag was first scanned
    processedAt: Date,        // When bag completed WDF
    pickedUpAt: Date,         // When bag was picked up
    scannedForPickup: Boolean // Whether bag was scanned in pickup modal
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

1. **"Invalid QR code format"**
   - QR code doesn't match expected format (customerId#bagId)
   - Ensure using bag-specific QR codes, not old customer-only codes
   - Check for damaged or misprinted labels

2. **"Bag not found"**
   - Bag ID doesn't exist in system
   - May be scanning wrong order's bag
   - Verify bag belongs to current customer

3. **"Bag already processed"**
   - Attempting to scan bag in wrong stage
   - Bag may have already completed this stage
   - Check bag status in order details

4. **"Cannot confirm pickup - bags not scanned"**
   - Not all bags have been scanned in pickup modal
   - Review list to see which bags are missing
   - Locate and scan missing bags before confirming

5. **Scanner not working**
   - Ensure scanner is plugged in
   - Try manual entry option (customerId#bagId format)
   - Check browser permissions

## Security & Audit

- All scan operations are logged with:
  - Operator ID and name
  - Timestamp
  - Action performed
  - Specific bag ID scanned
  - Order/Customer details
  - Bag status transitions
  
- Operators can only:
  - View orders assigned to facility
  - Update bag status through scanning
  - Cannot modify pricing or customer data
  - Cannot skip bag scanning requirements

## Best Practices

1. **Always verify bag count** before starting Stage 1
2. **Scan and weigh each bag individually** for accurate tracking
3. **Never skip bag scanning** - each bag must be scanned at each stage
4. **Keep bags organized** by customer and status
5. **Use manual entry** only when scanner fails (format: customerId#bagId)
6. **Complete pickup scanning** - ensure all bags are scanned before confirming
7. **Track bag status** - monitor individual bag progress through the system

## Training Resources

### Quick Reference Card
```
Stage 1 (Receiving):
- Scan each bag → Enter weight → Repeat for all bags → Mark as In Progress

Stage 2 (After WDF):
- Scan each bag when WDF complete → Bag status: processed → Auto-notifies when all done

Stage 3 (Pickup):
- Click Confirm Pickup → Scan ALL bags in modal → Click Confirm → Order complete
```

### Common Workflows

**Multiple bags, same customer**:
1. Stage 1: Scan each bag individually, enter weight for each
2. Stage 2: Scan each bag as its WDF is completed
3. Stage 3: Open pickup modal, scan all bags, then confirm

**Rush orders**:
- Process each bag individually through all stages
- System automatically notifies affiliate when all bags ready
- Prioritize these bags in WDF process

**Damaged QR code**:
- Use "Enter ID Manually" button
- Type full QR code format: customerId#bagId
- Example: CUST123456#BAG001
- Continue normal workflow

**Partial bag processing**:
- System tracks each bag independently
- Some bags can be in "processing" while others are "processed"
- Order only marked "ready" when ALL bags are processed

## Email Notifications

### To Affiliate (Stage 2 Complete)
- Subject: "Order Ready for Pickup - [Customer Name]"
- Contains order details and number of bags
- Lists all bag IDs for verification
- Sent when ALL bags are marked as processed

### To Customer (Stage 3 Complete)
- Subject: "Your Laundry Has Been Picked Up"
- Confirms order completion with all bags accounted for
- Lists individual bag details
- Sent when ALL bags are confirmed picked up by affiliate

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

3. **Pickup modal issues**:
   - Ensure all bags show as "processed" first
   - Try closing and reopening modal
   - Check that all bags belong to same order

4. **Bag status not updating**:
   - Verify scanning correct bag
   - Check network connection
   - Refresh page and try again

5. **Email not sending**:
   - Confirm email addresses are correct
   - Check spam folders
   - System may have email queuing

## Support Contacts

- **Technical Support**: tech@wavemaxlaundry.com
- **Administrator**: Contact facility manager
- **Emergency**: Use manual order tracking as backup
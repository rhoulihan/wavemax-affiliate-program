# Paygistix Callback Pool System Guide

## Overview

The Callback Pool System is an innovative solution to track payments when Paygistix doesn't return custom fields in their callback responses. By dynamically assigning unique callback URLs to each payment session, we can identify which payment is being processed.

## Problem Statement

Paygistix hosted payment forms don't return custom fields (like payment tokens) in their callback, making it impossible to identify which specific payment transaction is being confirmed. The callback pool system solves this by:

1. Using a single Paygistix form that accepts dynamic callback URLs
2. Managing a pool of callback handler URLs
3. Dynamically assigning callback URLs to payment sessions
4. Using the callback URL to identify the payment

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Callback Pool System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐   ┌──────────────────┐   ┌───────────────┐ │
│  │ CallbackPool  │   │CallbackPoolManager│   │ PaymentToken  │ │
│  │   Database    │◄──│     Service       │──►│   Database    │ │
│  └───────────────┘   └──────────────────┘   └───────────────┘ │
│         │                     │                       │         │
│         └─────────────────────┴───────────────────────┘         │
│                               │                                 │
│                               ▼                                 │
│                    ┌─────────────────────┐                     │
│                    │   Dynamic Routes    │                     │
│                    │/callback/handler-1-10│                     │
│                    └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Callback Pool Configuration

Located in `server/config/paygistix-forms.json`:

```json
{
  "form": {
    "formId": "55015901455",
    "formHash": "c701523a33721cdbe999f7a4406a0a98"
  },
  "callbackPaths": [
    "/api/v1/payments/callback/handler-1",
    "/api/v1/payments/callback/handler-2",
    "/api/v1/payments/callback/handler-3",
    // ... up to handler-10
  ],
  "lockTimeoutMinutes": 10,
  "baseUrl": "https://wavemax.promo"
}
```

## Implementation Details

### 1. Callback Pool Model

```javascript
// server/models/CallbackPool.js
const callbackPoolSchema = new mongoose.Schema({
  callbackPath: {
    type: String,
    required: true,
    unique: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedBy: {
    type: String,
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  }
});

// Atomic callback acquisition
callbackPoolSchema.statics.acquireCallback = async function(paymentToken, lockTimeoutMinutes = 10) {
  const lockExpiredTime = new Date(Date.now() - lockTimeoutMinutes * 60 * 1000);
  
  const form = await this.findOneAndUpdate(
    {
      $or: [
        { isLocked: false },
        { isLocked: true, lockedAt: { $lt: lockExpiredTime } }
      ]
    },
    {
      $set: {
        isLocked: true,
        lockedBy: paymentToken,
        lockedAt: new Date(),
        lastUsedAt: new Date()
      },
      $inc: { usageCount: 1 }
    },
    {
      new: true,
      sort: { lastUsedAt: 1 } // Prefer least recently used
    }
  );
  
  return form;
};
```

### 2. Callback Pool Manager Service

```javascript
// server/services/callbackPoolManager.js
class CallbackPoolManager {
  constructor() {
    this.config = require('../config/paygistix-forms.json');
    this.baseUrl = this.config.baseUrl;
    this.lockTimeoutMinutes = this.config.lockTimeoutMinutes;
    this.formId = this.config.form.formId;
    this.formHash = this.config.form.formHash;
  }

  async initializePool() {
    for (const callbackPath of this.config.callbackPaths) {
      await CallbackPool.findOneAndUpdate(
        { callbackPath },
        {
          $setOnInsert: {
            callbackPath,
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            lastUsedAt: null,
            usageCount: 0
          }
        },
        { upsert: true, new: true }
      );
    }
    
    // Start cleanup job
    this.startCleanupJob();
  }

  async acquireForm(paymentToken) {
    const form = await FormPool.acquireForm(paymentToken, this.lockTimeoutMinutes);
    
    if (!form) {
      throw new Error('No forms available. All forms are currently in use.');
    }
    
    const callbackUrl = `${this.baseUrl}${form.callbackPath}`;
    
    return {
      formId: form.formId,
      formHash: form.formHash,
      callbackPath: form.callbackPath,
      callbackUrl: callbackUrl
    };
  }

  async releaseForm(paymentToken) {
    const form = await FormPool.findOneAndUpdate(
      { lockedBy: paymentToken },
      {
        $set: {
          isLocked: false,
          lockedBy: null,
          lockedAt: null
        }
      },
      { new: true }
    );
    
    return form;
  }

  startCleanupJob() {
    // Run every 5 minutes
    setInterval(async () => {
      try {
        const expiredTime = new Date(Date.now() - this.lockTimeoutMinutes * 60 * 1000);
        
        const result = await FormPool.updateMany(
          {
            isLocked: true,
            lockedAt: { $lt: expiredTime }
          },
          {
            $set: {
              isLocked: false,
              lockedBy: null,
              lockedAt: null
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          logger.info(`Released ${result.modifiedCount} expired form locks`);
        }
      } catch (error) {
        logger.error('Error in form pool cleanup job:', error);
      }
    }, 5 * 60 * 1000);
  }
}
```

### 3. Payment Token Integration

```javascript
// Updates to PaymentToken model
const paymentTokenSchema = new mongoose.Schema({
  // ... existing fields ...
  
  assignedFormId: {
    type: String,
    default: null,
    index: true
  },
  callbackPath: {
    type: String,
    default: null
  }
});
```

### 4. Dynamic Route Registration

```javascript
// server/routes/paymentRoutes.js
const formsConfig = require('../config/paygistix-forms.json');

// Register form-specific callback routes
formsConfig.forms.forEach(form => {
  const routePath = form.callbackPath.replace('/api/v1/payments', '');
  
  // Handle both GET and POST callbacks
  router.get(routePath, (req, res) => 
    paymentController.handleFormCallback(req, res, form.callbackPath)
  );
  
  router.post(routePath, (req, res) => 
    paymentController.handleFormCallback(req, res, form.callbackPath)
  );
});
```

### 5. Callback Handler

```javascript
// server/controllers/paymentController.js
exports.handleFormCallback = async (req, res, callbackPath) => {
  try {
    const { Result, PNRef, OrderID, Amount, AuthCode } = req.query;
    
    // Find payment token by callback path
    const paymentToken = await PaymentToken.findOne({
      callbackPath: callbackPath,
      status: 'pending'
    });
    
    if (!paymentToken) {
      logger.error('No pending payment found for callback path:', callbackPath);
      return res.redirect('/payment-error?message=Payment+not+found');
    }
    
    // Update payment status based on result
    const isSuccess = Result === '0';
    
    paymentToken.status = isSuccess ? 'completed' : 'failed';
    paymentToken.paygistixResponse = {
      result: Result,
      pnRef: PNRef,
      orderId: OrderID,
      amount: Amount,
      authCode: AuthCode
    };
    
    await paymentToken.save();
    
    // Release the form back to pool
    await formPoolManager.releaseForm(paymentToken.token);
    
    // Redirect to success/error page
    const redirectUrl = isSuccess 
      ? `/payment-success?token=${paymentToken.token}`
      : `/payment-error?message=Payment+declined`;
      
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error handling form callback:', error);
    res.redirect('/payment-error?message=Processing+error');
  }
};
```

## Payment Flow

### 1. Payment Initiation
```javascript
// Customer starts payment process
const paymentData = {
  amount: 1000, // $10.00
  customerData: { /* customer info */ }
};

// Create payment token and acquire form
const response = await fetch('/api/v1/payments/create-token', {
  method: 'POST',
  body: JSON.stringify(paymentData)
});

const { token, formConfig } = await response.json();
// formConfig contains: formId, formHash, callbackUrl
```

### 2. Form Submission
```javascript
// Dynamic form population
const paymentForm = document.createElement('form');
paymentForm.action = 'https://safepay.paymentlogistics.net/transaction.asp';
paymentForm.method = 'POST';

// Add form fields with assigned configuration
paymentForm.innerHTML = `
  <input type="hidden" name="merchantID" value="${merchantId}">
  <input type="hidden" name="formID" value="${formConfig.formId}">
  <input type="hidden" name="hash" value="${formConfig.formHash}">
  <input type="hidden" name="ReturnURL" value="${formConfig.callbackUrl}">
  <!-- payment details -->
`;

// Submit to payment window
paymentForm.submit();
```

### 3. Callback Processing
```
1. Paygistix redirects to: /api/v1/payments/callback/form-3?Result=0&PNRef=12345...
2. System identifies this is form-3's callback
3. Looks up PaymentToken with callbackPath = "/api/v1/payments/callback/form-3"
4. Updates payment status
5. Releases form-3 back to pool
6. Redirects user to success/error page
```

## Monitoring and Maintenance

### Form Pool Status
```javascript
// Get current pool status
async function getPoolStatus() {
  const forms = await FormPool.find({});
  
  return {
    total: forms.length,
    available: forms.filter(f => !f.isLocked).length,
    locked: forms.filter(f => f.isLocked).length,
    forms: forms.map(f => ({
      formId: f.formId,
      isLocked: f.isLocked,
      lockedBy: f.lockedBy,
      lockedAt: f.lockedAt,
      usageCount: f.usageCount
    }))
  };
}
```

### Cleanup Operations
```javascript
// Manual cleanup of stuck locks
async function cleanupStuckLocks() {
  const result = await FormPool.updateMany(
    { isLocked: true },
    {
      $set: {
        isLocked: false,
        lockedBy: null,
        lockedAt: null
      }
    }
  );
  
  return result.modifiedCount;
}
```

## Best Practices

1. **Form Count**: Start with 10 forms, monitor usage, and add more if needed
2. **Lock Timeout**: 10 minutes is reasonable for most payment flows
3. **Monitoring**: Track form usage patterns to optimize pool size
4. **Error Handling**: Always release forms on payment cancellation/error
5. **Testing**: Use the test payment form to verify callback routing

## Troubleshooting

### Common Issues

1. **"No forms available" Error**
   - Check if all forms are locked
   - Verify cleanup job is running
   - Consider increasing pool size

2. **Payment Not Found for Callback**
   - Check PaymentToken has correct callbackPath
   - Verify form assignment during token creation
   - Check for duplicate callback attempts

3. **Forms Not Releasing**
   - Ensure cleanup job is running
   - Check for errors in release logic
   - Manually release stuck forms if needed

### Debug Queries

```javascript
// Find stuck forms
db.formpools.find({ 
  isLocked: true, 
  lockedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } 
});

// Find orphaned payment tokens
db.paymenttokens.find({
  status: 'pending',
  createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }
});

// Check form usage distribution
db.formpools.aggregate([
  { $group: { _id: null, avgUsage: { $avg: "$usageCount" } } }
]);
```

## Migration Guide

### From Single Form to Form Pool

1. **Create Additional Forms in Paygistix**
   - Create 9 additional forms with identical settings
   - Note down formId and hash for each

2. **Update Configuration**
   - Create `paygistix-forms.json` with all form details
   - Remove single form env variables

3. **Deploy Changes**
   - Deploy FormPool model and manager
   - Run initialization to populate database
   - Update payment routes

4. **Test Thoroughly**
   - Use test payment form
   - Verify callbacks route correctly
   - Monitor form distribution

## Future Enhancements

1. **Dynamic Pool Sizing**: Automatically adjust pool size based on usage
2. **Form Health Monitoring**: Track success rates per form
3. **Priority Queue**: Implement priority-based form assignment
4. **Analytics Dashboard**: Visual monitoring of form pool metrics
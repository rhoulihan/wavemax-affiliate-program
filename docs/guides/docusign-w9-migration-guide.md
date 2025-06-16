# DocuSign W9 Migration Guide

## Overview
This guide provides step-by-step instructions for migrating from the manual W9 upload process to the DocuSign eSignature integration.

## Prerequisites

1. **DocuSign Developer Account**
   - Sign up at https://developers.docusign.com/
   - Create an integration key (Client ID)
   - Generate RSA keypair for JWT authentication

2. **W9 Template Setup in DocuSign**
   - Log into DocuSign
   - Create a new template named "W9 Tax Form"
   - Upload the IRS W9 PDF
   - Add fields:
     - Text fields: Name, BusinessName, Address, City, State, ZipCode
     - SSN field: SSN (masked)
     - Text field: EIN (for businesses)
     - Checkbox fields: Tax classification options
     - Signature field: Taxpayer signature
     - Date field: Signature date

## Backend Migration Steps

### 1. Update Environment Variables
Add the following to your `.env` file:
```env
# DocuSign Configuration
DOCUSIGN_INTEGRATION_KEY=your_actual_integration_key
DOCUSIGN_USER_ID=your_user_id
DOCUSIGN_ACCOUNT_ID=your_account_id
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi  # Use https://na4.docusign.net/restapi for production
DOCUSIGN_OAUTH_BASE_URL=https://account-d.docusign.com  # Use https://account.docusign.com for production
DOCUSIGN_W9_TEMPLATE_ID=your_w9_template_id
DOCUSIGN_WEBHOOK_SECRET=generate_a_secure_random_string
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
your_private_key_here
-----END RSA PRIVATE KEY-----"
DOCUSIGN_REDIRECT_URI=https://yourdomain.com/affiliate/dashboard?tab=settings
```

### 2. Install Required Dependencies
```bash
npm install jsonwebtoken
```

### 3. Update Affiliate Model
Add DocuSign fields to the W9 information schema:
```javascript
// In /server/models/Affiliate.js
w9Information: {
  // ... existing fields ...
  docusignEnvelopeId: String,
  docusignStatus: {
    type: String,
    enum: ['sent', 'delivered', 'completed', 'declined', 'voided']
  },
  completedAt: Date
}
```

### 4. Update W9 Routes
Replace or add new routes in `/server/routes/w9Routes.js`:
```javascript
// Add new DocuSign routes
router.post('/initiate-signing', authenticate, authorize(['affiliate']), w9Controller.initiateW9Signing);
router.post('/webhook/docusign', w9Controller.handleDocuSignWebhook);
router.post('/cancel-signing', authenticate, authorize(['affiliate']), w9Controller.cancelW9Signing);

// Admin routes
router.post('/admin/:affiliateId/resend', authenticate, authorize(['administrator']), w9Controller.resendW9Request);
```

### 5. Implement Controller Methods
Copy the methods from `w9ControllerDocuSign.js` to your main `w9Controller.js` or import them.

### 6. Deploy DocuSign Service
Copy `docusignService.js` to your services directory.

## Frontend Migration Steps

### 1. Include DocuSign Integration Script
Add to `affiliate-dashboard-embed.html`:
```html
<script src="/assets/js/docusign-w9-integration.js"></script>
```

### 2. Update Page Scripts Configuration
In `embed-app.html`, add the DocuSign script to the affiliate dashboard:
```javascript
const pageScripts = {
  '/affiliate-dashboard': [
    // ... existing scripts ...
    '/assets/js/docusign-w9-integration.js'
  ]
};
```

### 3. Initialize DocuSign Integration
In `affiliate-dashboard-init.js`, add initialization:
```javascript
// In the DOMContentLoaded event
if (window.docuSignW9) {
  window.docuSignW9.initialize();
}

// Update loadW9Status function to handle DocuSign status
async function loadW9Status() {
  // ... existing code ...
  
  // Add DocuSign status handling
  if (window.docuSignW9 && data.docusignStatus) {
    window.docuSignW9.updateStatus(data);
  }
}
```

### 4. Add Translations
Update translation files to include DocuSign-specific messages:
```json
{
  "affiliate": {
    "dashboard": {
      "settings": {
        "completeW9WithDocuSign": "Complete W9 Form with DocuSign",
        "signingInProgress": "W9 signing in progress...",
        "resumeW9Signing": "Resume W9 Signing",
        "docusignHelp": "Click the button above to securely complete your W9 form using DocuSign's e-signature platform.",
        "w9SigningComplete": "Your W9 form has been signed successfully!",
        "w9SigningCancelled": "W9 signing was cancelled.",
        "docusignSent": "W9 form sent - awaiting signature",
        "docusignDelivered": "W9 form opened - in progress",
        "docusignCompleted": "W9 form signed - under review"
      }
    }
  }
}
```

## Testing the Integration

### 1. Test in Development
1. Use DocuSign demo/sandbox environment
2. Create test affiliate account
3. Click "Complete W9 Form with DocuSign"
4. Verify redirect to DocuSign
5. Complete form and sign
6. Verify return to dashboard
7. Check W9 status update

### 2. Webhook Testing
1. Use ngrok or similar for local webhook testing:
   ```bash
   ngrok http 3000
   ```
2. Update DocuSign webhook URL to ngrok URL
3. Monitor webhook events in logs

### 3. Test Scenarios
- [ ] New affiliate completes W9
- [ ] Affiliate cancels signing
- [ ] Affiliate declines to sign
- [ ] Session timeout handling
- [ ] Resume incomplete signing
- [ ] Admin resends W9 request
- [ ] Multiple browser/device signing

## Production Deployment

### 1. DocuSign Production Setup
1. Request production approval from DocuSign
2. Update environment URLs:
   - Base URL: `https://na4.docusign.net/restapi`
   - OAuth URL: `https://account.docusign.com`
3. Create production template
4. Update template ID in environment

### 2. Security Checklist
- [ ] RSA private key stored securely
- [ ] Webhook secret is strong and unique
- [ ] HTTPS enforced for all callbacks
- [ ] Webhook signature verification enabled
- [ ] Error messages don't expose sensitive data

### 3. Monitoring
- Set up alerts for:
  - Failed webhook deliveries
  - Authentication failures
  - Envelope creation errors
  - Signature declines

## Rollback Plan

If issues arise, you can temporarily rollback:

1. **Quick Toggle** (Recommended)
   Add environment variable:
   ```env
   ENABLE_DOCUSIGN_W9=false
   ```
   
   Check in code:
   ```javascript
   if (process.env.ENABLE_DOCUSIGN_W9 === 'true') {
     // Use DocuSign
   } else {
     // Use manual upload
   }
   ```

2. **Full Rollback**
   - Keep original upload code in place
   - Switch routes back to original handlers
   - Revert frontend changes

## Common Issues and Solutions

### Issue: "Invalid grant" error
**Solution**: Check JWT token expiration and clock sync

### Issue: Webhook not received
**Solution**: 
- Verify webhook URL is publicly accessible
- Check DocuSign Connect logs
- Ensure webhook secret matches

### Issue: Template fields not populating
**Solution**: Verify field labels match exactly in template and code

### Issue: User can't sign
**Solution**: Check clientUserId matches between envelope creation and signing URL

## Support Resources

- DocuSign API Documentation: https://developers.docusign.com/
- DocuSign Support: https://support.docusign.com/
- API Explorer: https://apiexplorer.docusign.com/
- Connect Webhook Logs: Available in DocuSign Admin

## Next Steps

1. **Phase 1**: Deploy to staging environment
2. **Phase 2**: Limited beta with volunteer affiliates
3. **Phase 3**: Gradual rollout to all affiliates
4. **Phase 4**: Deprecate manual upload (keep for fallback)

## Success Metrics to Track

- W9 completion rate (before vs after)
- Time to completion (upload to verification)
- Support tickets related to W9
- Failed submission rate
- Mobile vs desktop completion rates
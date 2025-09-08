# Paygistix Forms Configuration

This file (`paygistix-forms.json`) is the single source of truth for all Paygistix payment configuration.

## Configuration Structure

```json
{
  "merchantId": "wmaxaustWEB",           // Merchant ID provided by Paygistix
  "form": {
    "formId": "55810301384",             // Form ID from Paygistix
    "formHash": "d94a62458f81836031..."  // Security hash for form validation
  },
  "formActionUrl": "https://safepay...", // Paygistix form submission URL
  "callbackPaths": [...],                // Available callback handlers for payment responses
  "lockTimeoutMinutes": 10,              // Timeout for callback handler locks
  "baseUrl": "https://wavemax.promo"     // Base URL for building callback URLs
}
```

## Important Notes

1. **No Environment Variables**: All Paygistix configuration should be in this JSON file, not in `.env`
2. **Form Hash Security**: The form hash is a security token - keep it confidential
3. **Callback Pool**: The system manages a pool of callback handlers to handle concurrent payments
4. **Single Source of Truth**: This file is used by:
   - `paygistix.config.js` - Main configuration loader
   - `callbackPoolManager.js` - Callback URL management
   - Payment processing endpoints

## Updating Configuration

When you need to update the Paygistix form (e.g., new form ID or hash):

1. Edit `paygistix-forms.json` with the new values
2. Restart the application: `pm2 restart wavemax`
3. Test a payment to ensure the new configuration works

## Form Details from Paygistix

The current form configuration matches the following Paygistix form:
- Supports various delivery fee structures (MDF10-MDF50)
- Supports per-bag fees (PBF5-PBF25)
- Supports Wash/Dry/Fold services (WDF with add-ons)

Last updated: 2025-01-06
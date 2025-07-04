# Quarantined Payment Pages

**Date Quarantined:** 2025-01-18
**Reason:** These payment pages are not mapped in embed-app.html or embed-app-v2.html and appear to be unused in the current application flow.

## Quarantined Files

### 1. payment-form-embed.html
- **Original Location:** `/public/payment-form-embed.html`
- **CSP Status:** Not compliant (1 inline style block, 2 inline scripts)
- **Description:** Standalone payment form page
- **Dependencies:** 
  - `/assets/js/payment-form.js`
  - `/assets/js/payment-validation.js`
  - `/assets/js/payment-service.js`
  - `/assets/css/payment-styles.css`

### 2. payment-methods-embed.html
- **Original Location:** `/public/payment-methods-embed.html`
- **CSP Status:** Unknown (not analyzed)
- **Description:** Payment methods selection page
- **Dependencies:** Unknown

## Current Payment Implementation

The application currently uses:
- `paygistix-payment-form-v2.js` for payment processing in customer registration and order scheduling
- `payment-success-embed.html` (CSP compliant)
- `payment-error-embed.html` (CSP compliant)

## Restoration Instructions

If these pages are needed in the future:

```bash
# Restore payment-form-embed.html
cp /var/www/wavemax/wavemax-affiliate-program/quarantine/unused-payment-pages/payment-form-embed.html /var/www/wavemax/wavemax-affiliate-program/public/

# Restore payment-methods-embed.html
cp /var/www/wavemax/wavemax-affiliate-program/quarantine/unused-payment-pages/payment-methods-embed.html /var/www/wavemax/wavemax-affiliate-program/public/
```

## Notes
- These pages were quarantined during CSP v2 migration efforts
- They appear to be legacy or test pages not used in the current customer flow
- If restored, they will need CSP v2 migration before use
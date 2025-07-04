# Quarantined PayGistix Pages

**Date Quarantined:** 2025-01-18  
**Reason:** These PayGistix pages are not mapped in embed-app.html or embed-app-v2.html and appear to be unused in the current application flow.

## Quarantined Files

### 1. paygistix-order-payment.html
- **Original Location:** `/public/paygistix-order-payment.html`
- **CSP Status:** Not compliant (2 inline styles, 1 event handler)
- **Description:** PayGistix order payment processing page
- **Dependencies:** 
  - `/assets/css/wavemax-embed.css`
  - PayGistix payment integration scripts

### 2. paygistix-payment-embed.html
- **Original Location:** `/public/paygistix-payment-embed.html`
- **CSP Status:** Not compliant (1 inline style, 1 event handler)
- **Description:** PayGistix embedded payment form
- **Dependencies:** 
  - `/assets/css/wavemax-embed.css`
  - PayGistix payment integration scripts

## Current PayGistix Implementation

The application currently uses:
- `paygistix-payment-form-v2.js` for payment processing in customer registration and order scheduling
- PayGistix integration is handled through the main customer flows, not these standalone pages
- Payment success/error handling is done via `payment-success-embed.html` and `payment-error-embed.html`

## Restoration Instructions

If these pages are needed in the future:

```bash
# Restore paygistix-order-payment.html
cp /var/www/wavemax/wavemax-affiliate-program/quarantine/unused-paygistix-pages/paygistix-order-payment.html /var/www/wavemax/wavemax-affiliate-program/public/

# Restore paygistix-payment-embed.html
cp /var/www/wavemax/wavemax-affiliate-program/quarantine/unused-paygistix-pages/paygistix-payment-embed.html /var/www/wavemax/wavemax-affiliate-program/public/
```

## Notes
- These pages were quarantined during CSP v2 migration efforts
- They are not mapped in the current application routing (embed-app.html or embed-app-v2.html)
- PayGistix payment processing is currently handled through the integrated customer registration and scheduling flows
- If restored, they will need CSP v2 migration before use
- Consider whether these standalone payment pages are still needed given the current integrated payment flow architecture
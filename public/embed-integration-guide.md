# WaveMAX Embed Integration Guide

## Overview

This guide explains how to integrate WaveMAX embedded pages into your website using iframes and postMessage communication.

## Available Embedded Pages

1. **affiliate-login-embed.html** - Affiliate partner login
2. **customer-register-embed.html** - Customer registration form
3. **customer-login-embed.html** - Customer login
4. **schedule-pickup-embed.html** - Schedule laundry pickup
5. **affiliate-dashboard-embed.html** - Affiliate management dashboard
6. **customer-dashboard-embed.html** - Customer account dashboard
7. **order-confirmation-embed.html** - Order confirmation details
8. **affiliate-success-embed.html** - Affiliate registration success
9. **customer-success-embed.html** - Customer registration success

## Basic Integration

### 1. Embed an iframe

```html
<iframe 
    id="wavemaxEmbed" 
    src="https://wavemax.promo/affiliate-login-embed.html"
    width="100%"
    height="800"
    frameborder="0">
</iframe>
```

### 2. Handle postMessage Communication

```javascript
window.addEventListener('message', function(event) {
    // Verify the origin for security
    if (event.origin !== 'https://wavemax.promo') return;
    
    if (event.data && event.data.source === 'wavemax-embed') {
        const { type, data } = event.data;
        
        // Handle different message types
        switch (type) {
            case 'navigate':
                handleNavigation(data.page);
                break;
            case 'login-success':
                handleLoginSuccess(data);
                break;
            // ... handle other message types
        }
    }
});
```

## Message Types

### Navigation Messages

**Type:** `navigate`
**Data:** `{ page: string }`
**Description:** Request to navigate to another page

### Authentication Messages

**Type:** `login-success`
**Data:** `{ userType: 'affiliate'|'customer', affiliateId/customerId: string }`
**Description:** User successfully logged in

**Type:** `logout`
**Data:** `{ userType: 'affiliate'|'customer' }`
**Description:** User logged out

### Form Submission Messages

**Type:** `form-submit`
**Data:** `{ form: string }`
**Description:** Form was submitted

**Type:** `registration-success`
**Data:** `{ userType: string, customerId/affiliateId: string }`
**Description:** Registration completed successfully

### Order Messages

**Type:** `order-created`
**Data:** `{ orderId: string, customerId: string, affiliateId: string }`
**Description:** New order was created

**Type:** `order-viewed`
**Data:** `{ orderId: string, status: string }`
**Description:** Order details were viewed

### Error Messages

**Type:** `login-error`, `registration-error`, `order-error`
**Data:** `{ message: string }`
**Description:** Various error conditions

### Status Messages

**Type:** `iframe-loaded`
**Data:** `{ page: string }`
**Description:** Iframe finished loading

## URL Parameters

Some pages accept URL parameters:

- **customer-register-embed.html?affid=AFFILIATE_ID** - Pre-fill affiliate referral
- **order-confirmation-embed.html?orderId=ORDER_ID** - Show specific order

## Security Considerations

1. **Always verify the origin** of postMessage events
2. **Use HTTPS** for all embedded pages
3. **Validate all data** received from postMessages
4. **Implement CSRF protection** on your server

## Example Implementation

See `embed-demo.html` for a complete working example of parent window implementation.

## Styling Considerations

The embedded pages use:
- Tailwind CSS for styling
- Minimal, iframe-friendly layouts
- No fixed headers/footers
- Transparent backgrounds
- Responsive design

## API Integration

All API calls use the base URL: `https://wavemax.promo/api/v1/`

The embedded pages handle:
- Authentication tokens in localStorage
- CORS headers
- Error handling
- Loading states

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6 JavaScript support required
- localStorage support required

## Testing

Use the provided `embed-demo.html` to test integration and message handling in your development environment.
# WaveMAX Embed Integration Guide

## Overview

This guide explains how to integrate WaveMAX embedded pages into your website using iframes and postMessage communication.

## Available Embedded Pages

1. **embed-app.html** - Main application (single entry point for all pages)
2. **affiliate-landing-embed.html** - Affiliate landing page with service information
3. **affiliate-login-embed.html** - Affiliate partner login
4. **customer-register-embed.html** - Customer registration form
5. **customer-login-embed.html** - Customer login
6. **schedule-pickup-embed.html** - Schedule laundry pickup
7. **affiliate-dashboard-embed.html** - Affiliate management dashboard
8. **customer-dashboard-embed.html** - Customer account dashboard
9. **order-confirmation-embed.html** - Order confirmation details
10. **affiliate-success-embed.html** - Affiliate registration success
11. **customer-success-embed.html** - Customer registration success

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

- **https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=AFFILIATE_ID** - Affiliate customer registration link (requires embed code on wavemaxlaundry.com)
- **order-confirmation-embed.html?orderId=ORDER_ID** - Show specific order

## Security Considerations

1. **Always verify the origin** of postMessage events
2. **Use HTTPS** for all embedded pages
3. **Validate all data** received from postMessages
4. **Implement CSRF protection** on your server

## Example Implementation

See `embed-demo.html` for a complete working example of parent window implementation.

## Mobile Integration

### Parent-Iframe Bridge Script

To enable mobile-responsive features and automatic chrome hiding, include the parent-iframe bridge script:

```html
<script src="https://wavemax.promo/assets/js/parent-iframe-bridge-complete-inline.js"></script>
```

This script provides:
- **Automatic mobile detection** - Detects viewport size and device type
- **Chrome hiding** - Automatically hides parent page header/footer on mobile
- **Viewport communication** - Sends viewport info to iframe for responsive behavior
- **Full-width support** - Removes container padding for affiliate landing pages
- **Height management** - Automatic iframe resizing based on content

### Mobile Features

1. **Automatic Chrome Hiding**: On mobile devices (<768px), the parent page's header and footer are automatically hidden to maximize screen space
2. **Responsive Layouts**: All embedded pages are fully mobile-responsive
3. **Touch-Friendly**: Buttons and interactive elements are sized for touch
4. **Full-Width Landing Pages**: Affiliate landing pages display edge-to-edge with no padding

### Message Types for Mobile

**Type:** `viewport-info`
**Data:** `{ width, height, isMobile, isTablet, isDesktop, hasTouch, orientation }`
**Description:** Parent sends viewport information to iframe

**Type:** `hide-chrome`
**Data:** `{}`
**Description:** Iframe requests parent to hide header/footer (mobile only)

**Type:** `show-chrome`
**Data:** `{}`
**Description:** Iframe requests parent to show header/footer

## Styling Considerations

The embedded pages use:
- Bootstrap 5 for responsive styling
- Mobile-first design approach
- No fixed headers/footers
- Transparent backgrounds
- Responsive typography and spacing
- Touch-optimized controls

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
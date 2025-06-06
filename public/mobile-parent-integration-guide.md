# Mobile Parent Page Integration Guide

This guide explains how to integrate the mobile-friendly features on your parent page that hosts the WaveMAX affiliate program iframe.

## Quick Start

Add the following script tag to your parent page (wavemaxlaundry.com):

```html
<script src="https://affiliate.wavemax.promo/assets/js/parent-iframe-bridge.js"></script>
```

That's it! The script will automatically:
- Detect mobile devices and viewport sizes
- Handle communication with the iframe
- Hide/show headers and footers on mobile when requested
- Manage smooth transitions and scrolling

## How It Works

### 1. Automatic Detection
The bridge script automatically finds your WaveMAX iframe by looking for:
- `iframe[src*="affiliate.wavemax.promo"]`
- `iframe#wavemax-affiliate-iframe`

### 2. Mobile Viewport Detection
- **Mobile**: < 768px width
- **Tablet**: 768px - 1024px width  
- **Desktop**: > 1024px width

### 3. Communication Protocol
The iframe and parent communicate using postMessage API with these message types:

#### From Parent to Iframe:
- `viewport-info`: Sends device and viewport information
- `chrome-hidden`: Notifies when header/footer visibility changes

#### From Iframe to Parent:
- `hide-chrome`: Request to hide header/footer (mobile only)
- `show-chrome`: Request to show header/footer
- `resize`: Updates iframe height (existing functionality)
- `scroll-to-top`: Smooth scroll to top of page

### 4. Header/Footer Management
On mobile devices, the iframe can request to hide the parent page's header and footer for a full-screen experience. The script handles this by:

1. Finding elements with these selectors:
   - Header: `header, .header, #header, .navbar`
   - Footer: `footer, .footer, #footer`

2. Applying smooth CSS transitions:
   - Header slides up out of view
   - Footer slides down out of view
   - Iframe expands to full viewport height

## Advanced Configuration

### Custom Header/Footer Selectors
If your header/footer use different selectors, you can modify the script:

```javascript
// In parent-iframe-bridge.js, update the hideChrome function:
const header = document.querySelector('.your-custom-header-class');
const footer = document.querySelector('.your-custom-footer-class');
```

### Allowed Origins
For security, update the allowed origins list in the script:

```javascript
const ALLOWED_ORIGINS = [
    'https://affiliate.wavemax.promo',
    'https://your-staging-domain.com'
];
```

### Custom Styling
Add these CSS classes to your parent page for custom transitions:

```css
/* Custom hide animations */
[data-mobile-hidden="true"] {
    opacity: 0;
    pointer-events: none;
}

/* Custom iframe container styling */
.iframe-container {
    transition: all 0.3s ease-in-out;
}
```

## Testing

### Desktop Browser Testing
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select a mobile device preset
4. Refresh the page
5. Navigate through the iframe app

### Real Device Testing
1. Open the page on a mobile device
2. The landing page should automatically hide headers/footers
3. Navigate to login/register pages - headers should reappear
4. Go to dashboards - headers should hide again

### Debug Mode
Add `?debug=true` to your URL to see console logs:
```
https://www.wavemaxlaundry.com/affiliate-program?debug=true
```

## Troubleshooting

### Headers/Footers Not Hiding
1. Check that the script is loaded
2. Verify header/footer selectors match your HTML
3. Ensure you're testing on a mobile viewport (<768px)
4. Check browser console for errors

### Iframe Not Resizing
1. Verify the iframe has an ID or identifiable src
2. Check that cross-origin communication is allowed
3. Ensure no CSS is constraining iframe height

### Communication Errors
1. Check that origins match in both scripts
2. Verify no Content Security Policy blocks postMessage
3. Look for errors in both parent and iframe consoles

## Example Implementation

Here's a complete example of a parent page:

```html
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WaveMAX Affiliate Program</title>
    <style>
        .header { 
            background: #333; 
            color: white; 
            padding: 20px;
            position: relative;
            z-index: 100;
        }
        .footer { 
            background: #333; 
            color: white; 
            padding: 20px;
            position: relative;
            z-index: 100;
        }
        .iframe-wrapper {
            width: 100%;
            position: relative;
        }
        iframe {
            width: 100%;
            border: none;
            display: block;
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>WaveMAX Laundry</h1>
        <nav>Navigation Menu</nav>
    </header>
    
    <div class="iframe-wrapper">
        <iframe 
            id="wavemax-affiliate-iframe"
            src="https://affiliate.wavemax.promo/embed-app.html"
            width="100%"
            height="800">
        </iframe>
    </div>
    
    <footer class="footer">
        <p>&copy; 2025 CRHS Enterprises, LLC. All rights reserved.</p>
    </footer>
    
    <!-- Add the bridge script -->
    <script src="https://affiliate.wavemax.promo/assets/js/parent-iframe-bridge.js"></script>
</body>
</html>
```

## Browser Support

- Chrome/Edge: Full support
- Safari/iOS: Full support with -webkit prefixes
- Firefox: Full support
- Internet Explorer: Not supported

## Security Considerations

1. The script validates message origins to prevent XSS
2. Only responds to messages from allowed domains
3. Does not execute arbitrary code from messages
4. Header/footer hiding only works on mobile viewports

## Performance

- Script size: ~5KB minified
- No external dependencies
- Debounced resize events
- Smooth CSS transitions
- Minimal CPU usage

## Future Enhancements

Planned features for future versions:
- Gesture support (swipe to show/hide chrome)
- Progressive Web App (PWA) integration
- Offline support
- Advanced animation options
- Customizable breakpoints

## Support

For issues or questions:
- Check the browser console for error messages
- Review this guide for common solutions
- Contact support with console logs and device info
# WaveMAX Iframe Bridge Usage Guide

The WaveMAX Iframe Bridge provides seamless integration between the WaveMAX application and parent pages, especially for mobile responsiveness and chrome management.

## Features

1. **Automatic Chrome Hiding** - Hides parent page elements (header, footer, navigation) on mobile devices
2. **Dynamic Height Adjustment** - Automatically resizes iframe based on content
3. **Viewport Information Sharing** - Shares device information with embedded app
4. **Cross-domain Communication** - Secure message passing between parent and iframe

## Installation

### Method 1: Manual Initialization

Include the script in your parent page:

```html
<script src="https://wavemax.promo/assets/js/iframe-bridge.js"></script>
```

Then initialize it:

```html
<iframe id="wavemax-app" src="https://wavemax.promo/embed-app-v2.html"></iframe>

<script>
document.addEventListener('DOMContentLoaded', function() {
    WaveMaxIframeBridge.init('#wavemax-app', {
        chromeSelectors: [
            'header',
            'footer',
            '.navigation',
            '.sidebar'
        ]
    });
});
</script>
```

### Method 2: Auto-initialization

Add data attributes to your iframe:

```html
<iframe 
    data-wavemax-iframe
    data-chrome-selectors="header,footer,.navigation,.sidebar"
    src="https://wavemax.promo/embed-app-v2.html">
</iframe>

<script src="https://wavemax.promo/assets/js/iframe-bridge.js"></script>
```

## Configuration Options

- `chromeSelectors`: Array of CSS selectors for elements to hide on mobile
  - Default: Common selectors like `header`, `footer`, `nav`, `.sidebar`

## API Methods

### `WaveMaxIframeBridge.init(selector, options)`
Initialize the bridge with a specific iframe.

### `WaveMaxIframeBridge.hideChrome()`
Manually hide parent page chrome elements.

### `WaveMaxIframeBridge.showChrome()`
Manually show parent page chrome elements.

### `WaveMaxIframeBridge.sendMessage(type, data)`
Send a custom message to the iframe.

## Behavior

### Mobile Detection
- Chrome is automatically hidden when viewport width ≤ 1024px
- Chrome is automatically shown when viewport width > 1024px
- Handles orientation changes and window resizing

### Height Management
- Iframe height automatically adjusts to content
- Minimum height of 400px is enforced for very small content

### Styling
The bridge adds these CSS classes to the parent page body:
- `wavemax-chrome-hidden` - When chrome elements are hidden

## Example WordPress Integration

```php
function add_wavemax_iframe() {
    ?>
    <div class="wavemax-container">
        <iframe 
            id="wavemax-app"
            data-wavemax-iframe
            data-chrome-selectors="#masthead,#colophon,.site-header,.site-footer"
            src="https://wavemax.promo/embed-app-v2.html?route=/affiliate-landing"
            style="width: 100%; border: none; min-height: 600px;">
        </iframe>
    </div>
    
    <script src="https://wavemax.promo/assets/js/iframe-bridge.js"></script>
    <?php
}
add_shortcode('wavemax_app', 'add_wavemax_iframe');
```

## Custom Styling

Add custom CSS to your parent page:

```css
/* When chrome is hidden */
body.wavemax-chrome-hidden {
    padding: 0;
    margin: 0;
}

/* Iframe container */
.wavemax-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
}

/* Mobile adjustments */
@media (max-width: 1024px) {
    .wavemax-container {
        padding: 0;
        max-width: 100%;
    }
}
```

## Security

The bridge only accepts messages from trusted origins:
- https://wavemax.promo
- https://www.wavemax.promo
- http://localhost:3000 (development)
- http://127.0.0.1:3000 (development)

## Troubleshooting

1. **Chrome not hiding**: Check that your chrome selectors match the actual elements
2. **Height not adjusting**: Ensure the iframe has no height constraints in CSS
3. **Console errors**: Check browser console for origin verification failures

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 12+)
- Mobile browsers: Optimized for all modern mobile browsers
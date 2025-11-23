# WaveMAX Content Embedding Integration Guide

This guide explains how to embed WaveMAX content from wavemax.promo into wavemaxlaundry.com pages, following the same pattern used for the affiliate program.

## Overview

Instead of replacing entire pages with iframes, this integration embeds only the main content area between the existing header and footer on wavemaxlaundry.com. The parent site maintains its header, navigation, and footer while the embedded content provides the page-specific information.

## Architecture

```
wavemaxlaundry.com Page Structure:
┌─────────────────────────────────┐
│ Header / Navigation (Parent)    │ ← Served by wavemaxlaundry.com
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Embedded Content (iframe)   │ │ ← Served by wavemax.promo
│ │ - Hero Section              │ │
│ │ - Services/Features         │ │
│ │ - Pricing/Process           │ │
│ │ - CTA Sections              │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Footer (Parent)                  │ ← Served by wavemaxlaundry.com
└─────────────────────────────────┘
```

## Files Created

### 1. `/public/site-page-content-only.html`
Content-only template with hero section, dynamic content area, and bottom CTA. No header or footer.

**Features:**
- Responsive hero section with gradient background
- Dynamic content loading from JSON
- Feature cards, pricing tables, process steps
- Auto-resize communication with parent
- Navigation link handling (redirects parent window)

### 2. `/public/content/site-pages.json`
Centralized content storage for all pages.

**Structure:**
```json
{
  "home": {
    "title": "Page Title",
    "metaDescription": "SEO description",
    "hero": {
      "heading": "Main Heading",
      "subheading": "Subheading text",
      "ctaText": "Button Text",
      "ctaLink": "#"
    },
    "services": [...],
    "features": [...],
    "pricing": {...},
    "process": [...]
  }
}
```

### 3. `/docs/parent-iframe-bridge.js`
Generic parent-iframe communication script.

**Features:**
- Auto-resize iframe based on content height
- Viewport information sharing
- Navigation handling
- Origin validation for security
- Chrome hide/show support
- Extensible message system

### 4. `/docs/EMBED_CODE_SNIPPETS.html`
Ready-to-use HTML snippets for each page.

Contains:
- Inline bridge script (minified)
- Iframe embed code for each route
- Integration notes and examples

### 5. `/public/assets/js/embed-app-v2.js` (Updated)
Router updated to use content-only template for website pages.

## Integration Steps

### Step 1: Include Bridge Script

Add the bridge script **once** to your page template (header or footer):

```html
<script src="https://wavemax.promo/docs/parent-iframe-bridge.js"></script>
```

Or use the inline minified version from `EMBED_CODE_SNIPPETS.html`.

### Step 2: Embed Content in Page

In the main content area of your page, add:

```html
<div id="wavemax-content-container" style="width: 100%; min-height: 600px;">
    <iframe
        width="100%"
        height="800"
        style="border: none;"
        id="wavemax-iframe"
        data-route="/home"
        frameborder="0">
    </iframe>
</div>
```

Replace `/home` with the appropriate route for each page.

### Step 3: Verify Content

Visit the embedded page and verify:
- Content loads properly
- Height adjusts automatically
- Links work correctly
- Mobile responsive

## Available Routes

| Page | Route | URL |
|------|-------|-----|
| Home | `/home` | `/austin-tx/` |
| Self-Serve Laundry | `/self-serve-laundry` | `/austin-tx/self-serve-laundry/` |
| Wash-Dry-Fold | `/wash-dry-fold` | `/austin-tx/wash-dry-fold/` |
| Commercial | `/commercial` | `/austin-tx/commercial/` |
| About Us | `/about-us` | `/austin-tx/about-us/` |
| Testimonials | `/testimonials` | `/austin-tx/testimonials/` |
| Locations | `/locations` | `/austin-tx/locations/` |
| Contact | `/contact` | `/austin-tx/contact/` |
| Employment | `/employment` | `/austin-tx/employment/` |
| Blog | `/blog` | `/austin-tx/blog/` |

## How It Works

### 1. Page Load
```
1. wavemaxlaundry.com page loads with iframe
2. Bridge script reads data-route attribute
3. Bridge script builds iframe URL with route parameter
4. Iframe loads content from wavemax.promo
```

### 2. Content Loading
```
1. site-page-content-only.html loads in iframe
2. site-page-loader.js reads route parameter
3. Content fetched from site-pages.json
4. Content rendered dynamically
5. Height calculated and sent to parent
```

### 3. Communication Flow
```
Iframe → Parent: { type: 'resize', data: { height: 1200 }}
Parent → Iframe: { type: 'viewport-info', data: { width: 1024, deviceType: 'desktop' }}
Iframe → Parent: { type: 'navigate', data: { url: '/contact' }}
```

## Adding New Pages

### 1. Add Content to JSON

Edit `/public/content/site-pages.json`:

```json
{
  "new-page": {
    "title": "New Page Title",
    "metaDescription": "Description for SEO",
    "hero": {
      "heading": "Page Heading",
      "subheading": "Subheading text"
    },
    "services": [...],
    "features": [...]
  }
}
```

### 2. Add Route (if needed)

If using a custom route, add to `/public/assets/js/site-page-loader.js` routeMap:

```javascript
const routeMap = {
    // ... existing routes
    'new-page': 'new-page'
};
```

### 3. Add to Router

Add to `/public/assets/js/embed-app-v2.js`:

```javascript
const EMBED_PAGES = {
    // ... existing routes
    '/new-page': '/site-page-content-only.html'
};
```

### 4. Create Embed Code

On wavemaxlaundry.com page:

```html
<div id="wavemax-content-container" style="width: 100%; min-height: 600px;">
    <iframe
        width="100%"
        height="800"
        style="border: none;"
        id="wavemax-iframe"
        data-route="/new-page"
        frameborder="0">
    </iframe>
</div>
```

## Customization

### Custom Styling

Edit `/public/site-page-content-only.html` styles section to match your brand.

### Custom Sections

Add new render functions to `/public/assets/js/site-page-loader.js`:

```javascript
function renderCustomSection(data, container) {
    const section = document.createElement('section');
    section.className = 'content-section';
    section.innerHTML = `<h2>${data.title}</h2>`;
    container.appendChild(section);
}
```

Then call from `renderPage()`:

```javascript
if (pageData.customSection) {
    renderCustomSection(pageData.customSection, contentArea);
}
```

### Bridge Events

Add custom event handlers in bridge script:

```javascript
// In wavemaxlaundry.com page
window.addEventListener('message', function(e) {
    if (e.data.type === 'custom-event') {
        // Handle custom event
    }
});

// Send from iframe
window.parent.postMessage({
    type: 'custom-event',
    data: { foo: 'bar' }
}, '*');
```

## Testing

### Local Testing

1. Test iframe URL directly:
```
https://wavemax.promo/embed-app-v2.html?route=/home
```

2. Verify content loads and displays correctly

3. Check browser console for errors

### Integration Testing

1. Deploy to staging environment
2. Test all pages with embedded content
3. Verify auto-resize works
4. Test on mobile, tablet, desktop
5. Verify navigation links work
6. Check SEO meta tags in parent page

### Checklist

- [ ] Bridge script loaded once per page
- [ ] Iframe has correct data-route attribute
- [ ] Content loads without errors
- [ ] Height auto-adjusts properly
- [ ] Links navigate parent window (not iframe)
- [ ] Mobile responsive
- [ ] No console errors
- [ ] SEO meta tags present in parent page
- [ ] Analytics tracking works (if configured)

## Troubleshooting

### Iframe Not Loading

**Problem:** Blank iframe
**Check:**
- Network tab shows request to wavemax.promo
- Console shows no CORS errors
- iframe src attribute is set correctly

### Height Not Adjusting

**Problem:** Iframe has scrollbars or wrong height
**Check:**
- Bridge script is loaded
- Console shows resize messages
- Origin validation not blocking messages

### Content Not Displaying

**Problem:** Content area shows "Loading..."
**Check:**
- Route exists in site-pages.json
- site-page-loader.js is loading
- Console shows fetch errors or JSON parse errors

### Links Not Working

**Problem:** Links don't navigate or open in iframe
**Check:**
- Navigation event handler in site-page-content-only.html
- Bridge script handles 'navigate' messages
- Links have proper href attributes

## Security Considerations

1. **Origin Validation:** Bridge script validates messages come from wavemax.promo
2. **HTTPS Only:** All communication over HTTPS
3. **CSP Headers:** Content Security Policy configured appropriately
4. **XSS Prevention:** All user input sanitized in JSON content
5. **Frame Options:** X-Frame-Options allows embedding

## Performance Optimization

1. **Caching:** Set appropriate cache headers for static content
2. **CDN:** Serve static assets (CSS, JS, images) from CDN
3. **Lazy Loading:** Consider lazy loading iframes below fold
4. **Preconnect:** Add preconnect hints for wavemax.promo
5. **Compression:** Enable gzip/brotli compression

Example preconnect:
```html
<link rel="preconnect" href="https://wavemax.promo">
<link rel="dns-prefetch" href="https://wavemax.promo">
```

## SEO Considerations

Since content is in an iframe, ensure parent page has:

1. **Title Tags:** Unique, descriptive titles
2. **Meta Descriptions:** Compelling descriptions for each page
3. **Heading Tags:** H1 should be in parent page (not just iframe)
4. **Structured Data:** Schema.org markup in parent page
5. **Canonical URLs:** Point to the main page URL

Example:
```html
<head>
    <title>Self-Serve Laundry Austin | WaveMAX Laundry</title>
    <meta name="description" content="Self-serve laundry in Austin...">
    <link rel="canonical" href="https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "WaveMAX Laundry"
    }
    </script>
</head>
```

## Maintenance

### Content Updates

Edit `/public/content/site-pages.json` and restart the server (or refresh cache).

### Styling Updates

Edit `/public/site-page-content-only.html` styles section.

### Bridge Updates

Update `/docs/parent-iframe-bridge.js` and re-deploy to wavemaxlaundry.com.

### Router Updates

Update `/public/assets/js/embed-app-v2.js` EMBED_PAGES object.

## Support

For issues or questions:
1. Check browser console for errors
2. Verify all files are deployed correctly
3. Test iframe URL directly in browser
4. Review this guide for troubleshooting steps

## Example: Complete Page Integration

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Self-Serve Laundry Austin | WaveMAX Laundry</title>
    <meta name="description" content="Self-serve laundry in Austin with modern equipment.">
    <link rel="canonical" href="https://www.wavemaxlaundry.com/austin-tx/self-serve-laundry/">

    <!-- Your existing CSS -->
    <link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
    <!-- Your Header -->
    <header class="site-header">
        <nav>
            <!-- Your navigation -->
        </nav>
    </header>

    <!-- Embedded Content Area -->
    <main>
        <div id="wavemax-content-container" style="width: 100%; min-height: 600px;">
            <iframe
                width="100%"
                height="800"
                style="border: none;"
                id="wavemax-iframe"
                data-route="/self-serve-laundry"
                frameborder="0">
            </iframe>
        </div>
    </main>

    <!-- Your Footer -->
    <footer class="site-footer">
        <!-- Your footer content -->
    </footer>

    <!-- Bridge Script (load once) -->
    <script src="https://wavemax.promo/docs/parent-iframe-bridge.js"></script>
</body>
</html>
```

## Next Steps

1. Test the integration on a staging environment
2. Verify all pages load correctly
3. Test on multiple devices and browsers
4. Update remaining pages with embedded content
5. Monitor performance and user experience
6. Gather feedback and iterate

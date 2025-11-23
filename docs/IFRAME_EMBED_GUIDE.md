# WaveMAX Website Iframe Embed Guide

This guide explains how to replace the existing wavemaxlaundry.com site content with iframe embeds that serve content from the WaveMAX affiliate program embedded app.

## Overview

The embedded app now serves all website pages through a unified routing system. Each page on wavemaxlaundry.com should be replaced with an iframe that loads the corresponding route from the embedded app.

## Base Iframe Template

Use this base template for all pages. Replace `{ROUTE}` with the appropriate route for each page.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WaveMAX Laundry Austin</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        #wavemax-iframe {
            width: 100%;
            border: none;
            display: block;
            min-height: 100vh;
        }
        .loading {
            text-align: center;
            padding: 50px;
            font-family: Arial, sans-serif;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">Loading...</div>
    <iframe
        id="wavemax-iframe"
        src="https://wavemax.promo/embed-app-v2.html?route={ROUTE}"
        title="WaveMAX Laundry"
        style="display: none;"
        onload="this.style.display='block'; document.getElementById('loading').style.display='none';">
    </iframe>

    <script>
        // Auto-resize iframe based on content
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'resize') {
                const iframe = document.getElementById('wavemax-iframe');
                if (event.data.data && event.data.data.height) {
                    iframe.style.height = event.data.data.height + 'px';
                }
            }
        });

        // Set initial height
        document.getElementById('wavemax-iframe').style.height = '100vh';
    </script>
</body>
</html>
```

## Page Mapping

Replace each wavemaxlaundry.com page with the corresponding iframe embed:

### Main Pages

| Original URL | Route Parameter | Full Iframe URL |
|-------------|-----------------|-----------------|
| `/austin-tx/` | `/home` | `https://wavemax.promo/embed-app-v2.html?route=/home` |
| `/austin-tx/self-serve-laundry/` | `/self-serve-laundry` | `https://wavemax.promo/embed-app-v2.html?route=/self-serve-laundry` |
| `/austin-tx/wash-dry-fold/` | `/wash-dry-fold` | `https://wavemax.promo/embed-app-v2.html?route=/wash-dry-fold` |
| `/austin-tx/commercial/` | `/commercial` | `https://wavemax.promo/embed-app-v2.html?route=/commercial` |
| `/austin-tx/about-us/` | `/about-us` | `https://wavemax.promo/embed-app-v2.html?route=/about-us` |
| `/austin-tx/testimonials/` | `/testimonials` | `https://wavemax.promo/embed-app-v2.html?route=/testimonials` |
| `/austin-tx/locations/` | `/locations` | `https://wavemax.promo/embed-app-v2.html?route=/locations` |
| `/austin-tx/contact/` | `/contact` | `https://wavemax.promo/embed-app-v2.html?route=/contact` |
| `/austin-tx/employment/` | `/employment` | `https://wavemax.promo/embed-app-v2.html?route=/employment` |
| `/austin-tx/blog/` | `/blog` | `https://wavemax.promo/embed-app-v2.html?route=/blog` |
| `/austin-tx/wavemax-austin-affiliate-program/` | `/affiliate-program` | `https://wavemax.promo/embed-app-v2.html?route=/affiliate-program` |

### Commercial Service Pages

| Original URL | Route Parameter |
|-------------|-----------------|
| `/austin-tx/colleges-schools/` | `/commercial/colleges-schools` |
| `/austin-tx/medical-offices/` | `/commercial/medical-offices` |
| `/austin-tx/health-clubs/` | `/commercial/health-clubs` |
| `/austin-tx/country-clubs/` | `/commercial/country-clubs` |
| `/austin-tx/airbnb-rentals/` | `/commercial/airbnb-rentals` |
| `/austin-tx/salons-spas/` | `/commercial/salons-spas` |

## Example: Home Page

Create `/austin-tx/index.html` on wavemaxlaundry.com:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WaveMAX Laundry Austin | Best Laundromat Near Me</title>
    <meta name="description" content="WaveMAX Laundry in Austin offers self-serve laundry, wash-dry-fold, and commercial laundry services. Cleanest laundromat with hospital-grade sanitization. Open 7 AM - 10 PM daily.">
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        #wavemax-iframe {
            width: 100%;
            border: none;
            display: block;
            min-height: 100vh;
        }
        .loading {
            text-align: center;
            padding: 50px;
            font-family: Arial, sans-serif;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">Loading WaveMAX Laundry...</div>
    <iframe
        id="wavemax-iframe"
        src="https://wavemax.promo/embed-app-v2.html?route=/home"
        title="WaveMAX Laundry Austin"
        style="display: none;"
        onload="this.style.display='block'; document.getElementById('loading').style.display='none';">
    </iframe>

    <script>
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'resize') {
                const iframe = document.getElementById('wavemax-iframe');
                if (event.data.data && event.data.data.height) {
                    iframe.style.height = event.data.data.height + 'px';
                }
            }
        });

        document.getElementById('wavemax-iframe').style.height = '100vh';
    </script>
</body>
</html>
```

## Example: Self-Serve Laundry Page

Create `/austin-tx/self-serve-laundry/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Self-Serve Laundry Austin | Best Self-Serve Laundromat Near Me</title>
    <meta name="description" content="Self-serve laundry in Austin with 42 high-efficiency Electrolux washers and dryers. Touchless payment, UV sanitization, free WiFi. Open 7 AM - 10 PM.">
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        #wavemax-iframe {
            width: 100%;
            border: none;
            display: block;
            min-height: 100vh;
        }
        .loading {
            text-align: center;
            padding: 50px;
            font-family: Arial, sans-serif;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">Loading Self-Serve Laundry...</div>
    <iframe
        id="wavemax-iframe"
        src="https://wavemax.promo/embed-app-v2.html?route=/self-serve-laundry"
        title="WaveMAX Self-Serve Laundry"
        style="display: none;"
        onload="this.style.display='block'; document.getElementById('loading').style.display='none';">
    </iframe>

    <script>
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'resize') {
                const iframe = document.getElementById('wavemax-iframe');
                if (event.data.data && event.data.data.height) {
                    iframe.style.height = event.data.data.height + 'px';
                }
            }
        });

        document.getElementById('wavemax-iframe').style.height = '100vh';
    </script>
</body>
</html>
```

## WordPress / CMS Integration

If using WordPress or another CMS, you can create a template:

```php
<?php
/*
Template Name: WaveMAX Iframe Page
*/

// Get the route from page slug or custom field
$route = get_post_meta(get_the_ID(), 'wavemax_route', true);
if (empty($route)) {
    $route = '/home'; // Default route
}

$embed_url = 'https://wavemax.promo/embed-app-v2.html?route=' . urlencode($route);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php wp_title(); ?></title>
    <meta name="description" content="<?php echo get_the_excerpt(); ?>">
    <?php wp_head(); ?>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        #wavemax-iframe {
            width: 100%;
            border: none;
            display: block;
            min-height: 100vh;
        }
        .loading {
            text-align: center;
            padding: 50px;
            font-family: Arial, sans-serif;
            color: #666;
        }
    </style>
</head>
<body <?php body_class(); ?>>
    <div class="loading" id="loading">Loading...</div>
    <iframe
        id="wavemax-iframe"
        src="<?php echo esc_url($embed_url); ?>"
        title="<?php the_title(); ?>"
        style="display: none;"
        onload="this.style.display='block'; document.getElementById('loading').style.display='none';">
    </iframe>

    <script>
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'resize') {
                const iframe = document.getElementById('wavemax-iframe');
                if (event.data.data && event.data.data.height) {
                    iframe.style.height = event.data.data.height + 'px';
                }
            }
        });

        document.getElementById('wavemax-iframe').style.height = '100vh';
    </script>
    <?php wp_footer(); ?>
</body>
</html>
```

## Testing the Integration

1. **Test Individual Pages**: Visit each iframe URL directly to ensure content loads correctly
   - Example: `https://wavemax.promo/embed-app-v2.html?route=/home`

2. **Test on wavemaxlaundry.com**: Deploy the iframe pages and verify:
   - Content loads properly
   - Navigation works within iframes
   - Height auto-adjusts to content
   - Mobile responsiveness works

3. **SEO Considerations**: While content is in an iframe, ensure each page has:
   - Proper meta titles and descriptions in the parent page
   - Structured data (schema.org) in the parent page
   - Proper canonical URLs

## Advanced: JavaScript Communication

The iframe automatically sends resize messages. You can also listen for navigation events:

```html
<script>
    window.addEventListener('message', function(event) {
        // Handle resize
        if (event.data && event.data.type === 'resize') {
            const iframe = document.getElementById('wavemax-iframe');
            if (event.data.data && event.data.data.height) {
                iframe.style.height = event.data.data.height + 'px';
            }
        }

        // Handle navigation (if implemented)
        if (event.data && event.data.type === 'navigate') {
            // Update parent URL without page reload
            if (event.data.data && event.data.data.route) {
                window.history.pushState({}, '', event.data.data.route);
            }
        }
    });
</script>
```

## Adding New Pages

To add a new page to the system:

1. **Add content to** `/public/content/site-pages.json`:
```json
{
  "new-page": {
    "title": "Page Title",
    "metaDescription": "Page description",
    "hero": {
      "heading": "Main Heading",
      "subheading": "Subheading"
    },
    // ... more content structure
  }
}
```

2. **Add route to** `/public/assets/js/embed-app-v2.js`:
```javascript
const EMBED_PAGES = {
    // ... existing routes
    '/new-page': '/site-page-embed.html'
};
```

3. **Create iframe page** on wavemaxlaundry.com using the template above with `route=/new-page`

## Deployment Checklist

- [ ] Content JSON file is complete and validated
- [ ] All routes are added to embed-app-v2.js
- [ ] Iframe pages created for each route
- [ ] Meta titles and descriptions optimized for SEO
- [ ] Mobile responsiveness tested
- [ ] Navigation tested (links work correctly)
- [ ] Analytics tracking configured (if needed)
- [ ] SSL certificate valid on both domains
- [ ] CORS headers configured correctly
- [ ] Performance tested (page load times)

## Support and Maintenance

- **Content Updates**: Edit `/public/content/site-pages.json` and restart the server
- **Styling Updates**: Modify `/public/site-page-embed.html` CSS
- **New Routes**: Add to `embed-app-v2.js` EMBED_PAGES object
- **Bug Reports**: Check browser console for errors in both parent page and iframe

## Performance Optimization

1. **Enable Caching**: Configure nginx to cache the iframe HTML and JSON content
2. **CDN**: Use a CDN for static assets (CSS, JS, images)
3. **Lazy Loading**: Consider lazy-loading iframes for pages with multiple embeds
4. **Preloading**: Use `<link rel="preload">` for critical resources

## Security Considerations

- Always use HTTPS for both domains
- Configure Content Security Policy headers appropriately
- Validate and sanitize any user input in parent pages
- Keep iframe source domain restricted (don't allow arbitrary domains)
- Regularly update dependencies and monitor for security vulnerabilities

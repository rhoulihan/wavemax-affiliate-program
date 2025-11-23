---
description: Generate iframe embed code for a route and ensure it's configured for bridge V2
---

You are tasked with generating the iframe embed code for a specific route in the WaveMAX embedded app system. Follow these steps:

## Step 1: Parse the Route Parameter

The user will provide a route, which may be:
- With leading slash: `/self-serve-laundry`
- Without leading slash: `self-serve-laundry`
- Full URL: `https://wavemax.promo/embed-app-v2.html?route=/self-serve-laundry`

Normalize it to the format `/route-name` (e.g., `/self-serve-laundry`).

## Step 2: Check Route Configuration

Read `/var/www/wavemax/wavemax-affiliate-program/public/assets/js/embed-app-v2.js` and:

1. Find the `pageScripts` object (around line 680)
2. Check if the route exists in `pageScripts`
3. Check if the route's scripts array includes `/assets/js/iframe-bridge-v2.js`

## Step 3: Update Configuration if Needed

If the route does NOT include `/assets/js/iframe-bridge-v2.js`:

1. Add it to the route's scripts array as the FIRST script (before any other page-specific scripts)
2. Update the file using the Edit tool
3. Inform the user that the route has been updated to support bridge V2

If the route does NOT exist in `pageScripts`:

1. Inform the user that the route needs to be created first
2. Ask if they want you to create a basic route configuration with the bridge
3. If yes, add the route with at minimum: `'/route-name': ['/assets/js/iframe-bridge-v2.js']`

## Step 4: Generate Embed Code

Generate the complete HTML code needed to embed this route on the parent page (wavemaxlaundry.com):

```html
<!-- WaveMAX Embedded Content: [ROUTE_NAME] -->
<!-- Load the parent-side bridge script (only needed once per page) -->
<script src="https://wavemax.promo/assets/js/parent-iframe-bridge-v2.js"></script>

<!-- Iframe container -->
<iframe
    id="wavemax-iframe"
    src="https://wavemax.promo/embed-app-v2.html?route=[ROUTE]"
    style="width: 100%; border: none; display: block;"
    frameborder="0"
    scrolling="no">
</iframe>

<!-- The parent bridge will automatically:
     - Hide the page header on the parent page
     - Sync language changes between parent and iframe
     - Auto-resize the iframe based on content height
-->
```

Replace `[ROUTE_NAME]` with a human-readable name and `[ROUTE]` with the actual route path.

## Step 5: Provide Usage Instructions

Include these instructions for the user:

1. **Bridge Script**: The parent-side bridge script should be loaded only once per page, before any iframes.

2. **Iframe ID**: The iframe should have `id="wavemax-iframe"` for the bridge to find it. If multiple iframes are needed on one page, you'll need to modify the bridge to support multiple iframes.

3. **Language Sync**: The bridge will automatically sync the language from localStorage key `wavemax-language` between parent and iframe.

4. **Testing**: After embedding:
   - Check browser console for bridge initialization messages
   - Verify page header is hidden
   - Test language switching if applicable
   - Confirm iframe auto-resizes with content

5. **Customization**: If you need page-specific behavior beyond the global actions, you can use the bridge's page action registration system.

## Important Notes

- Always ensure the route is configured in embed-app-v2.js before generating embed code
- The bridge V2 system requires both parent-side and iframe-side scripts to work
- The iframe will communicate with the parent via postMessage with origin validation
- Auto-resize updates happen on content changes, tab switches, and accordion interactions

Now, process the route parameter the user provided and complete all steps above.

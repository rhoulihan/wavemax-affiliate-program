# Quarantined Legacy Embed App

**Date Quarantined:** 2025-01-18  
**Reason:** Legacy embed-app.html replaced with CSP v2 compliant embed-app-v2.html. All traffic now redirects to the new version.

## Quarantined Files

### 1. embed-app.html (Legacy Version)
- **Original Location:** `/public/embed-app.html`
- **CSP Status:** Non-compliant (used 'unsafe-inline' for dynamic content)
- **Description:** Original embed container with legacy routing and non-CSP compliant dynamic content loading
- **Dependencies:** 
  - Various legacy JavaScript files
  - Non-CSP compliant inline script generation
  - Legacy page routing system

## Current Implementation

**New System:**
- **embed-app-v2.html** - Fully CSP v2 compliant container
- **embed-app.html** - Redirect page that forwards all traffic to v2
- All URLs preserve parameters and hash fragments during redirect
- Enhanced security with strict Content Security Policy
- Improved performance and reliability

## Migration Benefits

✅ **Security Enhancements:**
- Strict CSP v2 compliance eliminates XSS vulnerabilities
- No 'unsafe-inline' scripts or styles
- Nonce-based script execution

✅ **Performance Improvements:**
- Cleaner, more efficient JavaScript loading
- Better error handling and debugging
- Optimized resource loading

✅ **Maintainability:**
- Consistent code patterns across all pages
- Centralized script management
- Better separation of concerns

## Redirect Implementation

The new `/public/embed-app.html` is a lightweight redirect page that:
1. Preserves all URL parameters (`?route=`, `?affid=`, etc.)
2. Maintains hash fragments (`#section`)
3. Provides user feedback during redirect
4. Includes fallback for accessibility
5. Logs redirect activity for debugging

## Restoration Instructions

**⚠️ Not Recommended:** The legacy version is replaced for security reasons.

If restoration is absolutely necessary for debugging:

```bash
# Backup current redirect page
mv /var/www/wavemax/wavemax-affiliate-program/public/embed-app.html /var/www/wavemax/wavemax-affiliate-program/public/embed-app-redirect-backup.html

# Restore legacy version (NOT RECOMMENDED)
cp /var/www/wavemax/wavemax-affiliate-program/quarantine/legacy-embed-app/embed-app.html /var/www/wavemax/wavemax-affiliate-program/public/

# To restore redirect functionality
mv /var/www/wavemax/wavemax-affiliate-program/public/embed-app-redirect-backup.html /var/www/wavemax/wavemax-affiliate-program/public/embed-app.html
```

## URL Compatibility

All existing URLs continue to work seamlessly:

- `https://wavemax.promo/embed-app.html?route=/customer-login` → `https://wavemax.promo/embed-app-v2.html?route=/customer-login`
- `https://wavemax.promo/embed-app.html?route=/affiliate-register&affid=123` → `https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&affid=123`
- All parameters, routes, and functionality preserved

## Notes

- **Zero downtime migration** - all existing links continue to work
- **Transparent to users** - redirect happens automatically
- **SEO friendly** - uses `window.location.replace()` to avoid back button issues
- **Fallback protection** - manual link available if JavaScript fails
- **Full CSP v2 compliance** - both redirect page and destination are secure
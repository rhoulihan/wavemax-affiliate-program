# Fix DocuSign Redirect URI Error

## In the DocuSign Admin Console:

1. **Find the "Redirect URIs" section** in your app settings
   - This might be under "OAuth", "Additional settings", or "App settings"

2. **Add the exact redirect URI**:
   ```
   https://www.wavemaxlaundry.com/wavemax-affiliate-program/affiliate/dashboard?tab=settings
   ```

3. **Also add these variations** (DocuSign is very strict about exact matches):
   ```
   https://www.wavemaxlaundry.com/wavemax-affiliate-program/affiliate/dashboard
   https://wavemax.promo/api/v1/auth/docusign/callback
   http://localhost:3001/api/v1/auth/docusign/callback
   ```

4. **Save the changes**

## Important Notes:
- The redirect URI must match EXACTLY (including https://, trailing slashes, query parameters)
- DocuSign is case-sensitive for redirect URIs
- You can add multiple redirect URIs for different environments

## After adding the redirect URI:
1. Try the consent URL again in incognito mode
2. Or use this simplified consent URL without redirect:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=d625bca0-872f-4282-a6b8-bfc47a03b866&redirect_uri=https://www.wavemaxlaundry.com/wavemax-affiliate-program/affiliate/dashboard
   ```

## Alternative: Use DocuSign's built-in consent
Some DocuSign apps have a "Grant Consent" button directly in the admin console that doesn't require a redirect URI.
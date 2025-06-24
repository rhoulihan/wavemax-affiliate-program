# Facebook OAuth Setup Guide

## Overview

The WaveMAX Affiliate Program has a complete Facebook OAuth implementation that supports authentication for both affiliates and customers. This guide provides detailed instructions for configuring Facebook OAuth.

## Implementation Status

### ✅ Already Implemented
- **Backend**: Full Passport.js Facebook strategy with account linking
- **Frontend**: Facebook login buttons on both affiliate and customer login pages
- **Routes**: Separate OAuth flows for affiliates and customers
- **Database**: Social account storage in MongoDB schemas
- **Popup Flow**: Embedded-friendly authentication using popups
- **Error Handling**: Comprehensive error handling and user feedback

### ❌ Configuration Required
- Facebook App creation and configuration
- Environment variables setup

## Step-by-Step Setup Instructions

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Consumer"** as the app type
4. Fill in the app details:
   - **App Name**: WaveMAX Affiliate Program (or your preferred name)
   - **App Contact Email**: Your email address
   - **App Purpose**: Select appropriate purpose

### 2. Configure Facebook App Settings

#### Basic Settings
1. In your app dashboard, go to **Settings** → **Basic**
2. Note your **App ID** and **App Secret** (you'll need these for environment variables)
3. Add your domain:
   - **App Domains**: `wavemax.promo`
   - **Privacy Policy URL**: `https://wavemax.promo/privacy`
   - **Terms of Service URL**: `https://wavemax.promo/terms`

#### Facebook Login Product
1. Click **"Add Product"** and select **"Facebook Login"**
2. Choose **"Web"** as the platform
3. Set **Site URL**: `https://wavemax.promo`

#### OAuth Redirect URIs
1. Go to **Facebook Login** → **Settings**
2. Add the following **Valid OAuth Redirect URIs**:
   ```
   https://wavemax.promo/api/v1/auth/facebook/callback
   ```
3. Enable these settings:
   - **Client OAuth Login**: Yes
   - **Web OAuth Login**: Yes
   - **Enforce HTTPS**: Yes
   - **Embedded Browser OAuth Login**: Yes (for mobile support)

### 3. Configure Permissions and Features

1. Go to **App Review** → **Permissions and Features**
2. Ensure these permissions are enabled:
   - `email` (required for basic functionality)
   - `public_profile` (default permission)

### 4. Set Environment Variables

Add the following to your `.env` file:

```bash
# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
```

Replace `your_app_id_here` and `your_app_secret_here` with the values from your Facebook app.

### 5. Development vs Production

#### For Development/Testing
1. In Facebook App Dashboard, your app starts in **Development Mode**
2. Add test users: **Roles** → **Test Users**
3. Only authorized users can log in during development

#### For Production
1. Complete **App Review**:
   - Go to **App Review** → **Requests**
   - Submit for `email` permission (usually auto-approved)
   
2. Complete **Business Verification** (if required):
   - May be needed for certain industries
   - Go to **Settings** → **Business Verification**

3. Switch to **Production Mode**:
   - Toggle the switch in the app dashboard header
   - Confirms your app is ready for public use

### 6. Testing the Integration

1. Restart your application:
   ```bash
   pm2 restart wavemax
   ```

2. Test affiliate login:
   - Go to `https://wavemax.promo/affiliate-login`
   - Click "Continue with Facebook"
   - Complete OAuth flow
   - Verify account creation/login

3. Test customer login:
   - Go to `https://wavemax.promo/customer-login`
   - Click "Continue with Facebook"
   - Complete OAuth flow
   - Select affiliate and complete registration

## OAuth Flow Details

### Affiliate OAuth Flow
1. User clicks "Continue with Facebook" on affiliate login
2. Facebook OAuth popup opens
3. User authorizes the app
4. System checks for existing affiliate account:
   - **Existing account**: Logs in directly
   - **New user**: Redirects to registration form with pre-filled data
   - **Existing customer**: Shows error suggesting customer login

### Customer OAuth Flow
1. User clicks "Continue with Facebook" on customer login
2. Facebook OAuth popup opens
3. User authorizes the app
4. System checks for existing customer account:
   - **Existing account**: Logs in directly
   - **New user**: Redirects to registration form with pre-filled data
   - **Existing affiliate**: Shows error suggesting affiliate login

### Account Linking
- Users can link Facebook to existing accounts
- Email matching is used to identify existing accounts
- Social account data is stored securely in the database

## Security Considerations

1. **App Secret Security**:
   - Never expose your App Secret in client-side code
   - Keep it secure in environment variables
   - Rotate it periodically

2. **HTTPS Requirement**:
   - Facebook requires HTTPS for OAuth redirects
   - Ensure your production domain has valid SSL

3. **State Parameter**:
   - Implementation uses state parameter for CSRF protection
   - Supports embedded context detection

## Troubleshooting

### Common Issues

1. **"Facebook OAuth is not configured" error**:
   - Verify environment variables are set correctly
   - Ensure application was restarted after adding variables

2. **"URL Blocked" error from Facebook**:
   - Check OAuth redirect URI matches exactly
   - Ensure domain is added to app settings
   - Verify HTTPS is enabled

3. **"App Not Active" error**:
   - Check app is not in development mode for public users
   - Ensure app review is complete if needed

4. **Missing email from Facebook**:
   - Some users may not have email permission
   - Implementation handles this gracefully

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=wavemax:oauth
```

This will show detailed OAuth flow information in server logs.

## Monitoring

1. **Facebook Analytics**:
   - Monitor login success rates in Facebook App Dashboard
   - Track user engagement metrics

2. **Application Logs**:
   - OAuth events are logged with audit trail
   - Check PM2 logs for errors: `pm2 logs wavemax`

3. **Error Tracking**:
   - Failed logins are logged with reasons
   - Monitor for patterns in authentication failures

## Maintenance

### Regular Tasks
1. **Review Facebook Platform Updates**:
   - Check for API version changes
   - Update SDK versions as needed

2. **Monitor Token Expiration**:
   - Facebook access tokens expire
   - Implementation handles refresh automatically

3. **Security Audits**:
   - Review OAuth implementation quarterly
   - Check for security advisories

### Updating App Credentials
If you need to change Facebook app credentials:

1. Update `.env` file with new credentials
2. Restart application: `pm2 restart wavemax`
3. Test OAuth flow thoroughly
4. Update any documentation

## Additional Resources

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/web)
- [Facebook App Development](https://developers.facebook.com/docs/development)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
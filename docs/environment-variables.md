# Environment Variables Documentation

This document provides comprehensive information about all environment variables used in the WaveMAX Laundry Affiliate Program.

## Table of Contents

1. [Application Settings](#application-settings)
2. [Database Configuration](#database-configuration)
3. [Security & Authentication](#security--authentication)
4. [Email Configuration](#email-configuration)
5. [DocuSign Configuration](#docusign-configuration)
6. [Payment Configuration](#payment-configuration)
7. [AWS Configuration](#aws-configuration)
8. [Social Login Configuration](#social-login-configuration)
9. [Rate Limiting](#rate-limiting)
10. [CORS Configuration](#cors-configuration)
11. [Business Configuration](#business-configuration)
12. [Default Accounts](#default-accounts)
13. [Development Settings](#development-settings)

## Application Settings

### PORT
- **Type**: Number
- **Default**: 3000
- **Description**: The port number on which the application server will listen
- **Example**: `PORT=3000`

### NODE_ENV
- **Type**: String
- **Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Description**: Defines the environment in which the application is running. Affects logging, error handling, and feature availability
- **Example**: `NODE_ENV=production`

### BASE_URL
- **Type**: String (URL)
- **Required**: Yes
- **Description**: The base URL of your application without trailing slash. Used for generating absolute URLs, OAuth callbacks, and email links
- **Example**: `BASE_URL=https://wavemax.promo`

### LOG_LEVEL
- **Type**: String
- **Values**: `error`, `warn`, `info`, `debug`
- **Default**: `info`
- **Description**: Controls the verbosity of application logging
- **Example**: `LOG_LEVEL=info`

### SHOW_DOCS
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enables API documentation endpoints when set to true
- **Example**: `SHOW_DOCS=false`

### ENABLE_DELETE_DATA_FEATURE
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enables dangerous data deletion endpoints. Should only be true in development
- **Security**: ⚠️ **WARNING**: Never enable in production
- **Example**: `ENABLE_DELETE_DATA_FEATURE=false`

### ENABLE_TEST_PAYMENT_FORM
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enables a test payment form for development purposes
- **Example**: `ENABLE_TEST_PAYMENT_FORM=false`

## Database Configuration

### MONGODB_URI
- **Type**: String (MongoDB Connection String)
- **Required**: Yes
- **Description**: MongoDB connection string including credentials and database name
- **Format**: `mongodb://[username:password@]host[:port]/database` or `mongodb+srv://...`
- **Example**: `MONGODB_URI=mongodb://localhost:27017/wavemax-affiliate`

## Security & Authentication

### JWT_SECRET
- **Type**: String (Hex)
- **Required**: Yes
- **Description**: Secret key used for signing JWT tokens. Must be kept secure
- **Generation**: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- **Example**: `JWT_SECRET=your-64-byte-hex-string`

### SESSION_SECRET
- **Type**: String (Hex)
- **Required**: Yes
- **Description**: Secret key used for signing session cookies
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Example**: `SESSION_SECRET=your-32-byte-hex-string`

### ENCRYPTION_KEY
- **Type**: String (Hex)
- **Required**: Yes
- **Description**: Key used for encrypting sensitive data in the database
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Example**: `ENCRYPTION_KEY=your-32-byte-hex-string`

### JWT_EXPIRES_IN
- **Type**: String (Time)
- **Default**: `2h`
- **Description**: JWT token expiration time (e.g., 2h, 1d, 7d)
- **Example**: `JWT_EXPIRES_IN=2h`

### JWT_REFRESH_EXPIRES_IN
- **Type**: String (Time)
- **Default**: `7d`
- **Description**: JWT refresh token expiration time
- **Example**: `JWT_REFRESH_EXPIRES_IN=7d`

### CSRF_PHASE
- **Type**: Number
- **Values**: `1`, `2`, `3`
- **Default**: `1`
- **Description**: CSRF protection level:
  - `1`: Critical endpoints only (orders, payments, admin)
  - `2`: High priority endpoints (profiles, settings)
  - `3`: All state-changing endpoints
- **Example**: `CSRF_PHASE=1`

## Store IP Configuration

### STORE_IP_ADDRESS
- **Type**: String (IP Address)
- **Description**: Primary store IP address for automatic operator session renewal
- **Example**: `STORE_IP_ADDRESS=70.114.167.145`

### ADDITIONAL_STORE_IPS
- **Type**: String (Comma-separated IP addresses)
- **Description**: Additional store IP addresses for operator session renewal
- **Example**: `ADDITIONAL_STORE_IPS=192.168.1.100,10.0.0.50`

### STORE_IP_RANGES
- **Type**: String (Comma-separated CIDR ranges)
- **Description**: Store network IP ranges in CIDR notation
- **Example**: `STORE_IP_RANGES=192.168.1.0/24,10.0.0.0/16`

### STORE_SESSION_CHECK_INTERVAL
- **Type**: Number (Milliseconds)
- **Default**: `300000` (5 minutes)
- **Description**: How often to check if operator token needs renewal
- **Example**: `STORE_SESSION_CHECK_INTERVAL=300000`

### STORE_SESSION_RENEW_THRESHOLD
- **Type**: Number (Milliseconds)
- **Default**: `1800000` (30 minutes)
- **Description**: Renew token when it has less than this much time left
- **Example**: `STORE_SESSION_RENEW_THRESHOLD=1800000`

### STORE_SESSION_MAX_DURATION
- **Type**: Number (Milliseconds)
- **Default**: `86400000` (24 hours)
- **Description**: Maximum session duration for operators at store IPs
- **Example**: `STORE_SESSION_MAX_DURATION=86400000`

## Email Configuration

### EMAIL_PROVIDER
- **Type**: String
- **Values**: `smtp`, `ses`, `exchange`, `console`
- **Required**: Yes
- **Description**: Email service provider to use:
  - `smtp`: Standard SMTP server
  - `ses`: Amazon Simple Email Service
  - `exchange`: Microsoft Exchange Server
  - `console`: Log emails to console (development only)
- **Example**: `EMAIL_PROVIDER=smtp`

### ADMIN_EMAIL
- **Type**: String (Email)
- **Default**: `admin@wavemaxlaundry.com`
- **Description**: Email address for system administrator notifications
- **Example**: `ADMIN_EMAIL=admin@wavemaxlaundry.com`

### NOTIFICATION_EMAIL
- **Type**: String (Email)
- **Description**: Email address for general system notifications
- **Example**: `NOTIFICATION_EMAIL=notifications@wavemaxlaundry.com`

### SMTP Configuration (when EMAIL_PROVIDER=smtp)

#### EMAIL_HOST
- **Type**: String
- **Description**: SMTP server hostname
- **Example**: `EMAIL_HOST=smtp.gmail.com`

#### EMAIL_PORT
- **Type**: Number
- **Default**: `587`
- **Description**: SMTP server port (typically 587 for TLS, 465 for SSL)
- **Example**: `EMAIL_PORT=587`

#### EMAIL_USER
- **Type**: String
- **Description**: SMTP authentication username
- **Example**: `EMAIL_USER=noreply@wavemax.promo`

#### EMAIL_PASS
- **Type**: String
- **Description**: SMTP authentication password
- **Example**: `EMAIL_PASS=your-email-password`

### Amazon SES Configuration (when EMAIL_PROVIDER=ses)

#### SES_FROM_EMAIL
- **Type**: String (Email)
- **Description**: Verified sender email address for Amazon SES
- **Example**: `SES_FROM_EMAIL=noreply@yourdomain.com`

### Microsoft Exchange Configuration (when EMAIL_PROVIDER=exchange)

#### EXCHANGE_HOST
- **Type**: String
- **Description**: Exchange server hostname
- **Example**: `EXCHANGE_HOST=mail.yourdomain.com`

#### EXCHANGE_PORT
- **Type**: Number
- **Default**: `587`
- **Description**: Exchange server port
- **Example**: `EXCHANGE_PORT=587`

#### EXCHANGE_USER
- **Type**: String
- **Description**: Exchange authentication username
- **Example**: `EXCHANGE_USER=your-exchange-username`

#### EXCHANGE_PASS
- **Type**: String
- **Description**: Exchange authentication password
- **Example**: `EXCHANGE_PASS=your-exchange-password`

#### EXCHANGE_FROM_EMAIL
- **Type**: String (Email)
- **Description**: Sender email address for Exchange
- **Example**: `EXCHANGE_FROM_EMAIL=noreply@yourdomain.com`

#### EXCHANGE_REJECT_UNAUTHORIZED
- **Type**: Boolean
- **Default**: `true`
- **Description**: Whether to reject self-signed certificates
- **Security**: Set to `false` only for development with self-signed certificates
- **Example**: `EXCHANGE_REJECT_UNAUTHORIZED=true`

## DocuSign Configuration

### DOCUSIGN_CLIENT_ID
- **Type**: String
- **Description**: DocuSign application integration key
- **Where to find**: DocuSign Admin > Apps and Keys
- **Example**: `DOCUSIGN_CLIENT_ID=your-docusign-client-id`

### DOCUSIGN_CLIENT_SECRET
- **Type**: String
- **Description**: DocuSign application secret key
- **Security**: Keep this secure and never commit to version control
- **Example**: `DOCUSIGN_CLIENT_SECRET=your-docusign-client-secret`

### DOCUSIGN_ACCOUNT_ID
- **Type**: String
- **Description**: DocuSign account ID
- **Where to find**: DocuSign Admin > Account Information
- **Example**: `DOCUSIGN_ACCOUNT_ID=your-account-id`

### DOCUSIGN_BASE_URI
- **Type**: String (URL)
- **Default**: `https://demo.docusign.net/restapi` (demo)
- **Production**: `https://na4.docusign.net/restapi`
- **Description**: DocuSign API base URL
- **Example**: `DOCUSIGN_BASE_URI=https://demo.docusign.net/restapi`

### DOCUSIGN_AUTH_BASE_URI
- **Type**: String (URL)
- **Default**: `https://account-d.docusign.com` (demo)
- **Production**: `https://account.docusign.com`
- **Description**: DocuSign authentication base URL
- **Example**: `DOCUSIGN_AUTH_BASE_URI=https://account-d.docusign.com`

### DOCUSIGN_REDIRECT_URI
- **Type**: String (URL)
- **Description**: OAuth callback URL registered with DocuSign
- **Example**: `DOCUSIGN_REDIRECT_URI=https://wavemax.promo/api/v1/auth/docusign/callback`

### DOCUSIGN_TEMPLATE_ID
- **Type**: String
- **Description**: DocuSign W9 template ID
- **Where to find**: DocuSign > Templates
- **Example**: `DOCUSIGN_TEMPLATE_ID=your-w9-template-id`

### DOCUSIGN_USER_ID
- **Type**: String
- **Description**: DocuSign user ID for JWT authentication
- **Example**: `DOCUSIGN_USER_ID=your-docusign-user-id`

## Payment Configuration

### Paygistix Configuration

#### PAYGISTIX_ENVIRONMENT
- **Type**: String
- **Values**: `production`, `sandbox`
- **Default**: `production`
- **Description**: Paygistix environment to use
- **Example**: `PAYGISTIX_ENVIRONMENT=production`

#### PAYGISTIX_MERCHANT_ID
- **Type**: String
- **Required**: Yes
- **Description**: Your Paygistix merchant ID
- **Where to find**: Paygistix Dashboard > Account Settings
- **Example**: `PAYGISTIX_MERCHANT_ID=wmaxaustWEB`

#### PAYGISTIX_FORM_ID
- **Type**: String
- **Required**: Yes
- **Description**: Paygistix hosted form ID
- **Where to find**: Paygistix Dashboard > Hosted Forms
- **Example**: `PAYGISTIX_FORM_ID=55015901455`

#### PAYGISTIX_FORM_HASH
- **Type**: String
- **Required**: Yes
- **Description**: Security hash for the hosted form
- **Security**: Keep this secure
- **Example**: `PAYGISTIX_FORM_HASH=c701523a33721cdbe999f7a4406a0a98`

#### PAYGISTIX_FORM_ACTION_URL
- **Type**: String (URL)
- **Default**: `https://safepay.paymentlogistics.net/transaction.asp`
- **Description**: Paygistix form submission URL
- **Example**: `PAYGISTIX_FORM_ACTION_URL=https://safepay.paymentlogistics.net/transaction.asp`

#### PAYGISTIX_RETURN_URL
- **Type**: String (URL)
- **Description**: URL where users are redirected after payment
- **Example**: `PAYGISTIX_RETURN_URL=https://wavemax.promo/payment-callback-handler.html`

### QuickBooks Configuration

#### QUICKBOOKS_CLIENT_ID
- **Type**: String
- **Description**: QuickBooks OAuth client ID
- **Where to find**: QuickBooks Developer Dashboard
- **Example**: `QUICKBOOKS_CLIENT_ID=your-quickbooks-client-id`

#### QUICKBOOKS_CLIENT_SECRET
- **Type**: String
- **Description**: QuickBooks OAuth client secret
- **Security**: Keep this secure
- **Example**: `QUICKBOOKS_CLIENT_SECRET=your-quickbooks-client-secret`

## AWS Configuration

### AWS_S3_BUCKET
- **Type**: String
- **Description**: S3 bucket name for storing files (e.g., bag barcodes)
- **Example**: `AWS_S3_BUCKET=wavemax-laundry-barcodes`

### AWS_ACCESS_KEY_ID
- **Type**: String
- **Description**: AWS access key ID with S3 permissions
- **Example**: `AWS_ACCESS_KEY_ID=your-aws-access-key`

### AWS_SECRET_ACCESS_KEY
- **Type**: String
- **Description**: AWS secret access key
- **Security**: Keep this secure
- **Example**: `AWS_SECRET_ACCESS_KEY=your-aws-secret-key`

### AWS_REGION
- **Type**: String
- **Default**: `us-east-2`
- **Description**: AWS region where your S3 bucket is located
- **Example**: `AWS_REGION=us-east-2`

## Social Login Configuration

### Google OAuth

#### GOOGLE_CLIENT_ID
- **Type**: String
- **Description**: Google OAuth 2.0 client ID
- **Where to find**: Google Cloud Console > APIs & Services > Credentials
- **Example**: `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`

#### GOOGLE_CLIENT_SECRET
- **Type**: String
- **Description**: Google OAuth 2.0 client secret
- **Security**: Keep this secure
- **Example**: `GOOGLE_CLIENT_SECRET=your-google-client-secret`

### Facebook OAuth

#### FACEBOOK_APP_ID
- **Type**: String
- **Description**: Facebook application ID
- **Where to find**: Facebook Developers > Your App > Settings > Basic
- **Example**: `FACEBOOK_APP_ID=your-facebook-app-id`

#### FACEBOOK_APP_SECRET
- **Type**: String
- **Description**: Facebook application secret
- **Security**: Keep this secure
- **Example**: `FACEBOOK_APP_SECRET=your-facebook-app-secret`

### LinkedIn OAuth

#### LINKEDIN_CLIENT_ID
- **Type**: String
- **Description**: LinkedIn OAuth client ID
- **Where to find**: LinkedIn Developer Portal > Your App
- **Example**: `LINKEDIN_CLIENT_ID=your-linkedin-client-id`

#### LINKEDIN_CLIENT_SECRET
- **Type**: String
- **Description**: LinkedIn OAuth client secret
- **Security**: Keep this secure
- **Example**: `LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret`

### OAUTH_CALLBACK_URI
- **Type**: String (URL)
- **Description**: Base URL for OAuth provider callbacks
- **Example**: `OAUTH_CALLBACK_URI=https://wavemax.promo`

## Rate Limiting

### RELAX_RATE_LIMITING
- **Type**: Boolean
- **Default**: `false`
- **Description**: Relaxes API rate limiting for development/testing
- **Security**: Should be `false` in production
- **Example**: `RELAX_RATE_LIMITING=false`

## CORS Configuration

### CORS_ORIGIN
- **Type**: String (Comma-separated URLs)
- **Description**: Allowed origins for CORS requests
- **Example**: `CORS_ORIGIN=https://yourdomain.com,http://localhost:3000`

## Business Configuration

### BAG_FEE
- **Type**: Number
- **Default**: `500`
- **Description**: Bag fee amount in cents (500 = $5.00)
- **Example**: `BAG_FEE=500`

## Default Accounts

### DEFAULT_ADMIN_EMAIL
- **Type**: String (Email)
- **Default**: `admin@wavemaxlaundry.com`
- **Description**: Email for the default administrator account created during initialization
- **Example**: `DEFAULT_ADMIN_EMAIL=admin@wavemaxlaundry.com`

### DEFAULT_OPERATOR_ID
- **Type**: String
- **Default**: `OP-DEFAULT-001`
- **Description**: ID for the default operator account
- **Example**: `DEFAULT_OPERATOR_ID=OP-DEFAULT-001`

## Development Settings

### ENABLE_IFRAME_DEMO
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enables iframe embedding for development demos by modifying CSP headers
- **Security**: Should be `false` in production
- **Example**: `ENABLE_IFRAME_DEMO=false`

## Best Practices

1. **Security**:
   - Never commit `.env` files to version control
   - Use strong, randomly generated secrets
   - Rotate secrets regularly
   - Use different values for each environment

2. **Organization**:
   - Keep related variables grouped together
   - Use clear, descriptive variable names
   - Document any non-obvious values

3. **Validation**:
   - Always validate environment variables at startup
   - Provide clear error messages for missing required variables
   - Use sensible defaults where appropriate

4. **Deployment**:
   - Use environment-specific configuration files
   - Consider using a secrets management service
   - Automate secret rotation where possible
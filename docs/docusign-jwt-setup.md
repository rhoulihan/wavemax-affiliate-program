# DocuSign JWT Grant Setup Guide

## In the DocuSign Admin Console:

### 1. Enable JWT Grant
When viewing your app with Integration Key `d625bca0-872f-4282-a6b8-bfc47a03b866`:

1. Look for an **"Authentication"** or **"Auth Grant Types"** section
2. You should see checkboxes for different authentication methods:
   - ✅ **JWT Grant** (this must be checked)
   - Authorization Code Grant
   - Implicit Grant

3. If JWT Grant is not checked, click to enable it

### 2. Add/Verify RSA Public Key
1. Look for a section called **"RSA Keypairs"** or **"Public Keys"**
2. You should see an option to **"Add RSA Keypair"** or **"Add Public Key"**
3. If a key already exists, verify it matches your private key
4. If you need to add a new key:
   - Click "Add RSA Keypair" or "Generate"
   - Copy the PUBLIC key (not the private key)

### 3. Grant User Consent
After JWT is enabled, you need to grant consent:

1. Look for a **"Service Integration"** or **"Consent"** section
2. Find options for:
   - **"Grant consent on behalf of your organization"**
   - **"Grant individual consent"**

3. Click the appropriate consent option
4. You'll be redirected to grant permissions for:
   - Signature (`signature`)
   - Impersonation (`impersonation`)

### 4. Verify User Application Consent
1. In the app settings, look for **"User Application Consent"** or similar
2. Ensure consent is granted for User ID: `1216a2b8-e086-4414-bec7-584ea09923b4`

## Quick Verification Steps:

✅ JWT Grant checkbox is enabled
✅ RSA Public Key is uploaded
✅ Consent has been granted (either organizational or individual)
✅ The scopes include "signature" and "impersonation"

## After Setup:
Once these steps are complete, run:
```bash
node scripts/test-docusign-config.js
```

The authentication should now work!
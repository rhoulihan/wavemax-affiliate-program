# WaveMAX Email Configuration with Mailcow

## Current Status
- ✅ Mailcow is installed and running
- ✅ Let's Encrypt certificate obtained for mail.wavemax.promo
- ✅ All services are running
- ⚠️ Email authentication needs to be configured through web interface

## Access Mailcow Admin Panel
1. Visit: https://mail.wavemax.promo:8443
2. Login with:
   - Username: `admin`
   - Password: `admin123` (TEMPORARY PASSWORD - CHANGE THIS IMMEDIATELY!)

## Create Email Account for Application

### Option 1: Through Web Interface (Recommended)
1. Log into Mailcow admin panel
2. Go to "Mailboxes" → "Add mailbox"
3. Create mailbox with:
   - Username: `no-reply`
   - Domain: `wavemax.promo`
   - Password: `zsUoLLT4pcNIznRbYRWK` (or choose your own)
   - Full name: `No Reply`
4. Click "Add"

### Option 2: Update Existing Mailbox Password
If the mailbox already exists but authentication fails:
1. Go to "Mailboxes" in admin panel
2. Find `no-reply@wavemax.promo`
3. Click edit (pencil icon)
4. Set new password: `zsUoLLT4pcNIznRbYRWK`
5. Save changes

## Application Configuration
The WaveMAX application is already configured in `.env`:
```
EMAIL_PROVIDER=smtp
EMAIL_USER=no-reply@wavemax.promo
EMAIL_PASS=zsUoLLT4pcNIznRbYRWK
EMAIL_HOST=mail.wavemax.promo
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_FROM=no-reply@wavemax.promo
```

## Testing Email Configuration
Once the mailbox is created/updated through the web interface:
```bash
node scripts/test-mailcow-email.js
```

## Alternative: Create Additional Email Accounts
You may want to create these additional accounts:
- `admin@wavemax.promo` - For admin notifications
- `support@wavemax.promo` - For customer support
- `info@wavemax.promo` - For general inquiries

## DNS Configuration (Already Set)
- MX record: Points to mail.wavemax.promo
- A record: mail.wavemax.promo points to server IP

## Next Steps for Full Configuration
1. Add SPF record: `wavemax.promo. TXT "v=spf1 mx a ~all"`
2. Add DMARC record: `_dmarc.wavemax.promo. TXT "v=DMARC1; p=none; rua=mailto:postmaster@wavemax.promo"`
3. Configure DKIM in Mailcow admin panel under Configuration → DKIM keys

## Troubleshooting
If email authentication continues to fail:
1. Check Dovecot logs: `docker logs mailcowdockerized-dovecot-mailcow-1`
2. Verify mailbox exists: Login to Mailcow admin and check Mailboxes
3. Ensure password in .env matches the one set in Mailcow
4. Restart application after changes: `pm2 restart wavemax --update-env`
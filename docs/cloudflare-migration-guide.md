# Cloudflare Migration Guide for wavemax.promo

## Current DNS Records (As of 2025-11-22)

Before migrating to Cloudflare, here are the current DNS records that need to be replicated:

### A Records
- `wavemax.promo` → `158.62.198.7`
- `www.wavemax.promo` → `158.62.198.7` (CNAME to wavemax.promo)
- `mail.wavemax.promo` → `158.62.198.7`

### MX Records (Mail Exchange)
- Priority 10: `mail.wavemax.promo`
- Priority 15: `wavemax.promo`

### TXT Records
- **SPF**: `v=spf1 a mx ip4:158.62.198.7 ~all`
- **DMARC** (_dmarc.wavemax.promo): `v=DMARC1; p=quarantine; rua=mailto:admin@wavemax.promo; pct=100`

### Current Nameservers (Ultahost)
- ns1.ultahost.com
- ns2.ultahost.com
- ns3.ultahost.com
- ns4.ultahost.com

## Migration Steps

### Step 1: Add Domain to Cloudflare

1. Log in to your Cloudflare account at https://dash.cloudflare.com
2. Click "Add a Site" or "Add Site" button
3. Enter: `wavemax.promo`
4. Click "Add site"
5. Select your plan (Free plan is sufficient to start)
6. Click "Continue"

### Step 2: Review and Add DNS Records

Cloudflare will attempt to scan your existing DNS records. Verify and add the following if missing:

#### A Records
```
Type: A
Name: @ (or wavemax.promo)
IPv4 address: 158.62.198.7
Proxy status: Proxied (orange cloud) ✓
TTL: Auto
```

```
Type: A
Name: www
IPv4 address: 158.62.198.7
Proxy status: Proxied (orange cloud) ✓
TTL: Auto
```

```
Type: A
Name: mail
IPv4 address: 158.62.198.7
Proxy status: DNS only (grey cloud) ⚠️
TTL: Auto
```
**Important**: Mail subdomain should be DNS only (not proxied) to avoid email delivery issues.

#### MX Records
```
Type: MX
Name: @ (or wavemax.promo)
Mail server: mail.wavemax.promo
Priority: 10
TTL: Auto
```

```
Type: MX
Name: @ (or wavemax.promo)
Mail server: wavemax.promo
Priority: 15
TTL: Auto
```

#### TXT Records
```
Type: TXT
Name: @ (or wavemax.promo)
Content: v=spf1 a mx ip4:158.62.198.7 ~all
TTL: Auto
```

```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:admin@wavemax.promo; pct=100
TTL: Auto
```

### Step 3: Configure Cloudflare Settings

Before changing nameservers, configure these important settings:

#### SSL/TLS Settings
1. Go to SSL/TLS → Overview
2. Set encryption mode to **"Full (strict)"** if you have a valid SSL certificate on your server
   - If unsure, use **"Flexible"** temporarily, then upgrade to "Full (strict)" once confirmed
3. Enable "Always Use HTTPS" under SSL/TLS → Edge Certificates

#### Caching Settings
1. Go to Caching → Configuration
2. Set Browser Cache TTL to 4 hours or higher
3. Consider enabling "Development Mode" initially (disables caching for 3 hours) to test

#### Security Settings
1. Go to Security → Settings
2. Set Security Level to "Medium" (adjust as needed)
3. Enable "Browser Integrity Check"
4. Consider enabling "Email Address Obfuscation"

#### Speed Optimization
1. Go to Speed → Optimization
2. Enable "Auto Minify" for JavaScript, CSS, and HTML
3. Enable "Brotli" compression
4. Consider enabling "Rocket Loader" (test carefully as it may break some scripts)

### Step 4: Update Nameservers

Cloudflare will provide you with two nameservers (they look like this):
- `aisha.ns.cloudflare.com`
- `tom.ns.cloudflare.com`

(Your actual nameservers will be different)

#### Update at Your Domain Registrar
1. Log in to where you purchased wavemax.promo (likely Ultahost or another registrar)
2. Find DNS/Nameserver settings
3. Replace the current nameservers:
   ```
   REMOVE:
   - ns1.ultahost.com
   - ns2.ultahost.com
   - ns3.ultahost.com
   - ns4.ultahost.com

   ADD (use the ones Cloudflare gives you):
   - [cloudflare-ns1].ns.cloudflare.com
   - [cloudflare-ns2].ns.cloudflare.com
   ```
4. Save changes

### Step 5: Wait for DNS Propagation

- DNS changes can take 24-48 hours to propagate globally
- Typically happens in 1-4 hours
- You can check status at:
  - Cloudflare dashboard (it will show "Active" when complete)
  - https://www.whatsmydns.net/#NS/wavemax.promo

### Step 6: Verify Configuration

Once Cloudflare shows "Active", verify everything works:

```bash
# Check nameservers
dig wavemax.promo NS +short

# Check A records
dig wavemax.promo A +short
dig www.wavemax.promo A +short
dig mail.wavemax.promo A +short

# Check MX records
dig wavemax.promo MX +short

# Test website
curl -I https://wavemax.promo
curl -I https://www.wavemax.promo

# Test mail server
telnet mail.wavemax.promo 25
```

### Step 7: Post-Migration Configuration

After migration is complete:

1. **Disable Development Mode** (if enabled)
2. **Enable Additional Features**:
   - Page Rules (if needed for specific redirects)
   - WAF (Web Application Firewall) rules
   - Rate limiting rules
3. **Monitor Performance**:
   - Check Analytics in Cloudflare dashboard
   - Monitor for any 520/521/522 errors (origin connection issues)
4. **Update SSL/TLS**:
   - If using "Flexible", upgrade to "Full (strict)" once you confirm HTTPS works
   - Install Cloudflare Origin CA certificate on your server for maximum security

## Important Notes

### Email Considerations
- **DO NOT proxy mail.wavemax.promo** (keep it DNS only/grey cloud)
- MX records automatically cannot be proxied
- Keep SPF and DMARC records exactly as they are

### Testing Before Full Migration
- You can test Cloudflare before changing nameservers by:
  1. Adding A records in Cloudflare
  2. Modifying your local `/etc/hosts` file to point to Cloudflare's IP
  3. Testing the website
  4. Once confirmed, proceed with nameserver change

### Rollback Plan
If you need to rollback:
1. Go back to your domain registrar
2. Change nameservers back to Ultahost:
   - ns1.ultahost.com
   - ns2.ultahost.com
   - ns3.ultahost.com
   - ns4.ultahost.com
3. Wait for DNS propagation (1-4 hours typically)

## Common Issues and Solutions

### Issue: 520/521/522 Errors
**Cause**: Cloudflare can't connect to your origin server
**Solution**:
- Verify your origin IP (158.62.198.7) is correct
- Ensure firewall allows Cloudflare IPs
- Check SSL/TLS encryption mode matches your server config

### Issue: Website in redirect loop
**Cause**: SSL/TLS mode mismatch
**Solution**: Change SSL/TLS mode from "Flexible" to "Full" or vice versa

### Issue: Email not working
**Cause**: Mail subdomain is proxied
**Solution**: Set mail.wavemax.promo to DNS only (grey cloud)

## Cloudflare IP Ranges to Whitelist (Optional)

If you want to restrict access to your origin server to only Cloudflare IPs:

```bash
# IPv4
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
```

Add these to your firewall rules on the server if needed.

## Contact and Support

- Cloudflare Support: https://support.cloudflare.com
- Cloudflare Community: https://community.cloudflare.com
- Emergency: Keep Ultahost nameservers documented for quick rollback

---

**Migration Prepared**: 2025-11-22
**Current Server IP**: 158.62.198.7
**Current Provider**: Ultahost

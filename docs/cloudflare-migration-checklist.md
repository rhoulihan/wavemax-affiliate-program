# Cloudflare Migration Checklist - wavemax.promo

## Pre-Migration

- [ ] Review current DNS records in docs/cloudflare-migration-guide.md
- [ ] Have access to domain registrar account (to change nameservers)
- [ ] Create/login to Cloudflare account at https://dash.cloudflare.com
- [ ] Backup current DNS settings from Ultahost control panel
- [ ] Note current TTL values (currently 14400 seconds / 4 hours)

## During Migration

### 1. Add Site to Cloudflare
- [ ] Click "Add Site" in Cloudflare dashboard
- [ ] Enter: wavemax.promo
- [ ] Select Free plan (or preferred plan)
- [ ] Click "Continue"

### 2. Add DNS Records in Cloudflare

#### A Records
- [ ] @ → 158.62.198.7 (Proxied ✓)
- [ ] www → 158.62.198.7 (Proxied ✓)
- [ ] mail → 158.62.198.7 (DNS only ⚠️ - IMPORTANT!)

#### MX Records
- [ ] @ → mail.wavemax.promo (Priority: 10)
- [ ] @ → wavemax.promo (Priority: 15)

#### TXT Records
- [ ] @ → v=spf1 a mx ip4:158.62.198.7 ~all
- [ ] _dmarc → v=DMARC1; p=quarantine; rua=mailto:admin@wavemax.promo; pct=100

### 3. Configure Cloudflare Settings

#### SSL/TLS (Required)
- [ ] Go to SSL/TLS → Overview
- [ ] Set encryption mode to "Full (strict)" or "Flexible"
- [ ] Enable "Always Use HTTPS"

#### Security (Recommended)
- [ ] Set Security Level to "Medium"
- [ ] Enable "Browser Integrity Check"

#### Speed (Optional)
- [ ] Enable Auto Minify (JS, CSS, HTML)
- [ ] Enable Brotli compression

#### Development Mode (Recommended for Testing)
- [ ] Enable Development Mode (disables caching for 3 hours)
- [ ] This helps test changes without cache interference

### 4. Update Nameservers

- [ ] Note Cloudflare nameservers provided (e.g., aisha.ns.cloudflare.com, tom.ns.cloudflare.com)
- [ ] Log in to domain registrar (Ultahost or wherever wavemax.promo is registered)
- [ ] Navigate to DNS/Nameserver settings
- [ ] Remove old nameservers:
  - [ ] ns1.ultahost.com
  - [ ] ns2.ultahost.com
  - [ ] ns3.ultahost.com
  - [ ] ns4.ultahost.com
- [ ] Add new Cloudflare nameservers (the ones Cloudflare provided)
- [ ] Save changes
- [ ] Note time of change: _______________

### 5. Monitor Propagation

- [ ] Check Cloudflare dashboard for "Active" status
- [ ] Run: `dig wavemax.promo NS +short` (should show Cloudflare nameservers)
- [ ] Check propagation: https://www.whatsmydns.net/#NS/wavemax.promo
- [ ] Estimated completion time: 1-4 hours (can take up to 24-48 hours)

## Post-Migration Testing

### DNS Verification
- [ ] `dig wavemax.promo A +short` returns 158.62.198.7
- [ ] `dig www.wavemax.promo A +short` returns 158.62.198.7 (or Cloudflare IP if proxied)
- [ ] `dig mail.wavemax.promo A +short` returns 158.62.198.7
- [ ] `dig wavemax.promo MX +short` shows both MX records
- [ ] `dig wavemax.promo TXT +short` shows SPF record

### Website Testing
- [ ] https://wavemax.promo loads correctly
- [ ] https://www.wavemax.promo loads correctly
- [ ] Test affiliate embed: https://wavemax.promo/embed-app-v2.html?route=/affiliate-landing
- [ ] Test self-serve page: https://wavemax.promo/embed-app-v2.html?route=/self-serve-laundry
- [ ] Test customer dashboard: https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard
- [ ] Check SSL certificate (should show Cloudflare certificate)
- [ ] Verify no redirect loops
- [ ] Check browser console for no errors

### Email Testing
- [ ] Send test email TO wavemax.promo domain
- [ ] Send test email FROM wavemax.promo domain
- [ ] Verify mail.wavemax.promo is not proxied (grey cloud) in Cloudflare
- [ ] Test: `telnet mail.wavemax.promo 25` (should connect)
- [ ] Verify SPF record: https://mxtoolbox.com/spf.aspx
- [ ] Verify DMARC record: https://mxtoolbox.com/dmarc.aspx

### Performance Testing
- [ ] Check page load speed: https://www.webpagetest.org
- [ ] Verify Cloudflare is caching static assets (check response headers)
- [ ] Test from multiple geographic locations

## Post-Migration Configuration

### After Successful Testing
- [ ] Disable Development Mode in Cloudflare
- [ ] Review Analytics in Cloudflare dashboard
- [ ] Set up any needed Page Rules
- [ ] Configure rate limiting if needed
- [ ] Set up notifications/alerts in Cloudflare

### Security Enhancements (Optional)
- [ ] Install Cloudflare Origin CA certificate on server
- [ ] Upgrade SSL/TLS to "Full (strict)" if not already
- [ ] Configure firewall to only allow Cloudflare IPs (see migration guide)
- [ ] Enable WAF (Web Application Firewall) rules
- [ ] Set up Bot Fight Mode

## Rollback Plan (If Needed)

If issues occur:
- [ ] Log in to domain registrar
- [ ] Change nameservers back to Ultahost:
  - ns1.ultahost.com
  - ns2.ultahost.com
  - ns3.ultahost.com
  - ns4.ultahost.com
- [ ] Wait 1-4 hours for propagation
- [ ] Verify rollback: `dig wavemax.promo NS +short`

## Notes and Issues

**Migration Started**: _______________
**Nameservers Changed**: _______________
**Migration Completed**: _______________

**Issues Encountered**:
-
-
-

**Resolution Steps**:
-
-
-

## References

- Full Migration Guide: docs/cloudflare-migration-guide.md
- Cloudflare Dashboard: https://dash.cloudflare.com
- DNS Propagation Checker: https://www.whatsmydns.net
- Cloudflare Support: https://support.cloudflare.com

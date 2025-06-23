# Mailcow Installation Summary

## Installation Date
2025-06-23

## Access Information
- **Web Interface**: https://mail.wavemax.promo:8443 or https://[server-ip]:8443
- **Default Admin**: 
  - Username: `admin`
  - Password: `moohoo` (CHANGE THIS IMMEDIATELY!)

## Configuration
- **Hostname**: mail.wavemax.promo
- **Web Ports**: 8080 (HTTP), 8443 (HTTPS)
- **Email Ports**: 25, 587, 465 (SMTP), 143, 993 (IMAP), 110, 995 (POP3)
- **Installation Path**: /opt/mailcow-dockerized

## Services Running
All Mailcow services are running in Docker containers:
- Postfix (SMTP server)
- Dovecot (IMAP/POP3 server)
- Rspamd (spam filter)
- ClamAV (antivirus)
- SOGo (webmail and groupware)
- MySQL (database)
- Redis (cache)
- Nginx (web server)
- ACME (Let's Encrypt certificates)

## Next Steps

### 1. Access the Web Interface
Visit https://mail.wavemax.promo:8443 and log in with the default credentials.

### 2. Change Admin Password
Immediately change the default admin password after first login.

### 3. Configure DNS Records
Add these DNS records for your domain:

```
# MX Record (already configured)
wavemax.promo.    MX    10    mail.wavemax.promo.

# SPF Record
wavemax.promo.    TXT    "v=spf1 mx a ~all"

# DMARC Record
_dmarc.wavemax.promo.    TXT    "v=DMARC1; p=none; rua=mailto:postmaster@wavemax.promo"

# DKIM (will be generated after domain creation in Mailcow)
# Check Admin > Configuration > DKIM keys after adding domain
```

### 4. Add Your Domain
1. Log into Mailcow admin panel
2. Go to "Domains" section
3. Add "wavemax.promo" as a new domain
4. Configure domain settings

### 5. Create Email Accounts
1. Go to "Mailboxes" section
2. Create email accounts as needed (e.g., info@wavemax.promo, support@wavemax.promo)

### 6. Configure WaveMAX Application
Update the WaveMAX application to use the local mail server:
- SMTP Host: mail.wavemax.promo
- SMTP Port: 587 (with STARTTLS) or 465 (SSL)
- Use authentication with created mailbox credentials

## Security Notes
- Firewall rules have been updated to allow mail server traffic
- SSL certificates will be automatically obtained via Let's Encrypt
- Ensure to keep Mailcow updated regularly

## Maintenance
- Logs: `docker compose -f /opt/mailcow-dockerized/docker-compose.yml logs [service-name]`
- Updates: Follow official Mailcow update procedures
- Backups: Regular backups of /opt/mailcow-dockerized/data directory recommended
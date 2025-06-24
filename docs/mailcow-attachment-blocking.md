# Mailcow Attachment Blocking Configuration

## Overview

All email attachments are blocked at the SMTP level using Postfix MIME header checks. This configuration rejects emails with attachments before they enter the mail system.

## Implementation Details

### Configuration Files

1. **MIME Header Checks Rules**: `/opt/postfix/conf/mime_header_checks.pcre`
   - Inside container: `/opt/postfix/conf/mime_header_checks.pcre`
   - Persistent copy: `/opt/mailcow-dockerized/data/conf/postfix/mime_header_checks.pcre`

2. **Postfix Configuration**: `/opt/mailcow-dockerized/data/conf/postfix/extra.cf`
   - Contains: `mime_header_checks = pcre:/opt/postfix/conf/mime_header_checks.pcre`

### Blocking Rules

The following PCRE patterns block all attachments:

```
# Matches Content-Disposition: attachment header
/^Content-Disposition:.*attachment/i REJECT All attachments are blocked by policy

# Matches Content-Type headers with name parameter (inline attachments)
/^Content-Type:.*name=/i REJECT All attachments are blocked by policy
```

### How It Works

1. **Content-Disposition Rule**: Blocks traditional attachments that use the `Content-Disposition: attachment` header
2. **Content-Type Rule**: Blocks inline attachments that specify a filename in the `Content-Type` header

### What Gets Blocked

- All file attachments (PDFs, documents, images, etc.)
- Inline images with filenames
- Any MIME part with a filename

### What Still Works

- Plain text emails
- HTML emails without attachments
- Inline images without filenames (rare)

## Testing

To test if attachment blocking is working:

```bash
# Test attachment header
sudo docker exec mailcowdockerized-postfix-mailcow-1 \
  postmap -q "Content-Disposition: attachment; filename=test.pdf" \
  pcre:/opt/postfix/conf/mime_header_checks.pcre

# Test inline attachment
sudo docker exec mailcowdockerized-postfix-mailcow-1 \
  postmap -q "Content-Type: application/pdf; name=document.pdf" \
  pcre:/opt/postfix/conf/mime_header_checks.pcre
```

Both should return: `REJECT All attachments are blocked by policy`

## Sender Experience

When someone tries to send an email with attachments to your domain, they will receive a bounce message:

```
550 5.7.1 All attachments are blocked by policy
```

## Modifying the Configuration

### To Disable Attachment Blocking

1. Remove the configuration line from extra.cf:
```bash
sudo sed -i '/mime_header_checks/d' /opt/mailcow-dockerized/data/conf/postfix/extra.cf
```

2. Restart Postfix:
```bash
sudo docker-compose -f /opt/mailcow-dockerized/docker-compose.yml restart postfix-mailcow
```

### To Allow Specific File Types

Modify `/opt/mailcow-dockerized/data/conf/postfix/mime_header_checks.pcre` to add exceptions:

```
# Allow text files
!/^Content-Type:.*text\/plain.*name=.*\.txt/i OK

# Block all other attachments
/^Content-Disposition:.*attachment/i REJECT All attachments are blocked by policy
/^Content-Type:.*name=/i REJECT All attachments are blocked by policy
```

## Why This Configuration?

1. **Security**: Prevents malware and viruses from entering via email
2. **Storage**: Saves disk space by rejecting attachments at SMTP level
3. **Performance**: Reduces processing overhead (no need for ClamAV)
4. **Compliance**: May be required by security policies

## Maintenance

The configuration persists across container restarts because:
- Rules are stored in `/opt/mailcow-dockerized/data/conf/postfix/`
- Configuration is added to `extra.cf` which is loaded by Postfix

No additional maintenance is required unless you want to modify the blocking rules.
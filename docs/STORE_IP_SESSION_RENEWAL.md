# Store IP Session Renewal Documentation

## Overview

The WaveMAX Affiliate Program now supports automatic session renewal for operators working from trusted store IP addresses. This prevents operator sessions from timing out during their work shifts at physical store locations.

## How It Works

1. **IP Whitelisting**: Store IP addresses are configured in the environment variables
2. **Token Check**: On each authenticated request, the middleware checks if:
   - The user is an operator
   - The request comes from a whitelisted store IP
   - The token is close to expiring (within 30 minutes by default)
3. **Automatic Renewal**: If all conditions are met, a new token is generated with extended expiration
4. **Client Update**: The new token is sent in response headers and automatically updated in the client

## Configuration

The system uses the existing `STORE_IP_ADDRESS` environment variable, plus additional optional variables:

```bash
# Primary store IP (already exists in .env)
STORE_IP_ADDRESS=70.114.167.145

# Optional: Additional store IPs (comma-separated)
ADDITIONAL_STORE_IPS=192.168.1.100,10.0.0.50

# Optional: Comma-separated list of trusted store IP ranges (CIDR notation)
STORE_IP_RANGES=192.168.1.0/24,10.0.0.0/16

# Optional: Session renewal settings (defaults shown)
STORE_SESSION_CHECK_INTERVAL=300000      # 5 minutes in milliseconds
STORE_SESSION_RENEW_THRESHOLD=1800000    # 30 minutes in milliseconds
STORE_SESSION_MAX_DURATION=86400000      # 24 hours in milliseconds
```

## Implementation Details

### Server-Side (auth.js middleware)

The authentication middleware:
1. Extracts client IP from request headers (supports proxy headers)
2. Checks if IP is in the whitelist using `storeIPConfig.isWhitelisted()`
3. If operator + whitelisted IP + token expiring soon:
   - Generates new JWT token with 24-hour expiration
   - Adds `X-Renewed-Token` and `X-Token-Renewed` headers to response

### Client-Side (operator-scan-init.js)

The operator scanner interface:
1. Checks response headers for `X-Token-Renewed: true`
2. If present, extracts new token from `X-Renewed-Token` header
3. Updates localStorage with the new token
4. All subsequent requests use the renewed token

## Security Considerations

1. **IP Spoofing**: In production, ensure proper proxy configuration to prevent IP header spoofing
2. **Token Rotation**: Consider implementing refresh token rotation for enhanced security
3. **Monitoring**: Log all token renewals for audit purposes
4. **Network Security**: Ensure store networks are properly secured

## Troubleshooting

### Token Not Renewing

1. Check if store IP is properly configured in environment variables
2. Verify operator role is correctly set in JWT
3. Check server logs for renewal attempts
4. Ensure proxy headers are properly forwarded

### IP Detection Issues

If client IP is not detected correctly:
1. Check proxy/load balancer configuration
2. Ensure `X-Forwarded-For` or `X-Real-IP` headers are set
3. Review nginx/Apache configuration for proper header forwarding

## Example nginx Configuration

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

## Testing

To test the feature:
1. Add your development machine IP to `STORE_IP_WHITELIST`
2. Log in as an operator
3. Wait for token to be within renewal threshold
4. Make any API request
5. Check browser console for "Token renewed by server" message
6. Verify localStorage contains updated token
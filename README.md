# WaveMAX Laundry Affiliate Program

This repository contains a complete solution for the WaveMAX Laundry affiliate program, allowing individuals to register as affiliates and provide pickup/delivery services for WaveMAX's wash, dry, fold laundry services.

## Overview

The WaveMAX Affiliate Program enables individuals to register as affiliates, onboard their own customers, and manage pickup and delivery of laundry for WaveMAX's wash, dry, fold (WDF) services. Affiliates earn 10% commission on all WDF orders plus any markup they set for delivery services.

### Key Features

- **Affiliate Registration & Management**: Complete onboarding and management system for affiliates
- **Customer Registration**: Allow affiliates to register customers using unique affiliate links
- **Order Management**: Schedule pickups, track order status, and manage deliveries
- **Laundry Bag Tracking**: Track customer bags with barcodes for accurate order processing
- **Secure Payments**: Encrypted payment processing with PCI-compliant storage
- **Dashboard Analytics**: Comprehensive metrics for both affiliates and customers with visual charts
- **Email Notifications**: Automated emails for all important events in the lifecycle
- **Advanced Security**: Industry-standard security features including JWT, CSRF protection, and audit logging
- **API Versioning**: Future-proof API design with version management

## Recent Improvements (January 2025)

### Embedded-Only Deployment
- **Simplified Architecture**: Converted to embedded-only deployment, removing all standalone HTML files
- **Single Entry Point**: All functionality now operates through `embed-app.html` with route-based navigation
- **Consistent CSP Compliance**: All navigation uses postMessage API for compatibility with strict CSP environments
- **Reduced Codebase**: Eliminated duplicate standalone/embedded versions, reducing maintenance overhead
- **Unified User Experience**: Single, consistent interface for all users regardless of deployment context

### Security Enhancements
- **Enhanced Authentication**: JWT tokens reduced from 7 days to 1 hour with secure refresh token rotation
- **Input Sanitization**: Added XSS and NoSQL injection prevention middleware
- **CSRF Protection**: Enabled for all state-changing API operations
- **Password Security**: Increased PBKDF2 iterations from 10,000 to 100,000
- **Audit Logging**: Comprehensive security event logging for compliance
- **Field-Level Access Control**: Role-based API response filtering
- **Error Handling**: Secure error messages that don't expose internal details

### Infrastructure Improvements
- **API Versioning**: Implemented /api/v1/ structure for backward compatibility
- **HTTPS Enforcement**: Automatic redirect in production environments
- **Security Headers**: Added HSTS, X-Frame-Options, and strict CSP
- **Rate Limiting**: Enhanced protection on authentication endpoints
- **CORS Security**: Restricted to specific allowed origins only
- **AWS SDK v3**: Upgraded to latest AWS SDK for improved performance and security

### Code Quality
- **Dead Code Removal**: Removed all standalone HTML/JS files, cleaning up 4000+ lines of code
- **Dependency Updates**: Added express-mongo-sanitize and xss packages
- **Validation**: Added comprehensive input validation on all endpoints
- **Error Handling**: Centralized error handling with proper logging
- **Route-Based Navigation**: Updated all internal navigation to use routes instead of file paths
- **Test Suite Improvements**:
  - Fixed MongoDB connection conflicts in test environment
  - Added comprehensive test coverage for all controllers
  - Implemented proper test isolation with MongoDB Memory Server
  - Added unit tests for security middleware and utilities
  - Achieved 80%+ code coverage across the application

### Feature Updates
- **Landing Page Update**: Changed "5 Stars on Google" to "$0 Startup Cost" in promotional messaging
- **Customer Dashboard**: Fixed API endpoints and CSP violations
- **Customer Profile**: Added inline edit functionality for customer information updates
- **Order Management**: 
  - Added service notes section to order confirmation for special instructions
  - Fixed active orders count calculation on dashboard
  - Improved date handling with ISO8601 format conversion
  - Enhanced delivery fee calculation with better error handling
- **Payment Security**: Enhanced encryption for payment information storage
- **Refresh Tokens**: Proper implementation with 30-day expiry and rotation
- **Customer Model**: Removed redundant bags array field
- **CSP Compliance**: Moved all inline scripts to external files for security compliance

## Project Structure

```
wavemax-affiliate-program/
│
├── public/                                # Frontend HTML/CSS/JS (Embedded-Only)
│   ├── assets/                            # Static assets
│   │   └── js/
│   │       ├── components/                # Reusable components
│   │       │   ├── AffiliateMetricsDashboard.js
│   │       │   └── CustomerDashboardAnalytics.js
│   │       ├── affiliate-dashboard-init.js # Embedded dashboard
│   │       ├── affiliate-login.js         # Login functionality
│   │       ├── affiliate-register-init.js # Embedded registration
│   │       ├── affiliate-success-init.js  # Embedded success page
│   │       ├── customer-dashboard.js      # Customer dashboard
│   │       ├── customer-login.js          # Customer login
│   │       ├── customer-register.js       # Customer registration
│   │       ├── customer-success.js        # Customer success
│   │       ├── embed-navigation.js        # CSP-compliant navigation
│   │       ├── errorHandler.js            # Client-side error handling
│   │       ├── order-confirmation.js      # Order confirmation
│   │       └── schedule-pickup.js         # Pickup scheduling
│   ├── embed-app.html                     # Main application (Single Entry Point)
│   ├── embed-landing.html                 # Full embeddable landing page
│   ├── affiliate-register-embed.html      # Affiliate registration
│   ├── affiliate-login-embed.html         # Affiliate login
│   ├── affiliate-success-embed.html       # Registration success
│   ├── affiliate-dashboard-embed.html     # Affiliate dashboard
│   ├── customer-register-embed.html       # Customer registration
│   ├── customer-login-embed.html          # Customer login
│   ├── customer-success-embed.html        # Registration success
│   ├── customer-dashboard-embed.html      # Customer dashboard
│   ├── schedule-pickup-embed.html         # Pickup scheduling
│   ├── order-confirmation-embed.html      # Order confirmation
│   ├── api-docs.html                      # API documentation
│   ├── iframe-embed.html                  # Compact iframe version
│   └── embed-example.html                 # Embedding documentation
│
├── server/                                # Server-side code
│   ├── controllers/                       # API controllers
│   │   ├── affiliateController.js         
│   │   ├── authController.js              
│   │   ├── bagController.js               
│   │   ├── customerController.js          
│   │   └── orderController.js             
│   │
│   ├── middleware/                        # Express middleware
│   │   ├── auth.js                        # JWT authentication
│   │   ├── errorHandler.js                # Error handling
│   │   └── sanitization.js                # Input sanitization
│   │
│   ├── models/                            # Mongoose models
│   │   ├── Affiliate.js                   
│   │   ├── Customer.js                    
│   │   ├── Order.js                       
│   │   ├── Bag.js                         
│   │   ├── RefreshToken.js                
│   │   └── Transaction.js                 
│   │
│   ├── routes/                            # Express routes
│   │   ├── affiliateRoutes.js             
│   │   ├── authRoutes.js                  
│   │   ├── bagRoutes.js                   
│   │   ├── customerRoutes.js              
│   │   └── orderRoutes.js                 
│   │
│   ├── templates/                         # Email templates
│   │   └── emails/                        
│   │
│   └── utils/                             # Utility functions
│       ├── auditLogger.js                 # Security audit logging
│       ├── emailService.js                # Email service
│       ├── encryption.js                  # AES-256-GCM encryption
│       ├── fieldFilter.js                 # API field filtering
│       ├── logger.js                      # Winston logging
│       └── paginationMiddleware.js        
│
├── tests/                                 # Comprehensive test suite
├── .env.example                           # Environment template
├── Dockerfile                             # Docker configuration
├── docker-compose.yml                     # Docker Compose
├── ecosystem.config.js                    # PM2 configuration
├── package.json                           # Dependencies
└── server.js                              # Application entry point
```

## Technologies Used

- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript, Recharts
- **Backend**: Node.js 20, Express.js
- **Database**: MongoDB 7.0 with Mongoose ODM
- **Security**: JWT, CSRF, bcrypt, AES-256-GCM encryption
- **Email**: Amazon SES (AWS SDK v3), Nodemailer
- **Testing**: Jest, Supertest, MongoDB Memory Server
- **Deployment**: Docker, Nginx, PM2
- **Logging**: Winston with audit logging

## Security Features

### Authentication & Authorization
- JWT-based authentication with 1-hour token expiry
- Refresh token rotation with 30-day expiry
- Role-based access control (Admin, Affiliate, Customer)
- Secure password hashing with 100,000 PBKDF2 iterations

### Data Protection
- AES-256-GCM encryption for sensitive data
- Payment information encryption at rest
- Only last 4 digits of credit cards stored
- Field-level API response filtering

### Security Middleware
- CSRF protection on all state-changing operations
- XSS prevention through input sanitization
- NoSQL injection prevention
- Rate limiting on authentication endpoints
- Comprehensive request validation

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: same-origin

### Audit & Monitoring
- Security event logging
- Login attempt tracking
- Sensitive data access logging
- Suspicious activity detection

## API Documentation

### Authentication Endpoints

All API endpoints use the base URL `/api/v1/`

#### Login
```
POST /api/v1/auth/affiliate/login
POST /api/v1/auth/customer/login
```

#### Token Management
```
GET /api/v1/auth/verify
POST /api/v1/auth/refresh-token
```

#### Password Reset
```
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### Protected Endpoints

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

For state-changing operations (POST, PUT, DELETE), include CSRF token:
```
X-CSRF-Token: <csrf-token>
```

#### CSRF Token Usage

1. Fetch CSRF token from the server:
```javascript
const response = await fetch('/api/csrf-token', {
    credentials: 'include'
});
const { csrfToken } = await response.json();
```

2. Include token in subsequent requests:
```javascript
fetch('/api/v1/orders', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + authToken,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(orderData)
});
```

## Local Development Setup

### Prerequisites

- Node.js v20+
- MongoDB 7.0+
- npm or yarn

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wavemax-affiliate-program.git
   cd wavemax-affiliate-program
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Generate secure keys:
   ```bash
   # Generate encryption key
   node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate JWT secret
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   
   # Generate session secret
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `ENCRYPTION_KEY` | 32-byte hex key for encryption | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `SESSION_SECRET` | Express session secret | Yes |
| `EMAIL_PROVIDER` | Email service (ses/smtp) | Yes |
| `AWS_REGION` | AWS region for SES | If using SES |
| `AWS_ACCESS_KEY_ID` | AWS access key | If using SES |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | If using SES |
| `SES_FROM_EMAIL` | Verified sender email | Yes |
| `CORS_ORIGIN` | Allowed CORS origins | Yes |
| `LOG_LEVEL` | Logging level | No |
| `LOG_DIR` | Directory for log files | No |

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Test Coverage

The project maintains 80%+ code coverage across:
- Controllers
- Models
- Middleware
- Utilities
- API endpoints

## Production Deployment

### Using PM2

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the application:
   ```bash
   pm2 start ecosystem.config.js
   ```

3. Save PM2 configuration:
   ```bash
   pm2 startup
   pm2 save
   ```

### Using Docker

1. Build the image:
   ```bash
   docker build -t wavemax-affiliate .
   ```

2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Maintenance

### Application Monitoring

- PM2 status: `pm2 status`
- PM2 logs: `pm2 logs`
- PM2 monitoring: `pm2 monit`

### Log Files

Logs are stored in the `logs/` directory:
- `combined.log`: All application logs
- `error.log`: Error logs only
- `audit.log`: Security audit events
- `security-critical.log`: Critical security events

### Database Backup

Set up automated backups using the provided script:
```bash
# Create backup manually
mongodump --db wavemax --gzip --archive=backup.gz

# Restore from backup
mongorestore --gzip --archive=backup.gz
```

## Troubleshooting

### Common Issues

1. **CSRF Token Errors**
   - Ensure you're fetching CSRF token from `/api/csrf-token`
   - Include token in `X-CSRF-Token` header

2. **JWT Token Expired**
   - Implement automatic token refresh using refresh tokens
   - Tokens expire after 1 hour

3. **Rate Limiting**
   - Authentication endpoints limited to 5 attempts per 15 minutes
   - API endpoints limited to 100 requests per 15 minutes

4. **MongoDB Connection Issues**
   - Verify MongoDB is running: `sudo systemctl status mongod`
   - Check connection string in `.env`

## Security Best Practices

1. **Regular Updates**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Environment Variables**
   - Never commit `.env` files
   - Use strong, unique secrets
   - Rotate keys regularly

3. **Database Security**
   - Enable MongoDB authentication
   - Use connection string with credentials
   - Regular backups

4. **HTTPS Only**
   - Always use HTTPS in production
   - Enable HSTS headers
   - Use SSL/TLS certificates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Contact: support@wavemax.promo

## Embedding the Affiliate Program

The WaveMAX Affiliate Program is designed for embedded deployment and runs entirely within iframes. The application uses a single-page architecture through `embed-app.html` for maximum compatibility with Content Security Policy (CSP) restrictions.

### Single Entry Point Architecture

The entire application runs through one embedded entry point that handles all navigation internally:

**Primary Embed Method** (`embed-app.html`):
- Single iframe containing the entire application
- Route-based navigation within the iframe
- CSP-compliant (works with `frame-src 'none'` policies)
- Auto-resizing based on content
- Full user registration, login, and dashboard flows

### Quick Start - Full Application Embed

Add this code where you want the affiliate program to appear:

```html
<iframe 
    id="wavemax-affiliate-app"
    src="https://wavemax.promo/embed-app.html" 
    width="100%" 
    height="800" 
    frameborder="0" 
    scrolling="no"
    style="width: 100%; min-height: 600px; border: none;">
</iframe>
```

### Embedding Options

#### Option 1: Landing Page Only

For just the landing page without the full application:

```html
<iframe 
    src="https://wavemax.promo/embed-landing.html" 
    width="100%" 
    height="2400" 
    frameborder="0" 
    scrolling="no"
    style="width: 100%; min-height: 2400px; border: none;">
</iframe>
```

#### Option 2: Compact Promotional Widget

Minimal version for sidebars or smaller spaces:

```html
<iframe 
    src="https://wavemax.promo/iframe-embed.html" 
    width="100%" 
    height="600" 
    frameborder="0" 
    scrolling="no"
    style="width: 100%; min-height: 500px; border: none;">
</iframe>
```

#### Option 3: Direct Navigation Links

Link directly to specific pages within the application:

```html
<div style="text-align: center; padding: 40px 20px; background: #f8f9fa;">
    <h2>Become a WaveMAX Affiliate</h2>
    <p>Earn 10% recurring commission on every customer you refer!</p>
    <div style="margin-top: 20px;">
        <a href="https://wavemax.promo/embed-app.html?route=/affiliate-register" 
           target="_blank"
           style="display: inline-block; padding: 12px 30px; 
                  background: #3b82f6; color: white; 
                  text-decoration: none; border-radius: 6px; 
                  font-weight: bold; margin: 0 10px;">
            Join Now
        </a>
        <a href="https://wavemax.promo/embed-app.html?route=/affiliate-login" 
           target="_blank"
           style="display: inline-block; padding: 12px 30px; 
                  background: white; color: #3b82f6; 
                  text-decoration: none; border-radius: 6px; 
                  font-weight: bold; margin: 0 10px;
                  border: 2px solid #3b82f6;">
            Affiliate Login
        </a>
    </div>
</div>
```

### WordPress Integration

If your site uses WordPress, create a shortcode by adding this to your theme's `functions.php`:

```php
function wavemax_affiliate_embed_shortcode($atts) {
    $atts = shortcode_atts(array(
        'height' => '800',
        'type' => 'app',
        'route' => '/'
    ), $atts);
    
    $url = 'https://wavemax.promo/';
    
    switch($atts['type']) {
        case 'app':
            $url .= 'embed-app.html';
            if ($atts['route'] !== '/') {
                $url .= '?route=' . urlencode($atts['route']);
            }
            break;
        case 'landing':
            $url .= 'embed-landing.html';
            break;
        case 'compact':
            $url .= 'iframe-embed.html';
            break;
        default:
            $url .= 'embed-app.html';
    }
    
    return '<iframe src="' . $url . '" 
            width="100%" 
            height="' . $atts['height'] . '" 
            frameborder="0" 
            style="border: none;"></iframe>';
}
add_shortcode('wavemax_affiliate', 'wavemax_affiliate_embed_shortcode');
```

Then use in any page or post:
```
[wavemax_affiliate type="app" height="800"]
[wavemax_affiliate type="app" route="/affiliate-register"]
[wavemax_affiliate type="landing" height="2400"]
```

### Embedding Features

- **Mobile Responsive**: All embed options work perfectly on mobile devices
- **Analytics Tracking**: Automatic UTM parameters track traffic from embeds
- **Secure**: HTTPS required for both sites
- **Cross-Browser**: Works in all modern browsers
- **No Dependencies**: No external libraries required
- **Customizable**: Adjust height and styling as needed

### Performance Optimization

#### Lazy Loading

Improve page load performance with lazy loading:

```html
<iframe 
    src="https://wavemax.promo/iframe-embed.html" 
    width="100%" 
    height="800" 
    frameborder="0"
    loading="lazy"
    style="border: none;">
</iframe>
```

#### Preconnect

Add this to your site's `<head>` for faster loading:

```html
<link rel="preconnect" href="https://wavemax.promo">
<link rel="dns-prefetch" href="https://wavemax.promo">
```

### Troubleshooting

**Iframe not displaying?**
- Ensure both sites use HTTPS
- Check for Content Security Policy restrictions
- Verify the embed URL is correct

**CSP frame-src errors?**
- `embed-app.html` is designed for strict CSP environments
- Check console for "Refused to frame" errors  
- Works with `frame-src 'none'` policies unlike nested iframe approaches

**Height issues?**
- Use the auto-resize script for dynamic content
- Adjust the height attribute as needed
- Consider using `min-height` CSS property

**Styling conflicts?**
- The iframe content is isolated from parent styles
- Use the compact version for minimal styling
- Custom CSS won't affect iframe content

**Navigation not working?**
- Check if embed-navigation.js is loading
- Look for console errors about inline scripts
- Ensure you're using data-navigate attributes

### Support

For embedding assistance:
- View live examples: https://wavemax.promo/embed-example.html
- Email: tech@wavemaxlaundry.com
- Check browser console for error messages

## Full Application Embedding Architecture

The WaveMAX Affiliate Program uses a unified embedded architecture through `embed-app.html` as the single entry point for all functionality.

### Unified Embed Application

The `embed-app.html` provides:
- Single iframe containing the entire application
- Route-based navigation (no page reloads)
- CSP-compliant operation with strict policies
- Dynamic content loading without nested iframes
- Auto-resizing based on content
- Full user flows: registration, login, dashboards, order management

### Available Routes

All functionality is accessible through route parameters:

- `/` or `/landing` - Landing page
- `/affiliate-register` - Affiliate registration
- `/affiliate-login` - Affiliate login  
- `/affiliate-dashboard` - Full affiliate dashboard
- `/affiliate-success` - Registration success
- `/customer-register` - Customer registration
- `/customer-login` - Customer login
- `/customer-dashboard` - Customer dashboard
- `/customer-success` - Customer success
- `/schedule-pickup` - Schedule pickup form
- `/order-confirmation` - Order confirmation

### Navigation Methods

#### URL Parameters
```html
<!-- Direct navigation via URL -->
<iframe src="https://wavemax.promo/embed-app.html?route=/affiliate-register"></iframe>
```

#### PostMessage API
```javascript
// Listen for navigation events
window.addEventListener('message', function(event) {
    if (event.origin !== 'https://wavemax.promo') return;
    
    if (event.data.type === 'navigate') {
        console.log('User navigated to:', event.data.data.url);
    }
    
    if (event.data.type === 'resize') {
        // Auto-resize iframe
        const iframe = document.getElementById('affiliate-app');
        iframe.style.height = event.data.data.height + 'px';
    }
});

// Programmatic navigation
const iframe = document.getElementById('affiliate-app');
iframe.contentWindow.postMessage({
    type: 'navigate',
    data: { url: '/affiliate-dashboard' }
}, 'https://wavemax.promo');
```

### Integration Example

Complete integration with auto-resizing and navigation handling:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Embedded WaveMAX Affiliate Program</title>
</head>
<body>
    <div>
        <h1>Our Affiliate Program</h1>
        <iframe 
            id="wavemax-app"
            src="https://wavemax.promo/embed-app.html" 
            width="100%" 
            height="800" 
            frameborder="0"
            style="border: none;">
        </iframe>
    </div>

    <script>
        const iframe = document.getElementById('wavemax-app');
        
        // Handle messages from the embedded app
        window.addEventListener('message', function(event) {
            if (event.origin !== 'https://wavemax.promo') return;
            
            if (event.data.type === 'resize') {
                iframe.style.height = event.data.data.height + 'px';
            }
            
            if (event.data.type === 'navigate') {
                console.log('User navigated to:', event.data.data.url);
                // Optional: Update parent URL or analytics
            }
        });
    </script>
</body>
</html>
```

## Acknowledgments

- WaveMAX Laundry for the concept and business model
- All contributors and testers
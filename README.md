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

### Code Quality
- **Dead Code Removal**: Cleaned up 100+ lines of unused code
- **Dependency Updates**: Added express-mongo-sanitize and xss packages
- **Validation**: Added comprehensive input validation on all endpoints
- **Error Handling**: Centralized error handling with proper logging

### Feature Updates
- **Customer Dashboard**: Fixed API endpoints and CSP violations
- **Payment Security**: Enhanced encryption for payment information storage
- **Refresh Tokens**: Proper implementation with 30-day expiry and rotation
- **Customer Model**: Removed redundant bags array field

## Project Structure

```
wavemax-affiliate-program/
│
├── public/                                # Frontend HTML/CSS/JS
│   ├── assets/                            # Static assets
│   │   └── js/
│   │       ├── components/                # Reusable components
│   │       │   ├── AffiliateMetricsDashboard.js
│   │       │   └── CustomerDashboardAnalytics.js
│   │       └── errorHandler.js            # Client-side error handling
│   ├── index.html                         # Landing page
│   ├── affiliate-register.html            # Affiliate registration
│   ├── affiliate-login.html               # Affiliate login
│   ├── affiliate-success.html             # Registration success
│   ├── affiliate-dashboard.html           # Affiliate dashboard
│   ├── customer-register.html             # Customer registration
│   ├── customer-login.html                # Customer login
│   ├── customer-success.html              # Registration success
│   ├── customer-dashboard.html            # Customer dashboard
│   ├── schedule-pickup.html               # Pickup scheduling
│   ├── order-confirmation.html            # Order confirmation
│   └── api-docs.html                      # API documentation
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
- **Email**: Amazon SES, Nodemailer
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

For state-changing operations, include CSRF token:
```
X-CSRF-Token: <csrf-token>
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

## Acknowledgments

- WaveMAX Laundry for the concept and business model
- All contributors and testers
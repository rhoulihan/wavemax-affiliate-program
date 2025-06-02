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

## Recent Improvements (June 2025)

### AI Development Collaboration Framework
- **Created Interactive Starting Prompt**: Developed comprehensive `init.prompt` file documenting proven collaborative processes
  - Systematic investigation approaches for debugging complex issues
  - Testing philosophy emphasizing tests as source of truth
  - Code quality standards and git workflow best practices
  - Lessons learned from OAuth integration, password security, and administrator management sessions
  - Communication patterns and prompt evolution strategies
- **Published HTML Version**: Created developer-friendly HTML presentation of the collaboration framework
  - Available at `/wavemax-development-prompt.html` for easy sharing
  - Tweet-friendly formatting with social media meta tags
  - Visual hierarchy with emojis, colors, and organized sections for different aspects
  - Mobile responsive design showcasing AI-assisted development best practices

### Enhanced OAuth Integration & User Experience
- **Unified OAuth Strategy**: Implemented comprehensive OAuth authentication for both affiliates and customers
  - Single Google strategy with context detection for customer vs affiliate registration
  - Cross-reference conflict detection to prevent social account duplication
  - Enhanced user choice dialogs for account conflicts between user types
  - Dedicated OAuth callback URI configuration separate from base URL
- **Improved User Experience**: Added intelligent handling for existing users during registration
  - Modal dialogs for existing affiliates attempting OAuth registration
  - Options to login to existing account or try different authentication method
  - Seamless social media profile auto-population for new registrations
  - Professional UI feedback for OAuth success, errors, and conflicts
- **Flexible Configuration**: Added environment-based OAuth and rate limiting controls
  - `OAUTH_CALLBACK_URI` setting for production deployment flexibility
  - `RELAX_RATE_LIMITING` flag for development and testing environments
  - Separates OAuth callbacks from main application URLs for embedded deployments
- **Database Polling OAuth**: Implemented reliable OAuth session management
  - Database-based OAuth result polling instead of postMessage
  - Works reliably in embedded iframe contexts
  - Automatic cleanup of OAuth sessions with proper timeout handling

### Strong Password Security & Social Media Authentication  
- **Enhanced Password Security**: Implemented comprehensive strong password requirements
  - Minimum 12 characters with uppercase, lowercase, numbers, and special characters
  - Prevents common passwords, sequential patterns, and username/email inclusion
  - Applied to all user types: affiliates, customers, administrators, and operators
  - Real-time password strength validation with detailed feedback
- **Social Media OAuth Integration**: Added seamless social login for affiliates and customers
  - Google, Facebook, and LinkedIn OAuth 2.0 support
  - Social account linking to existing profiles
  - Secure token handling and session management
  - Fallback to traditional authentication if social login fails
- **Security Enhancements**: Increased password entropy from ~40 bits to ~75+ bits
  - Comprehensive validation utility with attack prevention
  - Audit logging for all authentication events
  - Backward compatibility with existing authentication flows

### Affiliate Email Links with Customer Dashboard Filtering
- **Enhanced Email Experience**: Improved affiliate email links to automatically highlight specific customers in dashboard
  - Email URLs now include customer parameter for direct navigation
  - Affiliate dashboard automatically filters to show specific customer when accessed via email link
  - Seamless flow from email notification to relevant customer information
  - Updated email templates for new customer notifications and lost bag alerts
- **Customer Dashboard Integration**: Enhanced customer filtering functionality
  - Added customerId parameter support to affiliate customer list API
  - Updated affiliate dashboard to handle customer highlighting via URL parameters
  - Improved navigation flow for affiliate email notifications
  - Added comprehensive test coverage for customer filtering workflows

### Administrator Creation & Management Tools
- **Direct Admin Creation Script**: Added interactive command-line script for creating administrators
  - Interactive prompts for first name, last name, email, and secure password input
  - Permission selection with clear descriptions (system_config, operator_management, view_analytics, manage_affiliates)
  - Automatic sequential admin ID generation (ADM001, ADM002, etc.)
  - Automatic welcome email with login credentials and portal access links
  - Error handling and validation for all input fields
- **Enhanced Email Service**: Updated administrator welcome email functionality
  - Professional email template with branding and security reminders
  - Dynamic login URL generation based on environment configuration
  - Permission listing in welcome emails for transparency
  - Template placeholders for admin details and system information
- **Comprehensive Test Coverage**: Added extensive test coverage for admin creation workflow
  - 66 new tests covering unit and integration testing
  - Tests for admin ID generation logic and edge cases
  - Email service integration testing
  - Script functionality and user input validation
  - Database operations and error handling scenarios

### Comprehensive Test Suite Achievement
- **100% Test Pass Rate**: Achieved complete test suite success with 916+ tests passing
  - Fixed all failing unit and integration tests
  - Added missing endpoint implementations (getAvailableOperators)
  - Resolved pagination format inconsistencies
  - Fixed fieldFilter method call issues
  - Updated error message expectations to match actual responses
  - Added comprehensive admin creation test suite
- **Code Coverage**: Comprehensive coverage analysis showing 85-90% overall coverage
  - Controllers: 90%+ coverage on most files
  - Models: 95%+ coverage on most files  
  - Routes: 100% coverage on most files
  - Middleware: 90%+ coverage on security components
- **Test Infrastructure**: Robust testing framework with proper isolation
  - Custom test sequencer for optimal performance
  - Memory-optimized test runs for resource-constrained environments
  - CSRF token integration across all tests
  - Proper cleanup and database isolation
  - Added comprehensive integration tests for affiliate customer filtering

### CSRF Protection Implementation
- **Enhanced Security**: Full CSRF protection implementation across all state-changing endpoints
  - CSRF tokens required for POST, PUT, DELETE operations
  - Session-based token management with secure storage
  - Automatic token rotation on each request
  - Cross-origin iframe support with proper CORS headers
- **Session Management**: Improved session handling for iframe contexts
  - Fixed session persistence issues in embedded deployments
  - Added session debugging capabilities
  - Proper session initialization for CSRF validation
- **Frontend Integration**: Updated all forms and API calls to include CSRF tokens
  - Created csrf-utils.js for centralized CSRF handling
  - Automatic token refresh on 403 responses
  - Support for both cookie and header-based token transmission

### Data Management Features
- **Delete Data Functionality**: Enhanced delete all data feature
  - Now controlled by ENABLE_DELETE_DATA_FEATURE environment variable
  - Available in both customer and affiliate dashboards
  - Visible only when feature flag is enabled
  - Consistent implementation across all user types
- **Dashboard Improvements**:
  - Fixed customer dashboard stats not displaying correctly
  - Removed redundant getCustomerDashboard function
  - Improved order count calculations
  - Enhanced profile editing in customer dashboard

### Bug Fixes and Optimizations
- **Customer Registration Flow**: 
  - Fixed customer registration routing when accessed with affiliate ID
  - Removed "Register here" link from customer login page (customers must use affiliate-specific links)
  - Improved handling of affiliate ID parameters across navigation
- **Email Updates**:
  - Updated customer email links to use proper login parameters
  - Fixed schedule pickup links to use login=customer instead of affid
  - Ensured consistent URL structure across all email templates
- **Iframe Embedding**:
  - Created proper iframe embed code for wavemaxlaundry.com
  - Fixed URL parameter passing from parent page to iframe
  - Added automatic height adjustment and cross-origin communication
- **Iframe Height Management**: Fixed infinite resize loops in embedded applications
  - Implemented debouncing for resize events
  - Added proper height reset on page navigation
  - Improved ResizeObserver and MutationObserver handling
- **JavaScript Errors**: Fixed duplicate declaration errors in embedded forms
- **API Consistency**: Standardized dashboard endpoints and data structures

## Recent Improvements (May 2025 - Earlier Updates)

### Administrator & Operator Management System
- **New Role-Based Access Control**: Added administrator and operator roles with granular permissions
  - Administrators: Full system access, operator management, analytics, configuration
  - Operators: Order processing, quality checks, workstation management
- **Administrator Features**:
  - System configuration management
  - Operator lifecycle management (create, update, deactivate)
  - Comprehensive analytics dashboard
  - Order and affiliate reporting
  - System health monitoring
- **Operator Features**:
  - Personal dashboard with active orders and performance metrics
  - Order queue management by workstation
  - Quality check workflow
  - Shift management and status updates
  - Customer note management
- **Security Enhancements**:
  - Separate authentication endpoints for administrators and operators
  - Permission-based access control middleware
  - Account lockout after failed login attempts
  - Password reset functionality for both roles

### Testing Infrastructure Improvements
- **MongoDB Connection**: Migrated from in-memory MongoDB to real database connection for tests
  - Uses separate test database (wavemax_test) to avoid conflicts
  - Improved test reliability and reduced timeout issues
  - Proper cleanup between tests without permission errors
- **Test Coverage Expansion**:
  - Added comprehensive unit tests for administrator controller
  - Added comprehensive unit tests for operator controller
  - Updated integration tests for new authentication endpoints
  - Fixed duplicate index warnings in Mongoose schemas
- **Test Configuration**:
  - Increased Jest timeout to 60 seconds for database operations
  - Updated test setup to use environment variables
  - Added proper test data cleanup logic

### Database Schema Improvements
- **Fixed Duplicate Index Warnings**: Removed redundant index definitions in:
  - Administrator model (adminId field)
  - Operator model (operatorId field)
  - SystemConfig model (key and category fields)
- **New Models**:
  - Administrator: System administrators with permissions and audit trail
  - Operator: Laundry operators with shift and performance tracking
  - SystemConfig: Dynamic system configuration management

### Customer Registration Simplification
- **Removed Schedule Preferences**: Simplified registration by removing preferred day/time selection
- **Service Frequency Removed**: Eliminated service frequency requirement from registration
- **Enhanced Special Instructions**: Added separate fields for laundry and affiliate-specific instructions
- **Updated Pricing Display**: Changed to "$1.25/lb (includes service fees)" for clarity

### Development Tools
- **Delete Data Functionality**: Added delete all data feature for development/test environments
  - Available in affiliate settings and customer profile sections
  - Only visible when NODE_ENV is development or test
  - Requires double confirmation before deletion
  - Affiliates can delete all related customers, orders, bags, and transactions
  - Customers can delete their account and all related data
- **Environment Endpoint**: Added `/api/v1/environment` endpoint for checking current environment

### Email Service Enhancements
- **Microsoft Exchange Support**: Added support for Microsoft Exchange Server email provider
  - Compatible with Exchange 2013, 2016, 2019, and Exchange Online
  - Support for Office 365 SMTP configuration
  - Configurable SSL certificate validation for development environments

### Testing & Quality Assurance
- **Integration Test Fixes**: Updated all integration tests to properly handle CSRF tokens
- **Test Coverage**: Skipped tests for non-existent endpoints with TODO markers for future implementation
- **Rate Limiting**: Fixed rate limiting tests to match actual configuration (20 attempts)
- **Helper Scripts**: Added test maintenance utilities for CSRF token management
- **API Server Improvements**: Added informative root endpoint and blocked WordPress scanning attempts
- **Delete Functionality Tests**: Added comprehensive unit and integration tests for data deletion

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
  - Fixed all failing tests (auth, affiliate, transaction models)
  - Added memory optimization for resource-constrained environments
  - Created custom test sequencer for efficient test execution

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
│   │       ├── administrator-dashboard-init.js # Administrator dashboard
│   │       ├── administrator-login-init.js    # Administrator login
│   │       ├── affiliate-dashboard-init.js    # Affiliate dashboard
│   │       ├── affiliate-login-init.js        # Affiliate login
│   │       ├── affiliate-register-init.js     # Affiliate registration
│   │       ├── affiliate-success-init.js      # Affiliate success page
│   │       ├── csrf-utils.js                  # CSRF token utilities
│   │       ├── customer-dashboard.js          # Customer dashboard
│   │       ├── customer-login-embed.js        # Customer login
│   │       ├── customer-register.js           # Customer registration
│   │       ├── customer-success.js            # Customer success
│   │       ├── embed-navigation.js            # CSP-compliant navigation
│   │       ├── errorHandler.js                # Client-side error handling
│   │       ├── operator-dashboard-init.js     # Operator dashboard
│   │       ├── operator-login-init.js         # Operator login
│   │       ├── order-confirmation.js          # Order confirmation
│   │       └── schedule-pickup.js             # Pickup scheduling
│   ├── embed-app.html                     # Main application (Single Entry Point)
│   ├── embed-landing.html                 # Full embeddable landing page
│   ├── embed-integration-guide.md         # Integration documentation
│   ├── iframe-parent-example.html         # Parent page implementation example
│   ├── administrator-dashboard-embed.html # Administrator dashboard
│   ├── administrator-login-embed.html     # Administrator login
│   ├── affiliate-register-embed.html      # Affiliate registration
│   ├── affiliate-login-embed.html         # Affiliate login
│   ├── affiliate-success-embed.html       # Registration success
│   ├── affiliate-dashboard-embed.html     # Affiliate dashboard
│   ├── customer-register-embed.html       # Customer registration
│   ├── customer-login-embed.html          # Customer login
│   ├── customer-success-embed.html        # Registration success
│   ├── customer-dashboard-embed.html      # Customer dashboard
│   ├── operator-dashboard-embed.html      # Operator dashboard
│   ├── operator-login-embed.html          # Operator login
│   ├── schedule-pickup-embed.html         # Pickup scheduling
│   └── order-confirmation-embed.html      # Order confirmation
│
├── server/                                # Server-side code
│   ├── config/                            # Configuration files
│   │   └── csrf-config.js                 # CSRF configuration
│   │
│   ├── controllers/                       # API controllers
│   │   ├── administratorController.js     # Administrator management
│   │   ├── affiliateController.js         # Affiliate operations
│   │   ├── authController.js              # Authentication
│   │   ├── bagController.js               # Bag management
│   │   ├── customerController.js          # Customer operations
│   │   ├── operatorController.js          # Operator management
│   │   └── orderController.js             # Order processing
│   │
│   ├── middleware/                        # Express middleware
│   │   ├── auth.js                        # JWT authentication
│   │   ├── errorHandler.js                # Error handling
│   │   ├── rbac.js                        # Role-based access control
│   │   └── sanitization.js                # Input sanitization
│   │
│   ├── models/                            # Mongoose models
│   │   ├── Administrator.js               # Administrator model
│   │   ├── Affiliate.js                   # Affiliate model
│   │   ├── Bag.js                         # Bag tracking model
│   │   ├── Customer.js                    # Customer model
│   │   ├── Operator.js                    # Operator model
│   │   ├── Order.js                       # Order model
│   │   ├── RefreshToken.js                # Refresh token model
│   │   ├── SystemConfig.js                # System configuration
│   │   ├── TokenBlacklist.js              # Token blacklist model
│   │   └── Transaction.js                 # Transaction model
│   │
│   ├── routes/                            # Express routes
│   │   ├── administratorRoutes.js         # Administrator endpoints
│   │   ├── affiliateRoutes.js             # Affiliate endpoints
│   │   ├── authRoutes.js                  # Authentication endpoints
│   │   ├── bagRoutes.js                   # Bag management endpoints
│   │   ├── customerRoutes.js              # Customer endpoints
│   │   ├── operatorRoutes.js              # Operator endpoints
│   │   └── orderRoutes.js                 # Order endpoints
│   │
│   ├── templates/                         # Email templates
│   │   └── emails/
│   │       ├── administrator-password-reset.html
│   │       ├── administrator-welcome.html
│   │       ├── affiliate-commission.html
│   │       ├── affiliate-lost-bag.html
│   │       ├── affiliate-new-customer.html
│   │       ├── affiliate-new-order.html
│   │       ├── affiliate-order-cancelled.html
│   │       ├── affiliate-welcome.html
│   │       ├── customer-order-cancelled.html
│   │       ├── customer-order-confirmation.html
│   │       ├── customer-order-status.html
│   │       ├── customer-welcome.html
│   │       ├── operator-pin-reset.html
│   │       ├── operator-shift-reminder.html
│   │       └── operator-welcome.html
│   │
│   └── utils/                             # Utility functions
│       ├── auditLogger.js                 # Security audit logging
│       ├── emailService.js                # Email service
│       ├── encryption.js                  # AES-256-GCM encryption
│       ├── fieldFilter.js                 # API field filtering
│       ├── logger.js                      # Winston logging
│       └── paginationMiddleware.js        # Pagination helper
│
├── scripts/                               # Utility scripts
│   ├── complete-migration-fixed.js        # Migration script (fixed)
│   ├── complete-migration.js              # Migration script
│   ├── create-admin-directly.js           # Create admin user
│   ├── csrf-rollout.js                    # CSRF rollout script
│   ├── delete-admin-operators.js          # Delete admins/operators
│   ├── migrate-admin-system-auto.js       # Auto admin migration
│   ├── migrate-admin-system-interactive.js # Interactive migration
│   ├── migrate-admin-system.js            # Admin system migration
│   └── test-csrf.js                       # CSRF testing script
│
├── tests/                                 # Comprehensive test suite
│   ├── unit/                              # Unit tests for all modules
│   │   ├── administratorController.test.js
│   │   ├── affiliateController.test.js
│   │   ├── auditLogger.test.js
│   │   ├── authController.test.js
│   │   ├── authMiddleware.test.js
│   │   ├── bagController.test.js
│   │   ├── customerController.test.js
│   │   ├── emailService.test.js
│   │   ├── encryption.test.js
│   │   ├── errorHandler.test.js
│   │   ├── fieldFilter.test.js
│   │   ├── logger.test.js
│   │   ├── models.test.js
│   │   ├── operatorController.test.js
│   │   ├── orderController.test.js
│   │   ├── paginationMiddleware.test.js
│   │   └── sanitization.test.js
│   │
│   ├── integration/                       # API integration tests
│   │   ├── affiliate.test.js
│   │   ├── auth.test.js
│   │   ├── customer.test.js
│   │   ├── order.test.js
│   │   └── TEST_ADDITIONS_SUMMARY.md
│   │
│   ├── helpers/                           # Test utilities
│   │   ├── csrfHelper.js                  # CSRF token management
│   │   ├── autoUpdateCsrf.js              # Auto-update CSRF tokens
│   │   ├── fixIntegrationTests.js         # Fix test issues
│   │   ├── commentNonExistentTests.js     # Skip unimplemented endpoints
│   │   └── updateTestsForCsrf.js          # Update tests for CSRF
│   │
│   ├── setup.js                           # Test configuration
│   ├── testSequencer.js                   # Custom test sequencer
│   ├── README.md                          # Test documentation
│   ├── runAllTests.sh                     # Run all tests script
│   └── runMemoryOptimizedTests.sh         # Memory-optimized test script
│
├── .env.example                           # Environment template
├── .eslintrc.js                           # ESLint configuration
├── Dockerfile                             # Docker configuration
├── docker-compose.yml                     # Docker Compose
├── ecosystem.config.js                    # PM2 configuration
├── init-mongo.js                          # MongoDB initialization
├── jest.config.js                         # Jest configuration
├── package.json                           # Dependencies
├── package-lock.json                      # Dependency lock file
├── server.js                              # Application entry point
├── server.js.backup-csrf-remediation-*    # Backup file
├── csrf-exclusion-analysis.md             # CSRF analysis documentation
├── csrf-test-plan.md                      # CSRF testing plan
└── README.md                              # This file
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

## Iframe Embedding

The WaveMAX Affiliate Program is designed to be embedded as an iframe on external websites. The application includes proper URL parameter handling and cross-origin communication.

### Embedding on External Sites

To embed the WaveMAX Affiliate Program on your website (e.g., wavemaxlaundry.com), use this iframe code:

```html
<iframe 
    id="wavemax-iframe"
    width="100%" 
    height="800" 
    frameborder="0" 
    style="border: none;">
</iframe>

<script>
(function() {
    // Pass URL parameters from parent page to iframe
    const urlParams = new URLSearchParams(window.location.search);
    let iframeSrc = 'https://wavemax.promo/embed-app.html';
    if (urlParams.toString()) {
        iframeSrc += '?' + urlParams.toString();
    }
    document.getElementById('wavemax-iframe').src = iframeSrc;
    
    // Handle auto-resize messages from iframe
    window.addEventListener('message', function(e) {
        if (e.origin !== 'https://wavemax.promo') return;
        if (e.data && e.data.type === 'resize' && e.data.data && e.data.data.height) {
            document.getElementById('wavemax-iframe').style.height = e.data.data.height + 'px';
        }
    });
})();
</script>
```

This embed code handles:
- Dynamic URL parameter passing from parent to iframe
- Automatic height adjustment based on content
- Secure cross-origin communication
- Proper routing for affiliate links, customer logins, and scheduling

### Supported URL Parameters

- `?affid=AFFILIATE_ID` - Direct customer to registration for specific affiliate
- `?login=customer` - Show customer login page
- `?login=customer&pickup=true` - Customer login → Schedule pickup flow
- `?login=affiliate` - Show affiliate login page
- `?login=admin` - Show administrator login page
- `?login=operator` - Show operator login page

### Troubleshooting Iframe Issues

If URL parameters are not being passed to the iframe:
1. Ensure the JavaScript code is included and executes after the iframe element
2. Check browser console for any errors
3. Verify the iframe ID matches (`wavemax-iframe`)
4. Test with the provided test page: `https://wavemax.promo/test-iframe-embed.html`

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

## Documentation

The WaveMAX Affiliate Program includes comprehensive HTML documentation covering all aspects of deployment, configuration, and usage.

### Accessing Documentation

1. **Enable documentation in your environment:**
   ```bash
   # Add to your .env file
   SHOW_DOCS=true
   ```

2. **Restart the server:**
   ```bash
   pm2 restart wavemax
   ```

3. **Access documentation at:**
   ```
   https://yourdomain.com/docs
   ```

### Available Documentation

- **Server Configuration** - Complete setup guide for all server components
- **Embedding Guide** - Instructions for integrating with wavemaxlaundry.com
- **Administrator Setup** - Creating and managing administrator accounts
- **RBAC Guide** - Role-based access control and permissions
- **User Management** - Managing all user types in the system

### Security Note

For production environments, it's recommended to disable documentation access:
```bash
SHOW_DOCS=false
```

## API Documentation

### Root Endpoint

```
GET /

Response:
{
    "name": "WaveMAX Affiliate Program API",
    "version": "1.0.0",
    "status": "running",
    "endpoints": {
        "health": "/api/health",
        "docs": "/api/docs",
        "auth": "/api/v1/auth",
        "affiliates": "/api/v1/affiliates",
        "customers": "/api/v1/customers",
        "orders": "/api/v1/orders"
    },
    "timestamp": "2025-05-27T15:00:00.000Z"
}
```

### Authentication Endpoints

All API endpoints use the base URL `/api/v1/`

#### Login
```
POST /api/v1/auth/affiliate/login
POST /api/v1/auth/customer/login

Request Body:
{
    "username": "string",  // Email or affiliate ID
    "password": "string"
}

Response:
{
    "success": true,
    "token": "jwt-token",
    "refreshToken": "refresh-token",
    "user": {
        "id": "string",
        "email": "string",
        "role": "affiliate|customer"
    }
}
```

#### Token Management
```
GET /api/v1/auth/verify
Headers: Authorization: Bearer <token>

POST /api/v1/auth/refresh-token
Request Body:
{
    "refreshToken": "string"
}
```

#### Password Reset
```
POST /api/v1/auth/forgot-password
Request Body:
{
    "email": "string"
}

POST /api/v1/auth/reset-password
Request Body:
{
    "token": "string",
    "newPassword": "string"
}
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

#### Affiliate Endpoints
```
GET /api/v1/affiliates/:id
GET /api/v1/affiliates/:id/dashboard
GET /api/v1/affiliates/:id/customers
GET /api/v1/affiliates/:id/orders
PUT /api/v1/affiliates/:id
POST /api/v1/affiliates/:id/change-password
```

#### Customer Endpoints
```
POST /api/v1/customers/register
GET /api/v1/customers/:id
PUT /api/v1/customers/:id
GET /api/v1/customers/:id/orders
GET /api/v1/customers/:id/active-orders
```

#### Order Endpoints
```
POST /api/v1/orders
GET /api/v1/orders/:id
PUT /api/v1/orders/:id
POST /api/v1/orders/:id/cancel
```

#### Bag Management
```
POST /api/v1/bags
GET /api/v1/bags/:barcode
PUT /api/v1/bags/:id
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

## Email Service Configuration

The application supports multiple email providers for sending notifications:

### Supported Email Providers

1. **Standard SMTP** (`EMAIL_PROVIDER=smtp`)
   - Works with any SMTP server (Gmail, SendGrid, Mailgun, etc.)
   - Simple username/password authentication

2. **Amazon SES** (`EMAIL_PROVIDER=ses`)
   - High-volume, cost-effective email service
   - Requires AWS credentials and verified domain/email

3. **MS Exchange Server** (`EMAIL_PROVIDER=exchange`)
   - Support for Microsoft Exchange Server (on-premise or Office 365)
   - Compatible with Exchange 2013, 2016, 2019, and Exchange Online
   - Supports both standard and self-signed certificates

4. **Console Logging** (`EMAIL_PROVIDER=console`)
   - Development/testing mode
   - Logs emails to console instead of sending

### Exchange Server Setup Example

For Office 365:
```env
EMAIL_PROVIDER=exchange
EXCHANGE_HOST=smtp.office365.com
EXCHANGE_PORT=587
EXCHANGE_USER=your-email@yourdomain.com
EXCHANGE_PASS=your-password
EXCHANGE_FROM_EMAIL=noreply@yourdomain.com
```

For On-Premise Exchange:
```env
EMAIL_PROVIDER=exchange
EXCHANGE_HOST=mail.yourdomain.local
EXCHANGE_PORT=587
EXCHANGE_USER=DOMAIN\\username
EXCHANGE_PASS=your-password
EXCHANGE_FROM_EMAIL=noreply@yourdomain.com
# For self-signed certificates in dev/test environments only
EXCHANGE_REJECT_UNAUTHORIZED=false
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

### Setting Up Administrator Account

To create an administrator account, you can use the provided script:

1. Make sure MongoDB is running and your `.env` file is configured with the correct `MONGODB_URI`

2. Run the admin creation script:
   ```bash
   node scripts/create-admin-directly.js
   ```

3. The script will create an administrator with the following default credentials:
   - **Admin ID**: ADM001
   - **Email**: rickh@wavemaxlaundry.com
   - **Password**: R8der50!
   - **Permissions**: system_config, operator_management, view_analytics, manage_affiliates

4. After running the script, you can log in to the administrator dashboard at:
   ```
   http://localhost:3000/embed-app.html?route=/administrator-login
   ```

**Important**: For production deployments, make sure to:
- Modify the script to use secure credentials before running it
- Change the default password immediately after first login
- Store credentials securely and never commit them to version control

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `ENCRYPTION_KEY` | 32-byte hex key for encryption | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `SESSION_SECRET` | Express session secret | Yes |
| `EMAIL_PROVIDER` | Email service (ses/smtp/exchange/console) | Yes |
| `CORS_ORIGIN` | Allowed CORS origins | Yes |
| `LOG_LEVEL` | Logging level | No |
| `LOG_DIR` | Directory for log files | No |
| `ENABLE_DELETE_DATA_FEATURE` | Enable delete all data feature (true/false) | No |
| `SHOW_DOCS` | Enable documentation at /docs (true/false) | No |

#### Standard SMTP Configuration (when EMAIL_PROVIDER=smtp)
| Variable | Description | Required |
|----------|-------------|----------|
| `EMAIL_HOST` | SMTP server hostname | Yes |
| `EMAIL_PORT` | SMTP server port | Yes |
| `EMAIL_USER` | SMTP username | Yes |
| `EMAIL_PASS` | SMTP password | Yes |

#### Amazon SES Configuration (when EMAIL_PROVIDER=ses)
| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_REGION` | AWS region for SES | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes |
| `SES_FROM_EMAIL` | Verified sender email | Yes |

#### MS Exchange Server Configuration (when EMAIL_PROVIDER=exchange)
| Variable | Description | Required |
|----------|-------------|----------|
| `EXCHANGE_HOST` | Exchange server hostname | Yes |
| `EXCHANGE_PORT` | Exchange server port (default: 587) | Yes |
| `EXCHANGE_USER` | Exchange username | Yes |
| `EXCHANGE_PASS` | Exchange password | Yes |
| `EXCHANGE_FROM_EMAIL` | Sender email address | No |
| `EXCHANGE_REJECT_UNAUTHORIZED` | Validate SSL certificates (default: true) | No |

## Social Media Authentication Configuration

The WaveMAX Affiliate Program supports social media login for affiliates through Google, Facebook, and LinkedIn OAuth 2.0 integration. This provides a seamless registration and login experience while maintaining security.

### Supported OAuth Providers

1. **Google OAuth 2.0** - Most trusted and widely used
2. **Facebook Login** - High user adoption for business accounts  
3. **LinkedIn OAuth** - Professional network, ideal for affiliate businesses

### Setting Up OAuth Providers

#### Google OAuth 2.0 Setup

**Step 1: Create a Google Cloud Project**

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" dropdown at the top of the page
3. Click "NEW PROJECT" button
4. Enter project details:
   - **Project name**: `WaveMAX Affiliate Program` (or your preferred name)
   - **Organization**: Select your organization if applicable
   - **Location**: Choose your organization or "No organization"
5. Click "CREATE" and wait for project creation
6. Ensure your new project is selected (check the project name in the top bar)

**Step 2: Enable Required APIs**

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Identity Platform API" (NOT "Google+ API")
3. Click on "Identity Platform API" from the results
4. Click "ENABLE" button
5. Wait for the API to be enabled (you'll see a confirmation message)

**Step 3: Configure OAuth Consent Screen**

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose user type:
   - **External**: For production apps available to any Google user
   - **Internal**: Only if you have Google Workspace (for organization users only)
3. Click "CREATE"
4. Fill out the OAuth consent screen form:

   **App Information:**
   - **App name**: `WaveMAX Affiliate Program`
   - **User support email**: Your support email address
   - **App logo**: Upload your company logo (120x120px PNG recommended)
   - **App domain**: Your website domain (e.g., `wavemaxlaundry.com`)
   - **Authorized domains**: Add your domains:
     - `yourdomain.com` (your main domain)
     - `wavemax.promo` (if using the embed service)

   **Developer Contact Information:**
   - **Email addresses**: Add your developer email addresses

5. Click "SAVE AND CONTINUE"

6. **Scopes Configuration:**
   - Click "ADD OR REMOVE SCOPES"
   - Add these scopes:
     - `../auth/userinfo.email` (to access user's email)
     - `../auth/userinfo.profile` (to access basic profile info)
   - Click "UPDATE" then "SAVE AND CONTINUE"

7. **Test users** (if External and not published):
   - Add test email addresses that can access your app during development
   - Click "SAVE AND CONTINUE"

8. **Summary**: Review your settings and click "BACK TO DASHBOARD"

**Step 4: Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"
3. If prompted to configure the consent screen, complete Step 3 first
4. Configure the OAuth client:
   - **Application type**: Select "Web application"
   - **Name**: `WaveMAX Affiliate OAuth Client`

5. **Authorized JavaScript origins** (add all that apply):
   - `https://yourdomain.com`
   - `https://www.yourdomain.com`
   - `http://localhost:3000` (for development)
   - `http://localhost:3001` (if using different port)

6. **Authorized redirect URIs** (add all that apply):
   - `https://yourdomain.com/api/auth/google/callback`
   - `https://www.yourdomain.com/api/auth/google/callback`
   - `https://wavemax.promo/api/auth/google/callback` (if using embed service)
   - `http://localhost:3000/api/auth/google/callback` (for development)

7. Click "CREATE"
8. **Important**: Copy the Client ID and Client Secret immediately and store them securely

**Step 5: Environment Configuration**

Add these variables to your `.env` file:
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-YourSecretKeyHere
```

**Step 6: Domain Verification (Production Only)**

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your domain property
3. Verify ownership using one of the provided methods:
   - HTML file upload
   - HTML tag in your website header
   - Domain name provider (DNS record)
   - Google Analytics tracking code

**Step 7: Publishing Your App (Production)**

For production use with external users:

1. Return to "APIs & Services" > "OAuth consent screen"
2. Click "PUBLISH APP" if you want to make it available to all Google users
3. If you need sensitive scopes, submit for verification:
   - Click "Submit for verification"
   - Provide required documentation
   - Wait for Google's review (can take several days)

**Troubleshooting Common Issues:**

- **"Error 400: redirect_uri_mismatch"**: Check that your redirect URI exactly matches what's configured in Google Console
- **"Access blocked"**: Your app may need to be published or the user needs to be added as a test user
- **"Invalid client"**: Verify your Client ID and Client Secret are correct in your environment variables
- **API not enabled**: Ensure you've enabled the Identity Platform API, not Google+ API

#### Facebook OAuth Setup

1. **Create a Facebook App:**
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create a new app of type "Consumer"
   - Add Facebook Login product to your app

2. **Configure Facebook Login:**
   - Go to Facebook Login > Settings
   - Add Valid OAuth Redirect URIs:
     - `https://yourdomain.com/api/auth/facebook/callback`
     - `http://localhost:3000/api/auth/facebook/callback`
   - Enable "Use Strict Mode for Redirect URIs"

3. **App Review (for production):**
   - Request `email` permission if not automatically approved
   - Submit app for review if using advanced features

4. **Add to environment variables:**
   ```bash
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   ```

#### LinkedIn OAuth Setup

1. **Create a LinkedIn App:**
   - Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
   - Create a new app
   - Select your organization or create a new one

2. **Configure OAuth Settings:**
   - Go to Auth tab
   - Add Authorized redirect URLs:
     - `https://yourdomain.com/api/auth/linkedin/callback`
     - `http://localhost:3000/api/auth/linkedin/callback`
   - Request access to `r_liteprofile` and `r_emailaddress` scopes

3. **Add to environment variables:**
   ```bash
   LINKEDIN_CLIENT_ID=your_linkedin_client_id
   LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
   ```

### OAuth Environment Variables

Add these variables to your `.env` file:

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret | Optional |
| `FACEBOOK_APP_ID` | Facebook App ID | Optional |
| `FACEBOOK_APP_SECRET` | Facebook App Secret | Optional |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth Client ID | Optional |
| `OAUTH_CALLBACK_URI` | Domain for OAuth callbacks (e.g., https://wavemax.promo) | Optional |
| `RELAX_RATE_LIMITING` | Set to 'true' to disable rate limiting (development only) | Optional |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth Client Secret | Optional |

**Note:** OAuth providers are optional. If environment variables are not provided, the application will run with traditional username/password authentication only.

### OAuth API Endpoints

The OAuth integration provides the following endpoints:

```bash
# Initiate OAuth flow
GET /api/auth/google
GET /api/auth/facebook  
GET /api/auth/linkedin

# OAuth callback handling
GET /api/auth/google/callback
GET /api/auth/facebook/callback
GET /api/auth/linkedin/callback

# Link OAuth account to existing user
POST /api/auth/link
Body: { provider: 'google|facebook|linkedin', socialId: 'string' }

# Unlink OAuth account
DELETE /api/auth/unlink/:provider
```

### OAuth Frontend Integration

Example JavaScript implementation for initiating OAuth flows:

```javascript
// Initiate OAuth login
function loginWithProvider(provider) {
    // Redirect to OAuth provider
    window.location.href = `/api/auth/${provider}`;
}

// Handle OAuth response
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (token) {
        // Store token and redirect to dashboard
        localStorage.setItem('authToken', token);
        window.location.href = '/affiliate-dashboard';
    } else if (error) {
        // Handle OAuth error
        console.error('OAuth error:', error);
        showErrorMessage('Login failed. Please try again.');
    }
});
```

### OAuth Security Features

- **Secure Token Handling**: OAuth tokens are encrypted and stored securely with AES-256-GCM
- **Account Linking**: Existing users can link social accounts to their profiles seamlessly
- **Fallback Authentication**: Traditional username/password login always available as backup
- **Session Management**: Proper session handling for both OAuth and traditional authentication flows
- **State Parameter Validation**: CSRF protection through OAuth state parameter verification
- **Audit Logging**: All social authentication events are logged for security monitoring and compliance
- **Token Expiration**: OAuth access tokens have appropriate expiration times with refresh token rotation
- **Scope Limitation**: Minimal required scopes (email, profile) to protect user privacy

### Development vs Production

**Development:**
- Use localhost callback URLs
- OAuth providers may show security warnings
- Test with personal accounts

**Production:**
- Use HTTPS callback URLs only
- Complete app review process for each provider
- Configure proper consent screens and privacy policies
- Monitor OAuth usage and rate limits

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

# Memory-optimized testing (for resource-constrained environments)
npm run test:memory          # Runs all tests with memory limits
npm run test:memory:batch    # Runs tests with detailed memory optimization

# If running on a server with limited memory, use:
NODE_OPTIONS="--max-old-space-size=512" npm test -- --runInBand --maxWorkers=1
```

### Memory Optimization

For servers with limited memory (< 1GB), tests may fail due to resource exhaustion. The project includes:
- Custom test sequencer that runs unit tests before integration tests
- Memory-optimized Jest configuration with single worker process
- Batch test script with heap usage monitoring

### Test Coverage

The project maintains 80%+ code coverage across:
- Controllers
- Models  
- Middleware
- Utilities
- API endpoints

### Endpoints Pending Implementation

The following endpoints have tests written but are not yet implemented:
- PUT `/api/v1/affiliates/:affiliateId/payment` - Update payment information
- GET `/api/v1/affiliates/:affiliateId/commission-summary` - Commission summary
- PUT `/api/v1/orders/bulk/status` - Bulk order status update
- POST `/api/v1/orders/bulk/cancel` - Bulk order cancellation
- GET `/api/v1/orders/export` - Export orders (CSV/JSON/Excel)
- PUT `/api/v1/orders/:orderId/payment-status` - Update payment status
- GET `/api/v1/orders/search` - Search orders
- GET `/api/v1/orders/statistics` - Order statistics
- PUT `/api/v1/customers/:customerId/password` - Update password
- GET `/api/v1/customers/:customerId/bags` - Get customer bags
- GET `/api/v1/customers/:customerId/dashboard` - Customer dashboard data
- POST `/api/v1/auth/logout` - Logout with token blacklisting

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
   - Authentication endpoints limited to 20 attempts per 15 minutes
   - Failed login attempts don't count towards the limit
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

### WaveMAX Laundry Austin Integration

For the main WaveMAX Laundry website, use this specific embed code:

```html
<!-- WaveMAX Austin Affiliate Program Embed -->
<div id="wavemax-affiliate-container" style="width: 100%; min-height: 600px;">
    <iframe 
        id="wavemax-affiliate-iframe"
        src="https://wavemax.promo/embed-app.html" 
        width="100%" 
        height="800" 
        frameborder="0" 
        scrolling="no"
        style="width: 100%; min-height: 600px; border: none;">
    </iframe>
</div>

<script>
// Handle iframe communication for resizing and navigation
window.addEventListener('message', function(event) {
    if (event.origin !== 'https://wavemax.promo') return;
    
    const iframe = document.getElementById('wavemax-affiliate-iframe');
    
    // Handle iframe resize
    if (event.data.type === 'resize' && event.data.data && event.data.data.height) {
        iframe.style.height = event.data.data.height + 'px';
    }
    
    // Handle scroll to top on navigation
    if (event.data.type === 'scroll-to-top') {
        iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
</script>
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

#### Option 2: Direct to Specific Page

Navigate directly to a specific section:

```html
<iframe 
    src="https://wavemax.promo/embed-app.html?route=/affiliate-register" 
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
        case 'register':
            $url .= 'embed-app.html?route=/affiliate-register';
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
- `/franchisee-landing` - Franchisee landing page for review
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

### Parent Page Implementation Example

A complete example is available at `/iframe-parent-example.html` that demonstrates:
- Automatic iframe resizing on content changes
- Smooth scrolling to top on page transitions
- Route change tracking for analytics
- Current height display for debugging
- Secure origin validation

The implementation includes:
- ResizeObserver for detecting content size changes
- MutationObserver for DOM updates
- Automatic height adjustment with smooth transitions
- Support for all administrator and operator pages

## Acknowledgments

- WaveMAX Laundry for the concept and business model
- All contributors and testers
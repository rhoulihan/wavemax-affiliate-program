# Changelog

All notable changes to the WaveMAX Laundry Affiliate Program will be documented in this file.

## [Unreleased]

## [1.2.0] - 2025-01-16

### Added
- Beta program system for limited affiliate launch
  - Beta request modal with email/name collection
  - Admin dashboard management for beta requests
  - Welcome email system for approved beta users
  - Registration validation against beta-approved emails
- Two-step registration process with progressive disclosure
  - OAuth/credentials collection first, then personal details
  - Improved user experience with back button navigation
- Mobile chrome auto-hide on initial page load
  - Automatic detection of mobile/tablet viewport
  - Parent page element hiding without resize events
- Tablet kiosk optimizations for operator scan
  - Wide modal layout for bag weight entry
  - Grid layout for weight inputs
  - Top-positioned modal to avoid keyboard overlap

### Changed
- Default minimum delivery fee reduced from $25 to $20
- W9 form messaging updated to mention DocuSign for earnings over $600
- Payment reminder emails now include "Login to pay" button
- CSP connect-src updated to include cdn.jsdelivr.net for Bootstrap source maps
- Affiliate landing page testimonials section hidden (fake testimonials removed)
- Customer landing page CTA buttons changed to "Sign Up Today" and "Login"

### Fixed
- Beta request modal z-index issues in iframe context
- JavaScript error from duplicate socialAuthSection variable declaration
- Rate limiting MongoDB collection name (rate_limits vs ratelimits)
- Mobile viewport detection on narrow window initial load
- Operator scan modal positioning on tablets with on-screen keyboards

## [1.1.0] - 2025-01-16

### Added
- Location-based service area restrictions
  - Configurable service radius (default: 50 miles from Austin, TX)
  - Environment variables: `SERVICE_STATE`, `SERVICE_CITY`, `SERVICE_RADIUS_MILES`
  - Applies to both affiliate and customer registrations
  - Prevents registrations outside defined service area
- Unified address validation system
  - Centralized `addressValidationService.js` for backend validation
  - Reusable `address-validation-component.js` for frontend
  - Integration with OpenStreetMap Nominatim for geocoding
  - Strict validation requiring complete street addresses
- Service area API endpoints
  - `/api/v1/service-area/config` - Get service area configuration
  - `/api/v1/service-area/validate` - Validate addresses
  - `/api/v1/service-area/cities` - List cities in service area
  - `/api/v1/service-area/zip-codes` - List ZIP codes in service area
- City and ZIP code autocomplete for Texas locations
- Comprehensive documentation for service area validation

### Changed
- Address validation now requires house number and complete street address
- ZIP code validation includes tolerance for nearby ZIP codes (same 3-digit prefix)
- State field pre-populated based on `SERVICE_STATE` configuration
- Only street address field cleared on validation failure (city/state/zip preserved)
- `ENABLE_TEST_PAYMENT_FORM` set to `false` for production security

### Fixed
- Address validation for edge cases like ZIP code boundaries
- Customer registration now properly uses unified validation API
- Form submission state management to prevent stuck "submitting" state
- Swirl spinner display during address validation

### Removed
- Deprecated old geocoding logic that tried multiple address combinations
- Removed fallback geocoding strategies in favor of strict validation

## [1.0.1] - 2024-12-24

### Added
- Store IP-based session renewal for operators
  - Automatic token renewal for operators working from store locations
  - Configuration via `STORE_IP_ADDRESS`, `ADDITIONAL_STORE_IPS`, and `STORE_IP_RANGES`
  - Prevents session timeouts during work shifts
  - CIDR range support for network-based authentication
- Enhanced parent-iframe bridge chrome management
  - Automatic hiding of all page elements outside iframe
  - Persistent chrome hiding across viewport and route changes
  - Mutation observers to prevent unwanted element visibility

### Changed
- Simplified order status management
  - Removed `orderProcessingStatus` field from Order model
  - Consolidated to single `status` field with clearer state flow
  - New status progression: pending → processing → processed → complete → cancelled
  - Orders cannot be cancelled once processing begins
- Operator scanning workflow labels
  - Stage 1: "Receive" - Scan to weigh bags
  - Stage 2: "Notify" - Scan when WDF is done
  - Stage 3: "Pickup" - Scan as bags leave
- Operator interface UI improvements
  - Consistent WaveMAX blue branding (#1e3a8a, #3b82f6) replacing green
  - Bags weighed count updates only on blur with valid weight entry
  - Weight input modal stays visible with multiple display strategies

### Fixed
- Weight input modal auto-closing issue in cross-origin iframe context
- Mongoose populate errors with string-based ID relationships
- Content Security Policy violations from inline event handlers
- Audit logger multi-line comment syntax causing server crashes
- Authentication error handling now redirects to affiliate landing page
- Page header reappearing on viewport resize for embedded pages
- 500 error when marking bags as processed due to populate calls

### Added
- Connectivity Monitoring System
  - Real-time monitoring of all external service dependencies
  - Health checks for MongoDB, SMTP, Paygistix, DocuSign, QuickBooks, and DNS
  - Web-based monitoring dashboard at `/monitoring-dashboard.html`
  - Email alerts for critical service failures with one-hour cooldown
  - Historical tracking with last 60 checks per service
  - Availability percentage calculations and response time metrics
  - Automatic monitoring startup with PM2 integration
- Mailcow Email Server Integration  
  - Self-hosted email server configuration
  - SMTP authentication with TLS support
  - Reliable email delivery for all system notifications

### Changed
- Email Service Configuration
  - Removed Amazon SES integration
  - Removed Brevo (Sendinblue) integration
  - Consolidated to SMTP and Exchange providers only
  - Simplified email configuration with standard SMTP settings

### Added
- Session persistence and browser navigation support
  - 10-minute session persistence across page refresh and browser navigation
  - SessionManager service for all user roles (admin, operator, affiliate, customer)
  - Automatic activity tracking and session renewal
  - Browser back/forward button support maintaining authentication state
  - Tab state persistence across refresh with URL parameter tracking
  - Browser history integration using pushState/popstate events
  - Message passing retry logic for iframe-dashboard communication
  - Multi-role authentication support for simultaneous logins
- Generic payment processing methods (`processPayment` and `processPaymentTestMode`)
  - Unified payment flow for all transaction types
  - Simplified integration with single payment endpoint
  - Enhanced test mode for development scenarios
- Schedule pickup workflow improvements
  - Integrated payment processing during pickup scheduling
  - Real-time pricing calculations for WDF and delivery fees
  - Improved user flow from login to payment completion
  - Full translation support for pickup forms
- DocuSign W-9 Integration (Completed)
  - OAuth 2.0 Authorization Code Grant with PKCE implementation
  - Template-based W-9 signing using DocuSign template ID
  - Automatic field mapping for owner information and address
  - Pop-up window signing experience with real-time status polling
  - Webhook integration with CSRF exemption for callbacks
  - Automatic W9 status updates upon envelope completion
  - Field label configuration matching DocuSign W9 template
  - Support for "Signer 1" role name in templates
  - Mobile-friendly signing on any device
- W-9 Tax Compliance System
  - Secure W-9 document upload for affiliates
  - AES-256-GCM encryption for document storage
  - Administrator verification workflow with QuickBooks data entry
  - Payment hold system until W-9 verification
  - Automatic expiry notifications after 3 years
  - IRS-compliant 7-year data retention policy
  - Comprehensive audit logging for all W-9 operations
  - Email notifications for W-9 status changes
- QuickBooks Integration
  - Export verified affiliates as QuickBooks vendors
  - Biweekly payment summary exports with date ranges
  - Detailed commission reports per affiliate
  - CSV format compatible with QuickBooks import
  - Export history tracking and audit trails
  - Support for both CSV and JSON export formats
- Security Enhancements
  - W-9 document encryption at rest
  - Secure storage outside web root
  - Role-based access control for W-9 documents
  - Legal hold functionality for documents
  - Automated data retention service

### Changed
- Simplified Paygistix integration from form pool to callback URL pool
  - Single Paygistix form configuration instead of multiple forms
  - Dynamic callback URL assignment for payment tracking
  - CallbackPool model replaces FormPool
  - Reduced complexity while maintaining payment tracking capabilities
- Consolidated iframe resize handling
  - All resize handling now managed by embed-navigation.js
  - Removed duplicate ResizeObserver instances
  - Fixed height calculation feedback loop
  - Improved performance with proper debouncing

### Added
- Paygistix Callback URL Pool System for payment tracking
  - Single form with multiple callback URLs
  - Dynamic callback assignment with locking mechanism
  - Automatic callback release and cleanup
  - Callback-specific routing for payment identification
  - Database-backed callback availability tracking
- Test Payment Form for development
  - Simulates Paygistix payment callbacks
  - Configurable payment scenarios (success/failure)
  - Realistic parameter generation
  - Controlled by ENABLE_TEST_PAYMENT_FORM environment variable
- Payment window close detection
  - Automatic detection when user closes payment window
  - Payment token cancellation on abandonment
  - Real-time status polling during payment
  - PostMessage communication between windows

### Removed
- Diagnostic test files for payment window detection
  - public/test-payment-form.html
  - public/assets/js/test-payment-form.js
- Duplicate window resize event handlers in embed-app-v2.html
- embedAppHasResizeObserver flag (no longer needed)
- Internationalization (i18n) support for multi-language deployment
  - Support for English, Spanish, Portuguese, and German languages
  - Automatic browser language detection during user registration
  - Language preference fields added to Affiliate and Customer models
  - Localized email templates with language-specific content
  - Real-time language switching in the user interface
  - Parent page language synchronization for embedded content
  - Translation management system with JSON-based language files
  - Email subject line translations for all supported languages
- Dynamic delivery fee structure with minimum fee + per-bag pricing
  - Affiliates can set minimum delivery fee (default $25) and per-bag fee (default $5)
  - Customers pay whichever is higher: minimum fee or calculated per-bag rate
  - Live fee calculator in affiliate registration showing pricing for different bag quantities
  - Fee editing capability in affiliate dashboard settings
- UUID generation for enhanced security
  - Customer IDs now use UUID format (CUST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  - Administrator IDs use UUID format (ADM-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  - Maintains backward compatibility with existing sequential IDs
- Enhanced password security validation
  - Strengthened password requirements across all user types
  - Real-time validation feedback during registration
  - Prevention of common patterns and user data in passwords

### Changed
- Updated default delivery fee from $10 to $25 minimum
- Improved bag credit display on customer dashboard
- Enhanced affiliate registration form with dynamic fee calculator
- Standardized fee structure across all customer-facing interfaces

### Removed
- Complete removal of bag tracking functionality
  - Removed bag barcode generation and assignment
  - Eliminated bag management from customer and affiliate dashboards
  - Cleaned up bag-related API endpoints and database operations
  - Removed physical bag purchase/distribution requirements
  - Updated all email templates to remove bag references
  - Migrated existing data to maintain order history without bag associations

### Fixed
- Session persistence issues across page refresh and browser navigation
- Tab focus loss on dashboard refresh - now persists via localStorage and URL parameters
- Browser back/forward navigation not updating tab content - fixed with retry logic
- Translation function initialization error in operators tab ("Cannot access 't' before initialization")
- Tab content not reloading on browser navigation - added proper event handling
- Customer dashboard now properly displays bag credit information
- Delivery fee calculations now use dynamic pricing model consistently
- Fixed affiliate fee structure persistence in database

## [June 2025]

### Added
#### Development Backlog Queue System
- Introduced `BACKLOG.md` for tracking pending work items
  - Organized by priority levels (High, Medium, Low) with detailed context
  - Maintains history of when items were added and their current status
  - Enables systematic approach to addressing technical debt and improvements
  - Integrated into AI assistant's session startup checklist for consistency
  - Provides clear reference point for picking work in future sessions

#### AI Development Collaboration Framework
- Created interactive starting prompt (`init.prompt`) documenting proven collaborative processes
  - Systematic investigation approaches for debugging complex issues
  - Testing philosophy emphasizing tests as source of truth
  - Code quality standards and git workflow best practices
  - Lessons learned from OAuth integration, password security, and administrator management sessions
  - Communication patterns and prompt evolution strategies
  - References `OPERATING_BEST_PRACTICES.md` for known issues and workarounds
- Published HTML version at `/wavemax-development-prompt.html` for easy sharing
  - Tweet-friendly formatting with social media meta tags
  - Visual hierarchy with emojis, colors, and organized sections
  - Mobile responsive design showcasing AI-assisted development best practices
- Enhanced AI Assistant Persona in `init.prompt`
  - Expert Node.js/Express developer operating persona
  - Proficiency in authentication systems (JWT, OAuth 2.0, Passport.js)
  - Test-Driven Development (TDD) expertise
  - Security-first approach to code analysis
  - Specific expertise in affiliate program patterns
- Created `OPERATING_BEST_PRACTICES.md` documenting:
  - PM2 debugging workarounds and known issues
  - CSP compliance requirements (no inline scripts)
  - Dynamic page loading script initialization patterns
  - Multiple initialization strategies for dynamically loaded content
  - Common debugging patterns and solutions
  - Environment-specific configurations

#### Enhanced OAuth Integration & User Experience
- Unified OAuth Strategy with comprehensive authentication
  - Single Google strategy with context detection for customer vs affiliate
  - Cross-reference conflict detection to prevent social account duplication
  - Enhanced user choice dialogs for account conflicts
  - Dedicated OAuth callback URI configuration
- Improved User Experience for existing users
  - Modal dialogs for existing affiliates attempting OAuth registration
  - Options to login or try different authentication method
  - Seamless social media profile auto-population
  - Professional UI feedback for OAuth states
- Flexible Configuration
  - `OAUTH_CALLBACK_URI` setting for production deployment
  - `RELAX_RATE_LIMITING` flag for development environments
  - Separates OAuth callbacks from main application URLs
- Database Polling OAuth for reliable session management
  - Database-based OAuth result polling instead of postMessage
  - Works reliably in embedded iframe contexts
  - Automatic cleanup with proper timeout handling
- Account Conflict Resolution
  - Customer model conditional validation for OAuth registrations
  - OAuth customers don't require password fields
  - Account conflict modals for existing users
  - Cross-user-type conflict detection

#### Strong Password Security & Social Media Authentication  
- Enhanced Password Security
  - Minimum 12 characters with comprehensive requirements
  - Prevents common passwords and patterns
  - Applied to all user types
  - Real-time password strength validation
- Social Media OAuth Integration
  - Google, Facebook, and LinkedIn OAuth 2.0 support
  - Social account linking to existing profiles
  - Secure token handling and session management
  - Fallback to traditional authentication
- Security Enhancements
  - Increased password entropy from ~40 bits to ~75+ bits
  - Comprehensive validation utility
  - Audit logging for all authentication events
  - Backward compatibility maintained

#### Affiliate Email Links with Customer Dashboard Filtering
- Enhanced Email Experience
  - Email URLs include customer parameter for direct navigation
  - Affiliate dashboard automatically filters to specific customer
  - Seamless flow from email notification to customer information
  - Updated email templates for all notifications
- Customer Dashboard Integration
  - Added customerId parameter support to affiliate customer list API
  - Updated affiliate dashboard to handle customer highlighting
  - Improved navigation flow for email notifications
  - Added comprehensive test coverage

#### Administrator Creation & Management Tools
- Direct Admin Creation Script
  - Interactive command-line script for creating administrators
  - Permission selection with clear descriptions
  - Automatic sequential admin ID generation
  - Automatic welcome email with credentials
  - Error handling and validation
- Enhanced Email Service
  - Professional email template with branding
  - Dynamic login URL generation
  - Permission listing in welcome emails
  - Template placeholders for admin details
- Comprehensive Test Coverage
  - 66 new tests covering unit and integration testing
  - Tests for admin ID generation logic
  - Email service integration testing
  - Script functionality validation
  - Database operations testing

### Changed
#### Comprehensive Test Suite Achievement
- 100% Test Pass Rate with 916+ tests passing
  - Fixed all failing unit and integration tests
  - Added missing endpoint implementations
  - Resolved pagination format inconsistencies
  - Fixed fieldFilter method call issues
  - Updated error message expectations
  - Added comprehensive admin creation test suite
- Code Coverage: 85-90% overall coverage
  - Controllers: 90%+ coverage
  - Models: 95%+ coverage  
  - Routes: 100% coverage
  - Middleware: 90%+ coverage
- Test Infrastructure improvements
  - Custom test sequencer for optimal performance
  - Memory-optimized test runs
  - CSRF token integration across all tests
  - Proper cleanup and database isolation
  - Added comprehensive integration tests

#### CSRF Protection Implementation
- Enhanced Security
  - CSRF tokens required for all state-changing operations
  - Session-based token management with secure storage
  - Automatic token rotation on each request
  - Cross-origin iframe support with proper CORS headers
- Session Management improvements
  - Fixed session persistence issues in embedded deployments
  - Added session debugging capabilities
  - Proper session initialization for CSRF validation
- Frontend Integration
  - Created csrf-utils.js for centralized CSRF handling
  - Automatic token refresh on 403 responses
  - Support for both cookie and header-based tokens

#### Dynamic Pricing and Revenue Features
- Dynamic WDF Pricing via SystemConfig
  - WDF rates managed through SystemConfig model
  - Configurable per-pound pricing ($0.50 - $10.00)
  - Public API endpoint for current rates
  - Automatic rate application on order creation
- Revenue Calculator enhancements
  - Updated default delivery fee from $10 to $25
  - Real-time commission calculation
  - Accurate monthly and yearly projections
  - CSP-compliant external JavaScript
- Commission System improvements
  - Automatic commission calculation on order completion
  - Handles edge cases properly
  - Floating-point precision handling
  - Comprehensive test coverage

#### Data Management Features
- Delete Data Functionality enhancements
  - Controlled by ENABLE_DELETE_DATA_FEATURE environment variable
  - Available in both customer and affiliate dashboards
  - Visible only when feature flag is enabled
  - Consistent implementation across all user types
- Dashboard Improvements
  - Fixed customer dashboard stats display
  - Removed redundant getCustomerDashboard function
  - Improved order count calculations
  - Enhanced profile editing

### Fixed
- Customer Registration Flow fixes
  - Fixed routing when accessed with affiliate ID
  - Removed "Register here" link from customer login
  - Improved handling of affiliate ID parameters
- Email Updates
  - Updated customer email links to use proper parameters
  - Fixed schedule pickup links
  - Ensured consistent URL structure
- Iframe Embedding fixes
  - Created proper iframe embed code
  - Fixed URL parameter passing
  - Added automatic height adjustment
- Iframe Height Management
  - Implemented debouncing for resize events
  - Added proper height reset on navigation
  - Improved observer handling
- JavaScript Errors: Fixed duplicate declarations
- API Consistency: Standardized dashboard endpoints

## [May 2025]

### Added
#### Administrator & Operator Management System
- New Role-Based Access Control
  - Administrators: Full system access
  - Operators: Order processing and quality checks
- Administrator Features
  - System configuration management
  - Operator lifecycle management
  - Comprehensive analytics dashboard
  - Order and affiliate reporting
  - System health monitoring
- Operator Features
  - Personal dashboard with active orders
  - Order queue management by workstation
  - Quality check workflow
  - Shift management and status updates
  - Customer note management
- Security Enhancements
  - Separate authentication endpoints
  - Permission-based access control middleware
  - Account lockout after failed attempts
  - Password reset functionality

#### Testing Infrastructure Improvements
- MongoDB Connection migration to real database
  - Uses separate test database (wavemax_test)
  - Improved test reliability
  - Proper cleanup between tests
- Test Coverage Expansion
  - Comprehensive unit tests for administrators
  - Comprehensive unit tests for operators
  - Updated integration tests
  - Fixed duplicate index warnings
- Test Configuration improvements
  - Increased Jest timeout to 60 seconds
  - Updated test setup for environment variables
  - Added proper test data cleanup

### Changed
#### Database Schema Improvements
- Fixed Duplicate Index Warnings
  - Administrator model (adminId field)
  - Operator model (operatorId field)
  - SystemConfig model (key and category fields)
- New Models
  - Administrator with permissions and audit trail
  - Operator with shift and performance tracking
  - SystemConfig for dynamic configuration
- Enhanced OAuth Support
  - Conditional validation for password fields
  - Social account data storage
  - Registration method tracking
  - OAuth accounts don't require passwords

#### Customer Registration Simplification
- Removed Schedule Preferences
- Service Frequency Removed
- Enhanced Special Instructions
- Updated Pricing Display to "$1.25/lb (includes service fees)"

#### Development Tools
- Delete Data Functionality
  - Available in development/test environments
  - Requires double confirmation
  - Affiliates can delete all related data
  - Customers can delete their account
- Environment Endpoint added

#### Email Service Enhancements
- Microsoft Exchange Support
  - Compatible with Exchange 2013, 2016, 2019
  - Support for Office 365 SMTP
  - Configurable SSL certificate validation

### Fixed
- Integration Test Fixes for CSRF tokens
- Test Coverage improvements
- Rate Limiting tests updated to match configuration
- Helper Scripts added for test maintenance
- API Server Improvements
- Delete Functionality Tests added

## [January 2025]

### Changed
#### Embedded-Only Deployment
- Simplified Architecture to embedded-only
- Single Entry Point through embed-app-v2.html
- Consistent CSP Compliance
- Reduced Codebase
- Unified User Experience

#### Security Enhancements
- Enhanced Authentication
  - JWT tokens reduced from 7 days to 1 hour
  - Secure refresh token rotation
- Input Sanitization for XSS and NoSQL injection prevention
- CSRF Protection for all state-changing operations
- Password Security: PBKDF2 iterations increased to 100,000
- Audit Logging for compliance
- Field-Level Access Control
- Error Handling improvements

#### Infrastructure Improvements
- API Versioning: /api/v1/ structure
- HTTPS Enforcement in production
- Security Headers: HSTS, X-Frame-Options, CSP
- Rate Limiting on authentication endpoints
- CORS Security restrictions
- AWS SDK v3 upgrade

#### Code Quality
- Dead Code Removal: 4000+ lines cleaned up
- Dependency Updates
- Validation improvements
- Error Handling centralization
- Route-Based Navigation
- Test Suite Improvements
  - Fixed MongoDB connection conflicts
  - Added comprehensive test coverage
  - Proper test isolation
  - 80%+ code coverage achieved
  - Memory optimization for tests

### Added
- Landing Page Update: "$0 Startup Cost"
- Customer Dashboard fixes
- Customer Profile inline editing
- Order Management improvements
  - Service notes section
  - Active orders count fix
  - ISO8601 date handling
  - Enhanced delivery fee calculation
- Payment Security enhancements
- Refresh Tokens implementation
- CSP Compliance improvements
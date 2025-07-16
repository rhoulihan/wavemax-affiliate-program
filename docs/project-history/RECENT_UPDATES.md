# Recent Major Updates

## Location-Based Service Area Restrictions (January 2025)
- **Service Area Configuration**: Implemented configurable service radius restrictions
  - Default configuration: 50-mile radius from Austin, TX
  - Environment variables: `SERVICE_STATE`, `SERVICE_CITY`, `SERVICE_RADIUS_MILES`
  - Applies to both affiliate and customer registrations
  
- **Unified Address Validation**: 
  - Created centralized address validation service and frontend component
  - Strict validation requires complete street address with house number
  - ZIP code verification with tolerance for nearby ZIP codes
  - Integration with OpenStreetMap Nominatim for geocoding
  
- **Address Validation Features**:
  - Real-time address format validation
  - Visual feedback with success/error messages
  - Swirl spinner integration during validation
  - Autocomplete for Texas cities and ZIP codes
  - Prevents registration outside service area
  
- **User Experience Improvements**:
  - Pre-populated state field based on SERVICE_STATE
  - Only street address cleared on validation failure (city/state/zip preserved)
  - Clear error messages with distance information for out-of-area addresses
  - Consistent validation across all registration forms and dashboards

- **Production Configuration**:
  - Set `ENABLE_TEST_PAYMENT_FORM=false` for production environment
  - Disabled test payment endpoints for security

## Order Status Simplification & Operator Workflow Updates (December 2024)
- **Simplified Order Status**: Removed `orderProcessingStatus` field and consolidated to single `status` field
  - New status flow: `pending` → `processing` → `processed` → `complete` → `cancelled`
  - Orders cannot be cancelled once in `processing` status
  - Cleaner state management throughout the order lifecycle

- **Operator Workflow Improvements**:
  - Fixed weight input modal auto-closing issue with multiple strategies
  - Modal now properly stays open during weight entry
  - Bags weighed count only updates when weight is entered and focus changes
  - Consistent WaveMAX branding (blue theme) across all operator interfaces
  
- **Store IP Session Management**: Automatic session renewal for operators at physical stores
  - Uses existing `STORE_IP_ADDRESS` environment variable
  - Sessions auto-renew when operators work from whitelisted store IPs
  - Prevents timeout interruptions during work shifts
  - Supports additional IPs via `ADDITIONAL_STORE_IPS` and IP ranges via `STORE_IP_RANGES`

- **Embedded Page Chrome Management**: Enhanced parent-iframe bridge functionality
  - All page chrome (headers, footers, navigation) automatically hidden on embedded pages
  - Chrome stays hidden across viewport changes and route navigation
  - Permanent hiding of page header element with mutation observers
  - Full viewport utilization for embedded content

- **Bug Fixes**:
  - Fixed Mongoose populate errors by handling string-based ID relationships
  - Fixed Content Security Policy violations by removing inline event handlers
  - Fixed audit logger syntax errors preventing app startup
  - Fixed authentication error handling to redirect to landing page

## Operator QR Code Scanning Workflow (June 2025)
- **Three-Stage Order Processing**: Comprehensive bag tracking through the laundry lifecycle
  - Stage 1: Receiving & Weighing - Scan customer card and input bag weights
  - Stage 2: After WDF Processing - Scan to mark bags as processed
  - Stage 3: Affiliate Pickup - Scan during bag handoff with auto-dismiss confirmation
  
- **Customer Card Integration**: Simplified QR code system using customer IDs
  - All bags for a customer use the same QR code (Customer ID format: CUST123456)
  - Administrator dashboard generates printable customer cards with QR codes
  - Manual entry fallback for damaged or missing QR codes
  - No individual bag tracking - counts managed at order level
  
- **Operator Interface**: Streamlined scanning experience
  - Single "Scan to Process Order" page with hidden input field for scanner
  - Real-time statistics showing orders processed, bags scanned, and orders ready
  - Support for keyboard-based QR scanners (e.g., Amazon ASIN B0DNDNYJ53)
  - Automatic workflow progression without manual confirmation steps
  - Mobile-responsive design for handheld devices
  
- **Automated Notifications**: Email alerts at key workflow stages
  - Affiliate notification when all bags are processed and ready for pickup
  - Customer notification when all bags have been picked up by affiliate
  - Integration with existing email templates and i18n support
  
- **Technical Implementation**: Backend infrastructure updates
  - Updated Order model with bag tracking fields (bagsWeighed, bagsProcessed, bagsPickedUp)
  - New operator API endpoints for scanning and order management
  - Comprehensive audit logging for all scan operations
  - Support for concurrent orders and multiple operators

## Connectivity Monitoring System (June 2025)
- **Real-time Service Monitoring**: Comprehensive monitoring of all external dependencies
  - Monitors MongoDB, SMTP, Payment Gateway, DocuSign, QuickBooks, and DNS health
  - Health checks run every 60 seconds with configurable timeout
  - Maintains historical data for the last 60 checks per service
  - Calculates availability percentages and tracks response times
  
- **Web-based Monitoring Dashboard**: Real-time visibility into system health
  - Available at `/monitoring-dashboard.html` 
  - Overall system health status (healthy/degraded/critical)
  - Individual service status cards with availability metrics
  - Response time charts for performance tracking
  - Auto-refresh every 60 seconds with manual refresh option
  
- **Email Alert System**: Proactive notifications for service failures
  - Automatic alerts when critical services (MongoDB, Payment Gateway, DNS) fail
  - One-hour cooldown between alerts for the same service
  - Detailed service statistics in alert emails
  - Configurable alert recipients via ALERT_EMAIL environment variable

## Email Service Consolidation (June 2025)
- **Simplified Email Configuration**: Removed Amazon SES and Brevo integrations
  - Consolidated to SMTP and Exchange providers only
  - Self-hosted Mailcow server integration for reliable email delivery
  - Simplified configuration with standard SMTP settings
  - Improved email deliverability with proper authentication

## Session Persistence & Browser Navigation (January 2025)
- **10-Minute Session Management**: Comprehensive session persistence across page refresh and browser navigation
  - SessionManager service manages authentication for all user roles (admin, operator, affiliate, customer)
  - Automatic 10-minute inactivity timeout with session renewal on user activity
  - Token and authentication data persisted in localStorage with timestamp tracking
  - Special handling for administrator password change requirements
  - Multi-role support allowing simultaneous logins for different user types
  
- **Browser Navigation Support**: Full browser back/forward button functionality
  - Authentication state maintained across browser navigation
  - Automatic route validation based on authentication status
  - Protected routes redirect to appropriate login pages when unauthenticated
  - Authenticated users redirected from login pages to dashboards
  
- **Tab State Persistence**: Dashboard tab selections persist across refresh and navigation
  - Tab state saved to localStorage and URL parameters
  - Browser history integration with pushState/popstate events
  - Tab content automatically reloads when navigating with browser buttons
  - Retry logic for message passing between iframe and dashboard
  - Fixed translation function initialization errors in operators tab

## Payment Processing Refactoring (January 2025)
- **Generic Payment Methods**: Unified payment processing architecture
  - Single `processPayment` method replacing registration-specific and order-specific methods
  - `processPaymentTestMode` for development environments with configurable scenarios
  - Simplified payment token management and callback handling
  - Consistent error handling across all payment types

## Schedule Pickup Workflow Enhancement (January 2025)
- **Integrated Payment Flow**: Complete end-to-end pickup scheduling with payment
  - Seamless transition from login to pickup form to payment
  - Dynamic calculation of service fees based on weight and delivery requirements
  - Real-time display of WDF rates from system configuration
  - Automatic order creation with payment processing
  - Support for both authenticated and guest checkout flows

## Order Confirmation Page Updates (January 2025)
- **Streamlined User Experience**: Simplified confirmation display
  - Removed redundant delivery details section
  - Clear order summary with itemized pricing
  - Improved navigation options back to main site or dashboard
  - Fixed timing issues with data population
  - Enhanced responsive design for mobile devices

## Translation System Enhancements (January 2025)
- **Payment Form Internationalization**: Complete multi-language support
  - All payment-related UI elements fully translated
  - Dynamic language switching for payment forms
  - Improved placeholder system for email templates
  - Consistent language persistence across payment flows
  - Support for error messages in all supported languages

## Bug Fixes and Stability Improvements (January 2025)
- **OAuth Authentication**: Fixed redirect loop in affiliate dashboard OAuth login
- **Payment Window Detection**: Improved cross-origin communication for payment forms
- **Session Management**: Enhanced session persistence in embedded contexts
- **CSRF Protection**: Refined exemptions for payment provider callbacks
- **Data Display**: Resolved race conditions in order confirmation page

## DocuSign W-9 Integration (June 2025)
- **Electronic W-9 Signatures**: Complete DocuSign integration for tax form collection
  - OAuth 2.0 Authorization Code Grant with PKCE for secure authentication
  - One-click W-9 completion with pre-filled affiliate information
  - Template-based signing using DocuSign's W9 template library
  - Automatic field mapping for owner name, address, city, state, and zip
  - Pop-up window signing experience with status tracking
  - Real-time envelope status polling during signing session
  - Webhook integration for asynchronous status updates
  - CSRF-exempt webhook endpoint for DocuSign callbacks
  - Automatic W9 status updates upon document completion
  - Mobile-friendly signing on any device
  - Complete audit trail with IP addresses and timestamps

## W-9 Tax Compliance & QuickBooks Integration (June 2025)
- **W-9 Collection System**: Complete tax compliance solution for affiliates
  - Secure PDF upload with file size and type validation
  - AES-256-GCM encryption for document storage at rest
  - Manual verification workflow for administrators
  - Payment hold enforcement until W-9 verification
  - Automatic expiry after 3 years with reminder notifications
  - IRS-compliant 7-year data retention with automatic deletion
  - Comprehensive audit logging for all document operations
  - Multi-language email notifications for status changes

- **QuickBooks Export Functionality**: Streamlined accounting integration
  - Export verified affiliates as QuickBooks vendors with tax information
  - Biweekly payment summaries with date range filtering
  - Detailed commission reports showing order-level breakdowns
  - CSV format optimized for QuickBooks Desktop import
  - JSON format available for API integrations
  - Export history tracking with audit trails
  - Masked tax ID display for security compliance

- **Enhanced Security & Compliance**: Enterprise-grade document management
  - Secure storage outside web root directory
  - Role-based access control with admin-only document access
  - Legal hold functionality for documents under audit
  - Automated data retention service with daily checks
  - Complete audit trail for regulatory compliance
  - Encrypted document transmission and storage

## Enhanced UI Components (January 2025)
- **Swirl Spinner Implementation**: Custom loading spinner with WaveMAX branding
  - Elliptical orbit animations for smooth, professional loading states
  - Three size variants (small, default, large) for different contexts
  - Speed controls (smooth, normal, fast) for animation timing
  - Overlay support for form submission feedback
  - Integrated with all asynchronous operations and form submissions
  - Full i18n support for loading messages
  
## Advanced Address Validation (January 2025)
- **Intelligent Geocoding System**: Enhanced address validation with multiple fallback strategies
  - Primary Google Maps geocoding with iframe bridge support
  - Manual address confirmation modal for validation
  - Reverse geocoding to display confirmed addresses
  - Smart address formatting to match form field requirements
  - Automatic service area zoom adjustment on map display
  - Live pricing preview with delivery fee calculations
  - Commission calculator integration for affiliate earnings estimates

## Internationalization (i18n) Support (January 2025)
- **Multi-Language Platform**: Complete internationalization implementation
  - Support for English, Spanish, Portuguese, and German
  - Automatic browser language detection during registration
  - Language preferences stored in user profiles
  - Real-time language switching without page reload
  - Localized email communications based on user preference
  - Parent page language synchronization for embedded content
  - Comprehensive translation coverage for all UI elements

## Bag Tracking Removal (January 2025)
- **Complete System Simplification**: Removed all bag tracking functionality
  - Eliminated physical bag requirements and barcode generation
  - Simplified customer onboarding - no bag purchase needed
  - Streamlined order processing without bag assignments
  - Maintained order history integrity during migration
  - Updated all user interfaces and email templates

## Dynamic Delivery Fee Structure (January 2025)
- **Flexible Pricing Model**: Implemented minimum + per-bag delivery pricing
  - Affiliates set minimum delivery fee (default $25) and per-bag fee (default $5)
  - Customers pay whichever is higher: minimum or calculated per-bag rate
  - Live fee calculator in registration showing pricing for 1, 3, 5, and 10 bags
  - Fee management in affiliate dashboard settings
  - Round-trip pricing automatically calculated

## Enhanced Security Features (January 2025)
- **UUID Implementation**: Enhanced security with UUID generation
  - Customer IDs: CUST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format
  - Administrator IDs: ADM-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx format
  - Maintains backward compatibility with existing sequential IDs
- **Stronger Password Validation**: Enhanced requirements across all user types
  - Real-time validation feedback during registration
  - Prevention of common patterns and user data in passwords
  - Consistent security standards for all user roles

## Mobile-Friendly Implementation (January 2025)
- **Parent-Iframe Communication System**: Advanced mobile support
  - Automatic viewport detection and device classification
  - Dynamic header/footer hiding on mobile devices
  - Full-screen experience for landing pages and dashboards
  - Smooth transitions and animations
  - Secure cross-origin messaging with origin validation
- **Mobile Utilities Library**: Comprehensive mobile features
  - Device detection (iOS, Android, tablets)
  - Touch gesture support
  - Safe area handling for devices with notches
  - Orientation change handling
  - Mobile-specific optimizations

## Development Process Improvements

### Development Backlog Queue System
- **Introduced Backlog Management**: Created `BACKLOG.md` for tracking pending work items
  - Organized by priority levels (High, Medium, Low) with detailed context
  - Maintains history of when items were added and their current status
  - Enables systematic approach to addressing technical debt and improvements
  - Integrated into AI assistant's session startup checklist for consistency
  - Provides clear reference point for picking work in future sessions

### AI Development Collaboration Framework
- **Created Interactive Starting Prompt**: Developed comprehensive `init.prompt` file documenting proven collaborative processes
  - Systematic investigation approaches for debugging complex issues
  - Testing philosophy emphasizing tests as source of truth
  - Code quality standards and git workflow best practices
  - Lessons learned from OAuth integration, password security, and administrator management sessions
  - Communication patterns and prompt evolution strategies
  - **References `OPERATING_BEST_PRACTICES.md`** for known issues and workarounds
- **Published HTML Version**: Created developer-friendly HTML presentation of the collaboration framework
  - Available at `/wavemax-development-prompt.html` for easy sharing
  - Tweet-friendly formatting with social media meta tags
  - Visual hierarchy with emojis, colors, and organized sections for different aspects
  - Mobile responsive design showcasing AI-assisted development best practices
- **Enhanced AI Assistant Persona**: Added comprehensive expertise profile to `init.prompt`
  - Defines AI assistant's operating persona as expert Node.js/Express developer
  - Filters knowledge and decision-making through project-specific expertise
  - Proficiency in authentication systems including JWT, OAuth 2.0, and Passport.js strategies
  - Test-Driven Development (TDD) expertise shapes code analysis and recommendations
  - Security-first approach to analyzing code and suggesting solutions
  - Specific expertise in affiliate program patterns influences implementation decisions
- **Operating Best Practices**: Created `OPERATING_BEST_PRACTICES.md` documenting:
  - PM2 debugging workarounds and known issues
  - CSP compliance requirements (no inline scripts)
  - Dynamic page loading script initialization patterns
  - Multiple initialization strategies for dynamically loaded content
  - Common debugging patterns and solutions
  - Environment-specific configurations

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
  - Automatic account setup section hiding after successful OAuth authentication
  - Improved form layout with username/password fields near OAuth controls
- **Flexible Configuration**: Added environment-based OAuth and rate limiting controls
  - `OAUTH_CALLBACK_URI` setting for production deployment flexibility
  - `RELAX_RATE_LIMITING` flag for development and testing environments
  - Separates OAuth callbacks from main application URLs for embedded deployments
- **Database Polling OAuth**: Implemented reliable OAuth session management
  - Database-based OAuth result polling instead of postMessage
  - Works reliably in embedded iframe contexts
  - Automatic cleanup of OAuth sessions with proper timeout handling
- **Account Conflict Resolution**: Comprehensive handling for social account conflicts
  - Customer model conditional validation for OAuth registrations
  - OAuth customers don't require password fields when `registrationMethod` is social
  - Account conflict modals for existing users attempting OAuth registration
  - Seamless cross-user-type conflict detection and resolution
- **Enhanced i18n Support**: Full internationalization of OAuth flows
  - Translated success messages for all supported languages
  - Provider name interpolation in success notifications
  - Language-aware OAuth error messages

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

### Dynamic Pricing and Revenue Features
- **Dynamic WDF Pricing**: Implemented SystemConfig-based pricing
  - WDF (Wash, Dry, Fold) rates now managed through SystemConfig model
  - Configurable per-pound pricing with min/max validation ($0.50 - $10.00)
  - Public API endpoint for fetching current rates
  - Automatic rate application on order creation
- **Revenue Calculator**: Enhanced affiliate earnings calculator
  - Updated default delivery fee from $10 to $25
  - Real-time commission calculation: 10% of WDF service + 100% delivery fees
  - Accurate monthly and yearly projections
  - CSP-compliant external JavaScript implementation
- **Commission System**: Precise affiliate commission tracking
  - Automatic commission calculation on order completion
  - Handles edge cases (zero delivery fee, high-volume orders)
  - Floating-point precision handling for accurate payouts
  - Comprehensive test coverage for commission scenarios

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

For a detailed history of all changes, see [CHANGELOG.md](CHANGELOG.md).
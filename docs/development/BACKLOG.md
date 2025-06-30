# WaveMAX Development Backlog Queue

This file maintains a prioritized list of tasks and issues to be addressed in future development sessions.

## How to Use This Backlog
- Items are listed in priority order (High, Medium, Low)
- Each item includes context about when it was identified
- Reference this file at the start of sessions to pick work items
- Update status when items are completed or in progress

## Backlog Items

### High Priority


#### 2. Improve Test Coverage to Near 100%
- **Added**: 2025-06-03
- **Status**: Pending
- **Context**: Need comprehensive test coverage across all modules
- **Details**:
  - Focus on untested or partially tested modules
  - Add edge case testing
  - Ensure all error paths are covered
  - Mock external dependencies properly

### Medium Priority

#### 1. Add More SystemConfig Values
- **Added**: 2025-06-03
- **Status**: Pending
- **Context**: Expand SystemConfig for more dynamic values
- **Details**:
  - Add commission percentage to SystemConfig (currently hardcoded at 10%)
  - Add default delivery fee ranges
  - Add order size weight ranges (small, medium, large)
  - Consider making more business logic configurable

#### 2. Enhance Revenue Calculator
- **Added**: 2025-06-03  
- **Status**: Pending
- **Context**: Add more features to the revenue calculator
- **Details**:
  - Add yearly projections
  - Add different service tiers (express, standard)
  - Add visual charts/graphs for earnings projections
  - Consider adding cost deductions (gas, time)

### Low Priority

#### 1. Code Cleanup - Remove Unused Code
- **Added**: 2025-01-07
- **Status**: Pending
- **Context**: Comprehensive code audit identified ~1,500 lines of unused code
- **Details**: See CODE_AUDIT_REPORT.md for full details
  - Remove 4 unused npm packages (crypto-js, joi, multer, @aws-sdk/credential-provider-ini)
  - Remove 15 unused imports across various files
  - Remove 17 unused functions (~300 lines of dead code)
  - Remove 5 orphaned files that are never referenced
  - Clean up 500+ console.log statements (security concern with OAuth data logging)
  - Fix missing scripts/seed.js reference in package.json
- **Implementation Plan**:
  - Phase 1: Remove unused dependencies and orphaned files (low risk)
  - Phase 2: Remove unused functions and imports (medium risk)
  - Phase 3: Replace console.log with proper logging (medium risk)
- **Testing Required**: Full test suite after each phase

#### 2. Internationalization (i18n) Support
- **Added**: 2025-01-06
- **Status**: Pending
- **Context**: Add multi-language support for global accessibility
- **Details**:
  - Implement i18n framework (e.g., i18next) for both frontend and backend
  - Create language files for common languages (Spanish, French, etc.)
  - Add language selector to all user interfaces
  - Translate email templates for different languages
  - Support RTL (right-to-left) languages
  - Store user language preferences in profiles
  - Consider locale-specific formatting (dates, currency, numbers)

#### 3. ADA Compliance and Accessibility
- **Added**: 2025-01-06
- **Status**: Pending
- **Context**: Ensure full ADA compliance for users with disabilities
- **Details**:
  - Add proper ARIA labels to all interactive elements
  - Ensure keyboard navigation works throughout the application
  - Implement proper focus management and skip links
  - Add alt text to all images and icons
  - Ensure color contrast meets WCAG 2.1 AA standards
  - Add screen reader announcements for dynamic content
  - Test with accessibility tools (axe, WAVE, NVDA/JAWS)
  - Create accessibility statement page
  - Ensure forms have proper labels and error messages
  - Add captions/transcripts for any video content

#### 4. Implement Excel Export for Orders
- **Added**: 2025-06-03
- **Status**: Pending
- **Context**: Excel export endpoint returns 501 Not Implemented
- **Details**:
  - Order export supports CSV and JSON but not Excel
  - Need to implement Excel export functionality using a library like xlsx
  - Endpoint exists at `/api/v1/orders/export?format=excel`

#### 5. Add Admin UI for SystemConfig Management
- **Added**: 2025-06-03
- **Status**: Pending
- **Context**: Currently SystemConfig can only be managed via API
- **Details**:
  - Create admin dashboard page for system configuration
  - Add UI to view and edit configuration values
  - Add validation and confirmation dialogs
  - Show configuration history/audit log

## Completed Items

#### 1. Complete Coverage Analysis Implementation
- **Added**: 2025-01-06
- **Completed**: 2025-06-02
- **Status**: COMPLETED
- **Context**: Coverage analysis routes and UI implemented
- **Details**:
  - Coverage routes mounted in server.js
  - Full coverage analysis UI created in public/coverage-analysis/
  - Includes critical files, action plans, and test templates

#### 2. Implement Dynamic WDF Pricing
- **Added**: 2025-06-03
- **Completed**: 2025-06-03
- **Status**: COMPLETED
- **Context**: Replace hardcoded WDF rates with dynamic SystemConfig
- **Details**:
  - Created SystemConfig model for dynamic configuration
  - Updated Order model to fetch rates from SystemConfig
  - Added public API endpoints for configuration
  - Updated revenue calculator with dynamic rates
  - Added comprehensive test coverage
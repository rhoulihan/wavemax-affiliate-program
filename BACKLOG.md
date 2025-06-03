# WaveMAX Development Backlog Queue

This file maintains a prioritized list of tasks and issues to be addressed in future development sessions.

## How to Use This Backlog
- Items are listed in priority order (High, Medium, Low)
- Each item includes context about when it was identified
- Reference this file at the start of sessions to pick work items
- Update status when items are completed or in progress

## Backlog Items

### High Priority

#### 1. Fix Failing Email Service Tests
- **Added**: 2025-01-06
- **Status**: BLOCKED (2025-06-03)
- **Context**: Email service tests are failing with console transport
- **Details**: 
  - 36 out of 38 email service tests are failing
  - Console transport is not logging as expected in test environment
  - Issue: Module caching and Jest mock timing prevents proper mocking of console.log
  - Created manual mock in tests/__mocks__/server/utils/emailService.js for other tests to use
- **Recommendation**: Use the manual mock for testing components that depend on email service rather than trying to test the email service internals with complex mocking

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

#### 1. Implement Excel Export for Orders
- **Added**: 2025-06-03
- **Status**: Pending
- **Context**: Excel export endpoint returns 501 Not Implemented
- **Details**:
  - Order export supports CSV and JSON but not Excel
  - Need to implement Excel export functionality using a library like xlsx
  - Endpoint exists at `/api/v1/orders/export?format=excel`

#### 2. Add Admin UI for SystemConfig Management
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
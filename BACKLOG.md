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
- **Status**: Pending
- **Context**: Email service tests are failing with console transport
- **Details**: 
  - Tests in `tests/unit/emailService.test.js` have uncommitted changes
  - New test files created: `emailServiceMocked.test.js` and `emailServiceSimple.test.js`
  - Console transport is not logging as expected in tests
  - Need to investigate mock setup and console spy configuration

#### 2. Complete Coverage Analysis Implementation
- **Added**: 2025-01-06
- **Status**: Pending
- **Context**: Coverage analysis work started but not completed
- **Details**:
  - Uncommitted changes in `server.js` to mount coverage routes
  - New files created: `server/routes/coverageRoutes.js` and `public/coverage-analysis/`
  - Need to complete implementation and ensure proper integration
  - Should be mounted before CSRF middleware

### Medium Priority

### Low Priority

## Completed Items
_Move items here when completed with date of completion_
# Dead Code Analysis Report - WaveMAX Affiliate Program

## Executive Summary

This report identifies dead code, unused functions, and potential improvements in the WaveMAX Affiliate Program codebase based on test coverage analysis and code review.

## Major Findings

### 1. Order.js Model - Critical Dead Code

**Location**: `/server/models/Order.js`

#### Issue 1: Unreachable 'scheduled' Status (Lines 138-140)
```javascript
case 'scheduled':
  if (!this.scheduledAt) this.scheduledAt = now;
  break;
```
- **Problem**: Status enum only includes `['pending', 'processing', 'processed', 'complete', 'cancelled']`
- **Impact**: This code block will never execute
- **Recommendation**: Remove this case or add 'scheduled' to the status enum

#### Issue 2: Non-existent 'orderProcessingStatus' Field (Lines 157-174)
```javascript
if (this.isModified('orderProcessingStatus')) {
  // ... handling for washing, drying, folding, completed
}
```
- **Problem**: The field 'orderProcessingStatus' is not defined in the schema
- **Impact**: Entire block is dead code - will never execute
- **Recommendation**: Remove this entire block

#### Issue 3: Duplicate Timestamp Fields
- Schema has both `processingStarted` and `processingStartedAt`
- Schema has both `processingCompleted` and `processedAt`
- **Recommendation**: Remove duplicates and standardize naming

### 2. AuthController.js - Unused Functions and Complex Dead Code

**Location**: `/server/controllers/authController.js`

#### Unused/Dead Functions:
1. **linkSocialAccount** (lines 1452-1541)
   - Route exists but no frontend usage found
   - Designed to link social accounts to existing affiliates
   
2. **socialLogin** (lines 1546-1667)
   - POST endpoint for social login callback
   - OAuth flow uses GET callbacks, making this redundant

#### Unreachable Code Paths:
1. **Administrator/Operator Password Reset** (lines 668-673, 752-763)
   - These user types use different authentication methods
   - Operators use PINs, not passwords
   
2. **Facebook/LinkedIn OAuth Handlers** (lines 702-710)
   - Environment variables for these providers are not configured
   - Only Google OAuth is actively used

#### Overly Complex Code:
1. **Popup/Embedded Context Handling** (lines 1743-1787, 1808-1871, 1876-1922)
   - Extensive code for handling OAuth in popups
   - Multiple redundant communication methods
   - Could be simplified significantly

### 3. Unused Routes

**Location**: Various route files

1. `/api/auth/social/link` - Maps to unused linkSocialAccount
2. `/api/auth/social/callback` - Maps to unused socialLogin
3. `/api/auth/customer/*/callback` - Redirect routes that appear unused

### 4. Unused Utility Functions

**Location**: `/server/utils/helpers.js`

1. **generateRandomString** - No production usage found
2. **sanitizeForCSV** - No production usage found
3. **calculatePercentage** - No production usage found

## Recommendations

### High Priority - Remove Dead Code

1. **Order.js**:
   ```javascript
   // Remove lines 138-140 (scheduled case)
   // Remove lines 157-174 (orderProcessingStatus block)
   // Remove duplicate fields (processingStarted or processingStartedAt)
   ```

2. **AuthController.js**:
   ```javascript
   // Remove linkSocialAccount function (lines 1452-1541)
   // Remove socialLogin function (lines 1546-1667)
   // Simplify OAuth callback handling
   ```

3. **Routes**:
   - Remove `/api/auth/social/link` route
   - Remove `/api/auth/social/callback` route
   - Remove unused customer OAuth redirect routes

### Medium Priority - Refactor Complex Code

1. **Simplify OAuth Callback Handling**:
   - Reduce popup/embedded context complexity
   - Consolidate communication methods
   - Remove redundant error handling

2. **Consolidate Password Reset**:
   - Remove admin/operator branches from password reset
   - These user types have separate authentication flows

### Low Priority - Clean Up Utilities

1. Consider removing unused helper functions or document their intended use
2. Add deprecation warnings if functions are kept for backward compatibility

## Impact Analysis

Removing this dead code would:
- Reduce codebase size by approximately 15-20%
- Improve test coverage by removing untestable code
- Simplify maintenance and debugging
- Reduce potential security surface area

## Testing Considerations

Before removing any code:
1. Ensure comprehensive test coverage of remaining functionality
2. Verify no external systems depend on "unused" endpoints
3. Check for any scheduled jobs or background processes using these functions
4. Review git history to understand why code was added originally

## Conclusion

The codebase contains significant dead code, primarily in Order.js model and authController.js. Most of this appears to be from incomplete refactoring or features that were planned but never fully implemented. Removing this dead code will improve maintainability and test coverage.
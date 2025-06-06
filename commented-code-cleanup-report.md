# Commented-Out Code Cleanup Report

## Summary
After analyzing the WaveMAX Affiliate Program codebase, I found several areas where code cleanup would be beneficial. The main issues are not large blocks of commented-out code (which are relatively rare), but rather excessive console.log statements that should be removed from production code.

## Findings

### 1. Console Statements in Production Code

#### Server-Side Console Statements
Found console statements that should be removed or replaced with proper logging:

**authController.js** (23 console.log statements):
- Lines 466-468: Debug logging for customer affiliate info
- Lines 500: Logging entire customer response object
- Lines 803, 868: OAuth callback debug logs
- Lines 1029-1048: Popup script debug logs
- Lines 1539, 1558: OAuth session polling debug
- Lines 1588, 1650: Customer OAuth callback debug
- Lines 1809-1827: Customer popup script debug

**passport-config.js** (14 console statements):
- Lines 26-190: Various OAuth strategy debug logs
- Lines 207, 291, 373: Error logs that should use proper logging

**customerController.js** (3 console statements):
- Line 128: console.warn for email failures
- Lines 491, 545: console.error statements

**affiliateController.js** (1 console statement):
- Line 101: console.warn for email failures

#### Client-Side Console Statements
Found 461 console statements in public JavaScript files at `/public/assets/js/`. This is excessive and should be cleaned up for production.

### 2. Actual Commented-Out Code
The codebase is relatively clean of large blocks of commented-out code. Most comments are documentation or explanatory notes, which is good practice.

### 3. TODO/FIXME Comments
Found very few TODO/FIXME comments, indicating good code maintenance practices.

## Recommendations

### High Priority
1. **Remove Debug Console Logs from authController.js**
   - All OAuth debug logging should be removed or converted to proper logging
   - Customer login response logging exposes sensitive data

2. **Clean Up passport-config.js Console Logs**
   - Convert console.log to proper debug logging
   - Keep console.error but use the logger utility instead

3. **Remove Excessive Client-Side Console Logs**
   - 461 console statements in public JS is too many for production
   - Consider using a build process to strip console logs in production

### Medium Priority
1. **Replace console.error with Logger**
   - customerController.js: Lines 491, 545
   - Use the existing logger utility for consistency

2. **Replace console.warn with Logger**
   - customerController.js: Line 128
   - affiliateController.js: Line 101

### Low Priority
1. **Review Test Console Logs**
   - Some test files have console logs that could be removed
   - Not critical as they don't affect production

## Implementation Steps

1. Create a logging configuration that can be toggled for development/production
2. Replace all console.* statements with appropriate logger calls
3. For client-side code, implement a build process that strips console logs
4. Add ESLint rule to prevent new console statements in production code

## Files to Clean

### Server Files (Priority)
- `/server/controllers/authController.js`
- `/server/config/passport-config.js`
- `/server/controllers/customerController.js`
- `/server/controllers/affiliateController.js`

### Client Files (Secondary)
- All files in `/public/assets/js/` directory

## Conclusion
The codebase is well-maintained with minimal commented-out code. The main issue is excessive console logging, particularly in authentication flows and client-side code. Cleaning these up will improve security (no accidental data leaks) and performance.
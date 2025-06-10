# Administrator Account Setup Changes

## Summary

The administrator account setup process has been changed from using a manual script to automatic creation with forced password change on first login.

## Changes Implemented

### 1. Database Model Updates
- Added `requirePasswordChange` field to Administrator model
- Added `passwordHistory` array to track previous 5 passwords
- Implemented `isPasswordInHistory` method to prevent password reuse
- Updated pre-save middleware to manage password history

### 2. Authentication Flow
- Modified administrator login to check for `requirePasswordChange` flag
- Return limited token when password change is required
- Added password change enforcement in auth middleware
- Created dedicated change password endpoint

### 3. Automatic Account Creation
- Created `init-admin.js` script for automatic admin creation
- Integrated into server startup process
- Default credentials:
  - Email: admin@wavemaxlaundry.com
  - Password: WaveMAX!2024
  - Permissions: All (super admin)

### 4. Frontend Updates
- Added password change form to administrator login page
- Handle `requirePasswordChange` response from login API
- Force password change before allowing dashboard access
- Clear tokens and redirect after successful password change

### 5. Security Features
- Password must be changed on first login
- New password cannot match any of the last 5 passwords
- Account lockout after 5 failed attempts
- Comprehensive audit logging
- Strong password requirements enforced

## Migration Notes

- The old `create-admin-directly.js` script is now deprecated
- Existing administrator accounts are not affected
- Default admin is only created if no administrators exist
- Password history tracking starts with first password change

## Usage

1. Start the server - admin account is created automatically
2. Login with default credentials
3. Change password when prompted
4. Use new password for all subsequent logins

## Files Modified

- `/server/models/Administrator.js` - Added password history
- `/server/controllers/authController.js` - Added password change check
- `/server/controllers/administratorController.js` - Added change password endpoint
- `/server/routes/administratorRoutes.js` - Added change password route
- `/server/middleware/auth.js` - Added password change enforcement
- `/public/assets/js/administrator-login-init.js` - Added password change UI
- `/init-admin.js` - New automatic initialization script
- `/server.js` - Integrated admin initialization
- `/README.md` - Updated setup documentation
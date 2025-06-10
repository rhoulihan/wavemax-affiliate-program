# DEPRECATED: create-admin-directly.js

This script has been deprecated in favor of automatic administrator account creation during system initialization.

## Why Deprecated?

The system now automatically creates a default administrator account when the database is first initialized. This provides:

1. **Better Security**: Forces password change on first login
2. **Simpler Setup**: No need to run separate scripts
3. **Consistent Experience**: Same setup process for all deployments
4. **Password History**: Tracks previous passwords to prevent reuse

## New Process

When the server starts for the first time:

1. A default administrator account is automatically created with:
   - Email: admin@wavemaxlaundry.com
   - Password: WaveMAX!
   - Permissions: All (super admin)

2. On first login, the administrator is required to change their password

3. The new password must meet security requirements and cannot match previous passwords

## Migration

If you have existing administrator accounts created with this script, they will continue to work normally. The automatic creation only happens if no administrator accounts exist in the database.

## See Also

- `/init-admin.js` - The new automatic initialization script
- `/README.md` - Updated setup instructions
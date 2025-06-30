# Encryption Key Migration Guide

## Overview

When rotating the `ENCRYPTION_KEY` in the WaveMAX Affiliate Program, all encrypted data must be migrated from the old key to the new key. This guide explains the migration process and the tools available.

## Encrypted Data in the System

### Affiliate Model
The following fields are encrypted in the Affiliate model:
- **accountNumber** - Bank account number for direct deposit
- **routingNumber** - Bank routing number for direct deposit
- **paypalEmail** - PayPal email address for PayPal payments

### Customer Model (Deprecated)
Previously encrypted fields have been removed as payment processing is now handled entirely by Paygistix:
- ~~cardholderName~~ - Removed
- ~~expiryDate~~ - Removed
- ~~cardNumber~~ - Never stored
- ~~billingZip~~ - Removed

## Migration Process

### Option 1: Automatic Migration During Key Rotation

The easiest way to handle migration is during the key rotation process:

```bash
cd /var/www/wavemax/wavemax-affiliate-program
./scripts/rotate-credentials.sh
```

When the script detects that the ENCRYPTION_KEY has changed, it will prompt:
```
🔄 Encrypted data migration required...
Do you want to migrate encrypted data now? (yes/no): 
```

Selecting "yes" will automatically run the migration with the old and new keys.

### Option 2: Manual Migration

If you need to run the migration separately:

```bash
cd /var/www/wavemax/wavemax-affiliate-program
node scripts/migrate-encrypted-data.js <OLD_ENCRYPTION_KEY> <NEW_ENCRYPTION_KEY>
```

Example:
```bash
node scripts/migrate-encrypted-data.js a1b2c3d4e5f6... 9z8y7x6w5v4u...
```

### Option 3: Interactive Migration

Run the migration script without arguments for an interactive process:

```bash
node scripts/migrate-encrypted-data.js
```

The script will prompt for:
1. Old ENCRYPTION_KEY (64 hex characters)
2. New ENCRYPTION_KEY (64 hex characters)

## Migration Features

### 1. **State Management**
The migration process tracks its progress in `backup/migration-state.json`:
- Total records to process
- Records processed successfully
- Failed records with error details
- Last processed ID for resumption

### 2. **Resumable Process**
If the migration is interrupted:
- Run the script again
- It will detect the previous state
- Choose to continue from where it left off

### 3. **Automatic Backup**
Before migration begins:
- Creates a backup of all encrypted field metadata
- Stored in `backup/encrypted-data-backup-<timestamp>.json`
- Does NOT contain actual encrypted values, only metadata

### 4. **Error Handling**
- Failed migrations are logged but don't stop the process
- All failures are recorded with timestamps
- A final report shows all failures for manual review

### 5. **Two-Phase Process**
1. **Phase 1: Affiliate Migration**
   - Decrypt payment data with old key
   - Re-encrypt with new key
   - Update database records

2. **Phase 2: Customer Cleanup**
   - Remove deprecated payment fields
   - Clean up legacy data

## Migration Output

### Progress Indicators
```
[INFO] Connecting to MongoDB...
[SUCCESS] Connected to MongoDB
[INFO] Found 45 affiliates and 0 customers to process
[PROGRESS] Migrated affiliate AFF-123 (507f1f77bcf86cd799439011)
[SUCCESS] Affiliate migration completed
```

### Final Report
```
=== Encryption Key Migration Report ===

Start Time: 2025-06-30T12:00:00.000Z
End Time: 2025-06-30T12:05:00.000Z
Duration: 5 minutes

Affiliates:
  Total: 45
  Processed: 45
  Successful: 44
  Failed: 1

Failures:
  - 507f1f77bcf86cd799439012: Decryption failed: Invalid auth tag
```

## Troubleshooting

### Common Issues

1. **"Decryption failed: Unsupported state or unable to authenticate data"**
   - The data was encrypted with a different key
   - Verify you're using the correct old key

2. **"Old and new keys cannot be the same"**
   - You're trying to migrate to the same key
   - Ensure you have different keys

3. **"Migration has already been completed"**
   - The migration state shows completion
   - Choose to run again if needed

### Manual Recovery

If automated migration fails for specific records:

1. Check the migration report for failed record IDs
2. Use MongoDB shell to manually inspect the records
3. Consider manually updating or removing corrupted data
4. Re-run migration for remaining records

## Best Practices

1. **Test First**
   - Run migration in a test environment
   - Verify data integrity after migration

2. **Backup Production**
   - Ensure recent database backup exists
   - Keep the old ENCRYPTION_KEY secure

3. **Monitor Application**
   - Watch application logs during migration
   - Test affiliate payment information access

4. **Clean Up**
   - Delete migration state file after success
   - Remove old backup files
   - Update documentation with rotation date

## Security Considerations

1. **Key Storage**
   - Never commit encryption keys to git
   - Store old keys securely for emergency recovery
   - Delete old keys after successful migration

2. **Access Control**
   - Limit who can run migration scripts
   - Audit migration execution
   - Monitor for unauthorized access attempts

3. **Data Validation**
   - Verify decrypted data makes sense
   - Check for data corruption
   - Test payment processing after migration
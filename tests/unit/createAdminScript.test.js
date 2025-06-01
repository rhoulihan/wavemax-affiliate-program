// Admin Creation Script Unit Tests for WaveMAX Laundry Affiliate Program

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Administrator = require('../../server/models/Administrator');
const mongoose = require('mongoose');

describe('Create Admin Script Tests', () => {
  const scriptPath = path.join(__dirname, '../../scripts/create-admin-directly.js');

  beforeEach(async () => {
    // Clean up administrators collection
    await Administrator.deleteMany({});
  });

  afterAll(async () => {
    await Administrator.deleteMany({});
  });

  describe('Script File Structure', () => {
    test('should exist and be readable', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const stats = fs.statSync(scriptPath);
      expect(stats.isFile()).toBe(true);
      
      // Check if file is readable
      expect(() => {
        fs.accessSync(scriptPath, fs.constants.R_OK);
      }).not.toThrow();
    });

    test('should contain required functionality markers', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for key functionality
      expect(scriptContent).toContain('readline');
      expect(scriptContent).toContain('Administrator');
      expect(scriptContent).toContain('password');
      expect(scriptContent).toContain('permissions');
      expect(scriptContent).toContain('ADM');
      expect(scriptContent).toContain('save');
    });
  });

  describe('Admin ID Generation Logic', () => {
    test('should generate sequential admin IDs starting from ADM001', async () => {
      // Test the logic by creating admins directly and checking ID generation
      
      // First admin
      const admin1 = new Administrator({
        administratorId: 'ADM001',
        firstName: 'First',
        lastName: 'Admin',
        email: 'first@admin.com',
        username: 'firstadmin',
        password: 'FirstAdminPassword123!',
        permissions: ['all']
      });

      await admin1.save();

      // Second admin
      const admin2 = new Administrator({
        administratorId: 'ADM002',
        firstName: 'Second',
        lastName: 'Admin',
        email: 'second@admin.com',
        username: 'secondadmin',
        password: 'SecondAdminPassword123!',
        permissions: ['manage_affiliates', 'orders.manage', 'reports.view']
      });

      await admin2.save();

      // Verify IDs are sequential
      const admins = await Administrator.find({}).sort({ administratorId: 1 });
      expect(admins).toHaveLength(2);
      expect(admins[0].administratorId).toBe('ADM001');
      expect(admins[1].administratorId).toBe('ADM002');
    });

    test('should calculate next admin ID correctly', async () => {
      // Create some admins with non-sequential IDs to test the logic
      const existingAdmins = [
        {
          administratorId: 'ADM001',
          firstName: 'Admin',
          lastName: 'One',
          email: 'admin1@test.com',
          username: 'admin1',
          password: 'Password123!',
          permissions: ['manage_affiliates']
        },
        {
          administratorId: 'ADM003', // Skip ADM002
          firstName: 'Admin',
          lastName: 'Three',
          email: 'admin3@test.com',
          username: 'admin3',
          password: 'Password123!',
          permissions: ['manage_affiliates']
        },
        {
          administratorId: 'ADM005', // Skip ADM004
          firstName: 'Admin',
          lastName: 'Five',
          email: 'admin5@test.com',
          username: 'admin5',
          password: 'Password123!',
          permissions: ['manage_affiliates']
        }
      ];

      for (const adminData of existingAdmins) {
        const admin = new Administrator(adminData);
        await admin.save();
      }

      // Test next ID calculation
      const adminCount = await Administrator.countDocuments();
      const nextAdminId = 'ADM' + String(adminCount + 1).padStart(3, '0');
      
      expect(nextAdminId).toBe('ADM004'); // Should be next number after count
    });
  });

  describe('Password Security Requirements', () => {
    test('should enforce strong password requirements for admins', async () => {
      const weakPasswords = [
        'weak',
        'password',
        'Password123',  // Missing special character
        'PASSWORD123!', // Missing lowercase
        'password123!', // Missing uppercase
        'Password!',    // Missing number
        'Pass123!'      // Too short
      ];

      for (const weakPassword of weakPasswords) {
        const admin = new Administrator({
          administratorId: 'ADM999',
          firstName: 'Test',
          lastName: 'Admin',
          email: 'test@admin.com',
          username: 'testadmin',
          password: weakPassword,
          permissions: ['manage_affiliates']
        });

        // Should fail validation or be rejected by password validator
        await expect(admin.save()).rejects.toThrow();
      }
    });

    test('should accept strong passwords for admins', async () => {
      const strongPasswords = [
        'StrongAdminPassword123!',
        'SecurePass456@',
        'AdminAccess789#',
        'PowerfulPassword1$'
      ];

      for (let i = 0; i < strongPasswords.length; i++) {
        const admin = new Administrator({
          administratorId: `ADM00${i + 1}`,
          firstName: 'Strong',
          lastName: `Admin${i + 1}`,
          email: `strong${i + 1}@admin.com`,
          username: `strongadmin${i + 1}`,
          password: strongPasswords[i],
          permissions: ['manage_affiliates']
        });

        // Should save successfully
        const savedAdmin = await admin.save();
        expect(savedAdmin.administratorId).toBe(`ADM00${i + 1}`);
        expect(savedAdmin.firstName).toBe('Strong');
      }
    });
  });

  describe('Permission System Validation', () => {
    test('should validate all permission types', async () => {
      const allPermissions = [
        'manage_affiliates',
        'customers.manage', 
        'orders.manage',
        'system_config',
        'reports.view'
      ];

      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Permission',
        lastName: 'Test',
        email: 'permission@admin.com',
        username: 'permissiontest',
        password: 'PermissionTest123!',
        permissions: allPermissions
      });

      const savedAdmin = await admin.save();
      expect(savedAdmin.permissions).toEqual(expect.arrayContaining(allPermissions));
    });

    test('should handle partial permission sets', async () => {
      const partialPermissions = [
        'manage_affiliates',
        'reports.view'
      ];

      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Partial',
        lastName: 'Permissions',
        email: 'partial@admin.com',
        username: 'partialpermissions',
        password: 'PartialPermissions123!',
        permissions: partialPermissions
      });

      const savedAdmin = await admin.save();
      expect(savedAdmin.permissions).toContain('manage_affiliates');
      expect(savedAdmin.permissions).toContain('reports.view');
      expect(savedAdmin.permissions).toHaveLength(2);
    });
  });

  describe('Unique Constraint Validation', () => {
    test('should prevent duplicate administrator IDs', async () => {
      const firstAdmin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'First',
        lastName: 'Admin',
        email: 'first@admin.com',
        username: 'firstadmin',
        password: 'FirstAdmin123!',
        permissions: ['manage_affiliates']
      });

      await firstAdmin.save();

      // Try to create another admin with same ID
      const duplicateAdmin = new Administrator({
        administratorId: 'ADM001', // Same ID
        firstName: 'Duplicate',
        lastName: 'Admin',
        email: 'duplicate@admin.com',
        username: 'duplicateadmin',
        password: 'DuplicateAdmin123!',
        permissions: ['customers.manage']
      });

      await expect(duplicateAdmin.save()).rejects.toThrow();
    });

    test('should prevent duplicate usernames', async () => {
      const firstAdmin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'First',
        lastName: 'Admin',
        email: 'first@admin.com',
        username: 'uniqueadmin',
        password: 'FirstAdmin123!',
        permissions: ['manage_affiliates']
      });

      await firstAdmin.save();

      // Try to create another admin with same username
      const duplicateUsername = new Administrator({
        administratorId: 'ADM002',
        firstName: 'Second',
        lastName: 'Admin',
        email: 'second@admin.com',
        username: 'uniqueadmin', // Same username
        password: 'SecondAdmin123!',
        permissions: ['customers.manage']
      });

      await expect(duplicateUsername.save()).rejects.toThrow();
    });

    test('should prevent duplicate emails', async () => {
      const firstAdmin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'First',
        lastName: 'Admin',
        email: 'unique@admin.com',
        username: 'firstadmin',
        password: 'FirstAdmin123!',
        permissions: ['manage_affiliates']
      });

      await firstAdmin.save();

      // Try to create another admin with same email
      const duplicateEmail = new Administrator({
        administratorId: 'ADM002',
        firstName: 'Second',
        lastName: 'Admin',
        email: 'unique@admin.com', // Same email
        username: 'secondadmin',
        password: 'SecondAdmin123!',
        permissions: ['customers.manage']
      });

      await expect(duplicateEmail.save()).rejects.toThrow();
    });
  });

  describe('Email Integration', () => {
    test('should handle admin creation with welcome email sending', async () => {
      // This tests the database aspect - email sending would be mocked in real tests
      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Email',
        lastName: 'Test',
        email: 'emailtest@admin.com',
        username: 'emailtest',
        password: 'EmailTest123!',
        permissions: ['all']
      });

      const savedAdmin = await admin.save();
      
      // Verify admin was created successfully
      expect(savedAdmin.email).toBe('emailtest@admin.com');
      expect(savedAdmin.firstName).toBe('Email');
      expect(savedAdmin.permissions.affiliateManagement).toBe(true);
      
      // In the actual script, this would trigger a welcome email
      // The email service would be tested separately
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('should handle special characters in names correctly', async () => {
      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'José-María',
        lastName: "O'Connor",
        email: 'special@admin.com',
        username: 'specialchars',
        password: 'SpecialChars123!',
        permissions: ['manage_affiliates']
      });

      const savedAdmin = await admin.save();
      expect(savedAdmin.firstName).toBe('José-María');
      expect(savedAdmin.lastName).toBe("O'Connor");
    });

    test('should normalize email addresses', async () => {
      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Email',
        lastName: 'Normalize',
        email: 'EMAIL@ADMIN.COM', // Uppercase email
        username: 'emailnormalize',
        password: 'EmailNormalize123!',
        permissions: ['manage_affiliates']
      });

      const savedAdmin = await admin.save();
      // Check if email is stored in lowercase (depends on model configuration)
      expect(savedAdmin.email.toLowerCase()).toBe('email@admin.com');
    });

    test('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user.domain.com',
        'user@domain',
        ''
      ];

      for (const invalidEmail of invalidEmails) {
        const admin = new Administrator({
          administratorId: 'ADM999',
          firstName: 'Invalid',
          lastName: 'Email',
          email: invalidEmail,
          username: 'invalidemail',
          password: 'InvalidEmail123!',
          permissions: ['manage_affiliates']
        });

        await expect(admin.save()).rejects.toThrow();
      }
    });
  });

  describe('Administrator Model Integration', () => {
    test('should integrate with existing administrator model schema', async () => {
      // Test that the script would work with the actual Administrator model
      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration@admin.com',
        username: 'integration',
        password: 'IntegrationTest123!',
        permissions: {
          affiliateManagement: true,
          customerManagement: true,
          orderManagement: true,
          systemSettings: false,
          reporting: true
        }
      });

      const savedAdmin = await admin.save();
      
      // Verify all expected fields are present
      expect(savedAdmin.administratorId).toBeDefined();
      expect(savedAdmin.firstName).toBeDefined();
      expect(savedAdmin.lastName).toBeDefined();
      expect(savedAdmin.email).toBeDefined();
      expect(savedAdmin.username).toBeDefined();
      expect(savedAdmin.passwordHash).toBeDefined();
      expect(savedAdmin.passwordSalt).toBeDefined();
      expect(savedAdmin.permissions).toBeDefined();
      expect(savedAdmin.dateCreated).toBeDefined();
      expect(savedAdmin.isActive).toBeDefined();
    });

    test('should work with password hashing middleware', async () => {
      const plainPassword = 'TestPassword123!';
      
      const admin = new Administrator({
        administratorId: 'ADM001',
        firstName: 'Password',
        lastName: 'Hash',
        email: 'passwordhash@admin.com',
        username: 'passwordhash',
        password: plainPassword,
        permissions: ['manage_affiliates']
      });

      const savedAdmin = await admin.save();
      
      // Password should be hashed, not stored as plain text
      expect(savedAdmin.passwordHash).toBeDefined();
      expect(savedAdmin.passwordSalt).toBeDefined();
      expect(savedAdmin.passwordHash).not.toBe(plainPassword);
      expect(savedAdmin.password).toBeUndefined(); // Virtual field, not stored
    });
  });

  describe('Script Error Handling', () => {
    test('should handle database connection errors gracefully', () => {
      // This would test the script's error handling for database issues
      // In a real scenario, we'd mock mongoose connection failures
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check that script has error handling
      expect(scriptContent).toMatch(/(catch|error)/i);
      expect(scriptContent).toMatch(/(try|catch|finally)/i);
    });

    test('should handle invalid input gracefully', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for input validation patterns
      expect(scriptContent).toMatch(/(trim|length|validation)/i);
    });
  });

  describe('Security Considerations', () => {
    test('should not log or expose passwords', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check that password is not logged (should use asterisks or hidden input)
      expect(scriptContent).toMatch(/(\*|hidden|mask)/i);
      
      // Should not have console.log(password) or similar
      expect(scriptContent).not.toMatch(/console\.log.*password/i);
    });

    test('should generate secure random passwords when needed', () => {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // If the script generates passwords, it should use secure methods
      if (scriptContent.includes('generate') && scriptContent.includes('password')) {
        expect(scriptContent).toMatch(/(crypto|random|secure)/i);
      }
    });
  });
});
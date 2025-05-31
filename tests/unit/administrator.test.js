const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');
const crypto = require('crypto');

describe('Administrator Model', () => {
  beforeEach(async () => {
    // Clear the collection before each test
    await Administrator.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid administrator', async () => {
      const adminData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'SecurePassword123!'
      };

      const admin = new Administrator(adminData);
      const saved = await admin.save();

      expect(saved._id).toBeDefined();
      expect(saved.adminId).toBeDefined();
      expect(saved.adminId).toMatch(/^ADM/);
      expect(saved.firstName).toBe('John');
      expect(saved.lastName).toBe('Doe');
      expect(saved.email).toBe('john.doe@wavemax.com');
      expect(saved.role).toBe('administrator');
      expect(saved.isActive).toBe(true);
      expect(saved.loginAttempts).toBe(0);
      expect(saved.permissions).toEqual(['system_config', 'operator_management', 'view_analytics', 'manage_affiliates']);
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const admin = new Administrator({});

      let error;
      try {
        await admin.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.firstName).toBeDefined();
      expect(error.errors.lastName).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should enforce email format validation', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'password123'
      });

      let error;
      try {
        await admin.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toContain('Please enter a valid email');
    });

    it('should enforce unique email constraint', async () => {
      // Ensure indexes are created
      await Administrator.ensureIndexes();

      const adminData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'password123'
      };

      await new Administrator(adminData).save();

      const duplicate = new Administrator({
        ...adminData,
        firstName: 'Jane'
      });

      let error;
      try {
        await duplicate.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code === 11000 || error.name === 'MongoServerError').toBe(true);
    });

    it('should enforce unique adminId constraint', async () => {
      // Ensure indexes are created
      await Administrator.ensureIndexes();

      const admin1 = new Administrator({
        adminId: 'ADM123456',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'password123'
      });
      await admin1.save();

      const admin2 = new Administrator({
        adminId: 'ADM123456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@wavemax.com',
        password: 'password456'
      });

      let error;
      try {
        await admin2.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code === 11000 || error.name === 'MongoServerError').toBe(true);
    });

    it('should validate permission enum values', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: ['invalid_permission']
      });

      let error;
      try {
        await admin.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors['permissions.0']).toBeDefined();
    });

    it('should accept valid permissions', async () => {
      const validPermissions = ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'];
      
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: validPermissions
      });

      const saved = await admin.save();
      expect(saved.permissions).toEqual(validPermissions);
    });

    it('should trim whitespace from string fields', async () => {
      const admin = new Administrator({
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  john@wavemax.com  ',
        password: 'password123'
      });

      const saved = await admin.save();
      expect(saved.firstName).toBe('John');
      expect(saved.lastName).toBe('Doe');
      expect(saved.email).toBe('john@wavemax.com');
    });

    it('should convert email to lowercase', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'John.Doe@WaveMAX.com',
        password: 'password123'
      });

      const saved = await admin.save();
      expect(saved.email).toBe('john.doe@wavemax.com');
    });

    it('should not allow role to be changed after creation', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const saved = await admin.save();
      expect(saved.role).toBe('administrator');

      // Try to change role
      saved.role = 'operator';
      await saved.save();

      const updated = await Administrator.findById(saved._id);
      expect(updated.role).toBe('administrator');
    });
  });

  describe('Password Handling', () => {
    it('should hash password on save', async () => {
      const plainPassword = 'SecurePassword123!';
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: plainPassword
      });

      const saved = await admin.save();
      
      // Need to select password field explicitly
      const adminWithPassword = await Administrator.findById(saved._id).select('+password');
      
      expect(adminWithPassword.password).toBeDefined();
      expect(adminWithPassword.password).not.toBe(plainPassword);
      expect(adminWithPassword.password).toContain(':'); // Should have salt separator
    });

    it('should verify correct password', async () => {
      const plainPassword = 'SecurePassword123!';
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: plainPassword
      });

      await admin.save();
      
      const adminWithPassword = await Administrator.findByEmailWithPassword('john@wavemax.com');
      const isValid = adminWithPassword.verifyPassword(plainPassword);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'CorrectPassword123!'
      });

      await admin.save();
      
      const adminWithPassword = await Administrator.findByEmailWithPassword('john@wavemax.com');
      const isValid = adminWithPassword.verifyPassword('WrongPassword123!');
      
      expect(isValid).toBe(false);
    });

    it('should not expose password in JSON output', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const saved = await admin.save();
      const json = saved.toJSON();
      
      expect(json.password).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.passwordResetExpires).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe('Login Attempts and Account Locking', () => {
    it('should increment login attempts', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      await admin.save();
      await admin.incLoginAttempts();
      
      const updated = await Administrator.findById(admin._id);
      expect(updated.loginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 4
      });

      await admin.save();
      await admin.incLoginAttempts();
      
      const updated = await Administrator.findById(admin._id);
      expect(updated.loginAttempts).toBe(5);
      expect(updated.lockUntil).toBeDefined();
      expect(updated.lockUntil).toBeInstanceOf(Date);
      expect(updated.lockUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reset login attempts on successful login', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 3,
        lockUntil: new Date(Date.now() + 60000)
      });

      await admin.save();
      await admin.resetLoginAttempts();
      
      const updated = await Administrator.findById(admin._id);
      expect(updated.loginAttempts).toBe(0);
      expect(updated.lockUntil).toBeUndefined();
      expect(updated.lastLogin).toBeDefined();
    });

    it('should reset attempts if lock has expired', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 5,
        lockUntil: new Date(Date.now() - 60000) // Expired lock
      });

      await admin.save();
      await admin.incLoginAttempts();
      
      const updated = await Administrator.findById(admin._id);
      expect(updated.loginAttempts).toBe(1);
      expect(updated.lockUntil).toBeUndefined();
    });

    it('should correctly identify locked accounts', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      await admin.save();
      
      // Not locked initially
      expect(admin.isLocked).toBe(false);
      
      // Lock the account
      admin.lockUntil = new Date(Date.now() + 60000);
      expect(admin.isLocked).toBe(true);
      
      // Expired lock
      admin.lockUntil = new Date(Date.now() - 60000);
      expect(admin.isLocked).toBe(false);
    });
  });

  describe('Password Reset', () => {
    it('should generate password reset token', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      await admin.save();
      
      const resetToken = admin.generatePasswordResetToken();
      
      expect(resetToken).toBeDefined();
      expect(resetToken).toHaveLength(64); // 32 bytes in hex
      expect(admin.passwordResetToken).toBeDefined();
      expect(admin.passwordResetToken).not.toBe(resetToken); // Should be hashed
      expect(admin.passwordResetExpires).toBeDefined();
      expect(admin.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set password reset expiry to 30 minutes', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      await admin.save();
      
      const now = Date.now();
      admin.generatePasswordResetToken();
      
      const expiryTime = admin.passwordResetExpires.getTime();
      const timeDiff = expiryTime - now;
      
      // Should be approximately 30 minutes (with some tolerance)
      expect(timeDiff).toBeGreaterThan(29 * 60 * 1000);
      expect(timeDiff).toBeLessThan(31 * 60 * 1000);
    });
  });

  describe('Permissions', () => {
    it('should check single permission correctly', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: ['system_config', 'view_analytics']
      });

      await admin.save();
      
      expect(admin.hasPermission('system_config')).toBe(true);
      expect(admin.hasPermission('view_analytics')).toBe(true);
      expect(admin.hasPermission('operator_management')).toBe(false);
    });

    it('should check multiple permissions with AND operation', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: ['system_config', 'view_analytics']
      });

      await admin.save();
      
      expect(admin.hasAllPermissions(['system_config', 'view_analytics'])).toBe(true);
      expect(admin.hasAllPermissions(['system_config', 'operator_management'])).toBe(false);
      expect(admin.hasAllPermissions([])).toBe(true); // Empty array should return true
    });

    it('should check multiple permissions with OR operation', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: ['system_config', 'view_analytics']
      });

      await admin.save();
      
      expect(admin.hasAnyPermission(['system_config', 'operator_management'])).toBe(true);
      expect(admin.hasAnyPermission(['operator_management', 'manage_affiliates'])).toBe(false);
      expect(admin.hasAnyPermission([])).toBe(false); // Empty array should return false
    });

    it('should set default permissions if none provided', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        permissions: []
      });

      const saved = await admin.save();
      
      expect(saved.permissions).toEqual([
        'system_config',
        'operator_management',
        'view_analytics',
        'manage_affiliates'
      ]);
    });
  });

  describe('Static Methods', () => {
    it('should find active administrators', async () => {
      // Create mix of active and inactive admins
      await Administrator.create([
        {
          firstName: 'Active',
          lastName: 'Admin1',
          email: 'active1@wavemax.com',
          password: 'password123',
          isActive: true
        },
        {
          firstName: 'Inactive',
          lastName: 'Admin',
          email: 'inactive@wavemax.com',
          password: 'password123',
          isActive: false
        },
        {
          firstName: 'Active',
          lastName: 'Admin2',
          email: 'active2@wavemax.com',
          password: 'password123',
          isActive: true
        }
      ]);

      const activeAdmins = await Administrator.findActive();
      
      expect(activeAdmins).toHaveLength(2);
      expect(activeAdmins.every(admin => admin.isActive === true)).toBe(true);
    });

    it('should find administrator by email with password', async () => {
      await Administrator.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const admin = await Administrator.findByEmailWithPassword('john@wavemax.com');
      
      expect(admin).toBeDefined();
      expect(admin.email).toBe('john@wavemax.com');
      expect(admin.password).toBeDefined(); // Password should be included
    });

    it('should handle case-insensitive email search', async () => {
      await Administrator.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const admin = await Administrator.findByEmailWithPassword('JOHN@WAVEMAX.COM');
      
      expect(admin).toBeDefined();
      expect(admin.email).toBe('john@wavemax.com');
    });

    it('should return null for non-existent email', async () => {
      const admin = await Administrator.findByEmailWithPassword('nonexistent@wavemax.com');
      expect(admin).toBeNull();
    });
  });

  describe('Timestamps', () => {
    it('should auto-generate timestamps on creation', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const saved = await admin.save();
      
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const admin = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const saved = await admin.save();
      const originalUpdatedAt = saved.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      saved.firstName = 'Jane';
      await saved.save();
      
      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Admin ID Generation', () => {
    it('should auto-generate unique admin ID', async () => {
      const admin1 = new Administrator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const admin2 = new Administrator({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@wavemax.com',
        password: 'password456'
      });

      const saved1 = await admin1.save();
      const saved2 = await admin2.save();
      
      expect(saved1.adminId).toBeDefined();
      expect(saved2.adminId).toBeDefined();
      expect(saved1.adminId).not.toBe(saved2.adminId);
      expect(saved1.adminId).toMatch(/^ADM[A-Z0-9]+$/);
    });

    it('should not override provided admin ID', async () => {
      const customId = 'ADMCUSTOM123';
      const admin = new Administrator({
        adminId: customId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123'
      });

      const saved = await admin.save();
      expect(saved.adminId).toBe(customId);
    });
  });
});
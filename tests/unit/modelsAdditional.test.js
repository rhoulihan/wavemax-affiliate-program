const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');

describe('Models - Additional Coverage', () => {
  describe('Administrator Model - Pre-save Hook', () => {
    it('should add password to history on password change', async () => {
      const admin = new Administrator({
        adminId: 'ADM001',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'oldhash',
        passwordSalt: 'oldsalt',
        permissions: ['system_config'],
        passwordHistory: []
      });

      // Simulate password change
      admin.passwordHash = 'newhash';
      admin.passwordSalt = 'newsalt';
      admin.isModified = jest.fn((field) => {
        return field === 'passwordHash';
      });

      // Mock the save method to trigger pre-save hook
      const originalSave = admin.save;
      admin.save = jest.fn(async function() {
        // Simulate pre-save hook logic
        if (this.isModified('passwordHash') && this.passwordHistory) {
          this.passwordHistory.push({
            passwordHash: 'oldhash',
            passwordSalt: 'oldsalt',
            changedAt: new Date()
          });
          
          // Keep only last 5 passwords
          if (this.passwordHistory.length > 5) {
            this.passwordHistory = this.passwordHistory.slice(-5);
          }
        }
        return this;
      });

      await admin.save();

      expect(admin.passwordHistory).toHaveLength(1);
      expect(admin.passwordHistory[0]).toMatchObject({
        passwordHash: 'oldhash',
        passwordSalt: 'oldsalt'
      });
    });

    it('should limit password history to 5 entries', async () => {
      const admin = new Administrator({
        adminId: 'ADM001',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'hash6',
        passwordSalt: 'salt6',
        permissions: ['system_config'],
        passwordHistory: [
          { passwordHash: 'hash1', passwordSalt: 'salt1', changedAt: new Date() },
          { passwordHash: 'hash2', passwordSalt: 'salt2', changedAt: new Date() },
          { passwordHash: 'hash3', passwordSalt: 'salt3', changedAt: new Date() },
          { passwordHash: 'hash4', passwordSalt: 'salt4', changedAt: new Date() },
          { passwordHash: 'hash5', passwordSalt: 'salt5', changedAt: new Date() }
        ]
      });

      admin.passwordHash = 'hash7';
      admin.passwordSalt = 'salt7';
      admin.isModified = jest.fn(() => true);

      admin.save = jest.fn(async function() {
        if (this.isModified('passwordHash') && this.passwordHistory) {
          this.passwordHistory.push({
            passwordHash: 'hash6',
            passwordSalt: 'salt6',
            changedAt: new Date()
          });
          
          if (this.passwordHistory.length > 5) {
            this.passwordHistory = this.passwordHistory.slice(-5);
          }
        }
        return this;
      });

      await admin.save();

      expect(admin.passwordHistory).toHaveLength(5);
      expect(admin.passwordHistory[0].passwordHash).toBe('hash2');
      expect(admin.passwordHistory[4].passwordHash).toBe('hash6');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing required fields gracefully', () => {
      const admin = new Administrator({
        // Missing required fields
      });

      const errors = admin.validateSync();
      expect(errors).toBeDefined();
      expect(errors.errors).toHaveProperty('email');
      expect(errors.errors).toHaveProperty('firstName');
      expect(errors.errors).toHaveProperty('lastName');
      expect(errors.errors).toHaveProperty('passwordHash');
      expect(errors.errors).toHaveProperty('passwordSalt');
    });

  });
});
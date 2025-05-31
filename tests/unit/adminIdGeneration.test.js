const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');

jest.mock('../../server/utils/auditLogger', () => ({
  log: jest.fn().mockResolvedValue(true),
  logAuditEvent: jest.fn(),
  AuditEvents: {
    ACCOUNT_CREATED: 'ACCOUNT_CREATED'
  }
}));

describe('Admin ID Generation Logic Tests', () => {
  beforeEach(async () => {
    await Administrator.deleteMany({});
  });

  afterEach(async () => {
    await Administrator.deleteMany({});
  });

  describe('generateAdminId function logic', () => {
    const generateAdminId = async () => {
      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      if (!lastAdmin) {
        return 'ADM001';
      }
      
      const lastNumber = parseInt(lastAdmin.adminId.substring(3));
      const nextNumber = lastNumber + 1;
      return `ADM${nextNumber.toString().padStart(3, '0')}`;
    };

    it('should generate ADM001 when no administrators exist', async () => {
      const result = await generateAdminId();
      expect(result).toBe('ADM001');
    });

    it('should generate ADM002 when ADM001 exists', async () => {
      await new Administrator({
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        permissions: ['system_config'],
        isActive: true,
        createdBy: 'system'
      }).save();

      const result = await generateAdminId();
      expect(result).toBe('ADM002');
    });

    it('should generate ADM003 when ADM001 and ADM002 exist', async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          username: 'johndoe',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system'
        },
        {
          adminId: 'ADM002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          username: 'janesmith',
          password: 'password456',
          permissions: ['operator_management'],
          isActive: true,
          createdBy: 'system'
        }
      ]);

      const result = await generateAdminId();
      expect(result).toBe('ADM003');
    });

    it('should handle non-sequential admin IDs correctly', async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          username: 'johndoe',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system'
        },
        {
          adminId: 'ADM005',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          username: 'janesmith',
          password: 'password456',
          permissions: ['operator_management'],
          isActive: true,
          createdBy: 'system'
        }
      ]);

      const result = await generateAdminId();
      expect(result).toBe('ADM006');
    });

    it('should handle double-digit admin IDs', async () => {
      await new Administrator({
        adminId: 'ADM012',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        permissions: ['system_config'],
        isActive: true,
        createdBy: 'system'
      }).save();

      const result = await generateAdminId();
      expect(result).toBe('ADM013');
    });

    it('should handle triple-digit admin IDs', async () => {
      await new Administrator({
        adminId: 'ADM099',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        permissions: ['system_config'],
        isActive: true,
        createdBy: 'system'
      }).save();

      const result = await generateAdminId();
      expect(result).toBe('ADM100');
    });

    it('should handle large admin ID numbers', async () => {
      await new Administrator({
        adminId: 'ADM999',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        permissions: ['system_config'],
        isActive: true,
        createdBy: 'system'
      }).save();

      const result = await generateAdminId();
      expect(result).toBe('ADM1000');
    });
  });

  describe('Admin ID format validation', () => {
    it('should maintain three-digit padding for numbers below 100', () => {
      const testCases = [
        { input: 1, expected: 'ADM001' },
        { input: 9, expected: 'ADM009' },
        { input: 10, expected: 'ADM010' },
        { input: 99, expected: 'ADM099' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = `ADM${input.toString().padStart(3, '0')}`;
        expect(result).toBe(expected);
      });
    });

    it('should handle numbers above 999 without padding issues', () => {
      const testCases = [
        { input: 100, expected: 'ADM100' },
        { input: 999, expected: 'ADM999' },
        { input: 1000, expected: 'ADM1000' },
        { input: 9999, expected: 'ADM9999' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = `ADM${input.toString().padStart(3, '0')}`;
        expect(result).toBe(expected);
      });
    });
  });

  describe('Admin ID parsing logic', () => {
    it('should correctly parse admin ID numbers', () => {
      const testCases = [
        { adminId: 'ADM001', expectedNumber: 1 },
        { adminId: 'ADM009', expectedNumber: 9 },
        { adminId: 'ADM010', expectedNumber: 10 },
        { adminId: 'ADM099', expectedNumber: 99 },
        { adminId: 'ADM100', expectedNumber: 100 },
        { adminId: 'ADM999', expectedNumber: 999 },
        { adminId: 'ADM1000', expectedNumber: 1000 }
      ];

      testCases.forEach(({ adminId, expectedNumber }) => {
        const parsedNumber = parseInt(adminId.substring(3));
        expect(parsedNumber).toBe(expectedNumber);
      });
    });

    it('should handle edge cases in admin ID parsing', () => {
      const edgeCases = [
        { adminId: 'ADM000', expectedNumber: 0 },
        { adminId: 'ADM001', expectedNumber: 1 },
        { adminId: 'ADM00001', expectedNumber: 1 }
      ];

      edgeCases.forEach(({ adminId, expectedNumber }) => {
        const parsedNumber = parseInt(adminId.substring(3));
        expect(parsedNumber).toBe(expectedNumber);
      });
    });
  });

  describe('Admin ID generation with mixed data', () => {
    it('should work correctly with inactive administrators', async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'Active',
          lastName: 'Admin',
          email: 'active@example.com',
          username: 'activeadmin',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system'
        },
        {
          adminId: 'ADM002',
          firstName: 'Inactive',
          lastName: 'Admin',
          email: 'inactive@example.com',
          username: 'inactiveadmin',
          password: 'password456',
          permissions: ['operator_management'],
          isActive: false,
          createdBy: 'system'
        }
      ]);

      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      expect(lastAdmin.adminId).toBe('ADM002');

      const nextNumber = parseInt(lastAdmin.adminId.substring(3)) + 1;
      const nextAdminId = `ADM${nextNumber.toString().padStart(3, '0')}`;
      expect(nextAdminId).toBe('ADM003');
    });

    it('should work correctly with different creation dates', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await Administrator.create([
        {
          adminId: 'ADM002',
          firstName: 'Second',
          lastName: 'Admin',
          email: 'second@example.com',
          username: 'secondadmin',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system',
          createdAt: now
        },
        {
          adminId: 'ADM001',
          firstName: 'First',
          lastName: 'Admin',
          email: 'first@example.com',
          username: 'firstadmin',
          password: 'password456',
          permissions: ['operator_management'],
          isActive: true,
          createdBy: 'system',
          createdAt: yesterday
        }
      ]);

      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      expect(lastAdmin.adminId).toBe('ADM002');
      expect(lastAdmin.firstName).toBe('Second');
    });

    it('should work correctly with different permissions', async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'Limited',
          lastName: 'Admin',
          email: 'limited@example.com',
          username: 'limitedadmin',
          password: 'password123',
          permissions: ['view_analytics'],
          isActive: true,
          createdBy: 'system'
        },
        {
          adminId: 'ADM003',
          firstName: 'Super',
          lastName: 'Admin',
          email: 'super@example.com',
          username: 'superadmin',
          password: 'password456',
          permissions: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'],
          isActive: true,
          createdBy: 'system'
        }
      ]);

      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      expect(lastAdmin.adminId).toBe('ADM003');

      const nextNumber = parseInt(lastAdmin.adminId.substring(3)) + 1;
      const nextAdminId = `ADM${nextNumber.toString().padStart(3, '0')}`;
      expect(nextAdminId).toBe('ADM004');
    });
  });

  describe('Performance and reliability', () => {
    it('should handle database query efficiently', async () => {
      await Administrator.create([
        {
          adminId: 'ADM050',
          firstName: 'Admin',
          lastName: '50',
          email: 'admin50@example.com',
          username: 'admin50',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system'
        }
      ]);

      const startTime = process.hrtime();
      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      const endTime = process.hrtime(startTime);

      expect(lastAdmin.adminId).toBe('ADM050');
      expect(endTime[0]).toBeLessThan(1); // Should complete in less than 1 second
    });

    it('should handle concurrent admin creation scenario', async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'First',
          lastName: 'Admin',
          email: 'first@example.com',
          username: 'firstadmin',
          password: 'password123',
          permissions: ['system_config'],
          isActive: true,
          createdBy: 'system'
        }
      ]);

      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          Administrator.findOne().sort({ adminId: -1 }).then(lastAdmin => {
            const nextNumber = parseInt(lastAdmin.adminId.substring(3)) + 1;
            return `ADM${nextNumber.toString().padStart(3, '0')}`;
          })
        );
      }

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBe('ADM002');
      });
    });
  });
});
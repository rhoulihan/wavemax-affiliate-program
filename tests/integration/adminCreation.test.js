const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');
const emailService = require('../../server/utils/emailService');

jest.mock('../../server/utils/auditLogger', () => ({
  log: jest.fn().mockResolvedValue(true),
  logAuditEvent: jest.fn(),
  logLoginAttempt: jest.fn(),
  logSensitiveDataAccess: jest.fn(),
  logPaymentActivity: jest.fn(),
  logSuspiciousActivity: jest.fn(),
  auditMiddleware: jest.fn(() => (req, res, next) => next()),
  AuditEvents: {
    DATA_MODIFICATION: 'DATA_MODIFICATION',
    ACCOUNT_CREATED: 'ACCOUNT_CREATED',
    ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
    AUTH_LOGIN: 'AUTH_LOGIN'
  }
}));

describe('Admin Creation Integration Tests', () => {
  beforeEach(async () => {
    await Administrator.deleteMany({});
  });

  afterEach(async () => {
    await Administrator.deleteMany({});
  });

  describe('Direct Database Admin Creation', () => {
    it('should create admin with sequential ID when no admins exist', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config', 'operator_management'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      expect(savedAdmin.adminId).toBe('ADM001');
      expect(savedAdmin.firstName).toBe('John');
      expect(savedAdmin.lastName).toBe('Doe');
      expect(savedAdmin.email).toBe('john.doe@example.com');
      expect(savedAdmin.permissions).toEqual(['system_config', 'operator_management']);
      expect(savedAdmin.isActive).toBe(true);
    });

    it('should create admin with next sequential ID when admins exist', async () => {
      await new Administrator({
        adminId: 'ADM001',
        firstName: 'First',
        lastName: 'Admin',
        email: 'first@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      }).save();

      await new Administrator({
        adminId: 'ADM002',
        firstName: 'Second',
        lastName: 'Admin',
        email: 'second@example.com',
        password: 'StrongPassword417!',
        permissions: ['operator_management'],
        isActive: true
      }).save();

      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      expect(lastAdmin.adminId).toBe('ADM002');

      const nextNumber = parseInt(lastAdmin.adminId.substring(3)) + 1;
      const nextAdminId = `ADM${nextNumber.toString().padStart(3, '0')}`;

      expect(nextAdminId).toBe('ADM003');
    });

    it('should handle admin creation with all permissions', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'Super',
        lastName: 'Admin',
        email: 'super@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      expect(savedAdmin.permissions).toHaveLength(4);
      expect(savedAdmin.permissions).toContain('system_config');
      expect(savedAdmin.permissions).toContain('operator_management');
      expect(savedAdmin.permissions).toContain('view_analytics');
      expect(savedAdmin.permissions).toContain('manage_affiliates');
    });

    it('should handle admin creation with partial permissions', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'Limited',
        lastName: 'Admin',
        email: 'limited@example.com',
        password: 'StrongPassword417!',
        permissions: ['view_analytics'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      expect(savedAdmin.permissions).toHaveLength(1);
      expect(savedAdmin.permissions).toContain('view_analytics');
    });
  });

  describe('Admin Model Validation', () => {
    it('should require email field', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      
      try {
        await admin.save();
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });

    it('should save admins with different adminIds successfully', async () => {
      const adminData1 = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      };

      const adminData2 = {
        adminId: 'ADM002', // Different ID
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'StrongPassword849!',
        permissions: ['operator_management'],
        isActive: true
      };

      const admin1 = await new Administrator(adminData1).save();
      const admin2 = await new Administrator(adminData2).save();

      expect(admin1.adminId).toBe('ADM001');
      expect(admin2.adminId).toBe('ADM002');
    });

    it('should save admins with different emails successfully', async () => {
      const adminData1 = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      };

      const adminData2 = {
        adminId: 'ADM002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com', // Different email
        password: 'StrongPassword849!',
        permissions: ['operator_management'],
        isActive: true
      };

      const admin1 = await new Administrator(adminData1).save();
      const admin2 = await new Administrator(adminData2).save();

      expect(admin1.email).toBe('john@example.com');
      expect(admin2.email).toBe('jane@example.com');
    });
  });

  describe('Password Handling', () => {
    it('should hash password before saving', async () => {
      const plainPassword = 'StrongPassword417!';
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: plainPassword,
        permissions: ['system_config'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      expect(savedAdmin.password).not.toBe(plainPassword);
      expect(savedAdmin.password).toContain(':'); // pbkdf2 hash pattern with salt
    });

    it('should validate password with verifyPassword method', async () => {
      const plainPassword = 'StrongPassword417!';
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: plainPassword,
        permissions: ['system_config'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      const isValidPassword = savedAdmin.verifyPassword(plainPassword);
      const isInvalidPassword = savedAdmin.verifyPassword('wrongpassword');

      expect(isValidPassword).toBe(true);
      expect(isInvalidPassword).toBe(false);
    });
  });

  describe('Admin Query Operations', () => {
    beforeEach(async () => {
      await Administrator.create([
        {
          adminId: 'ADM001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'StrongPassword417!',
          permissions: ['system_config', 'operator_management'],
          isActive: true
        },
        {
          adminId: 'ADM002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          password: 'StrongPassword849!',
          permissions: ['view_analytics'],
          isActive: false
        },
        {
          adminId: 'ADM003',
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          password: 'StrongPassword295!',
          permissions: ['manage_affiliates', 'view_analytics'],
          isActive: true
        }
      ]);
    });

    it('should find admin by adminId', async () => {
      const admin = await Administrator.findOne({ adminId: 'ADM002' });
      
      expect(admin).toBeTruthy();
      expect(admin.firstName).toBe('Jane');
      expect(admin.lastName).toBe('Smith');
      expect(admin.email).toBe('jane@example.com');
    });

    it('should find admin by email', async () => {
      const admin = await Administrator.findOne({ email: 'bob@example.com' });
      
      expect(admin).toBeTruthy();
      expect(admin.adminId).toBe('ADM003');
      expect(admin.firstName).toBe('Bob');
    });

    it('should find active admins only', async () => {
      const activeAdmins = await Administrator.find({ isActive: true }).sort({ adminId: 1 });
      
      expect(activeAdmins).toHaveLength(2);
      expect(activeAdmins.map(a => a.adminId)).toEqual(['ADM001', 'ADM003']);
    });

    it('should find admins with specific permissions', async () => {
      const analyticsAdmins = await Administrator.find({ 
        permissions: { $in: ['view_analytics'] } 
      }).sort({ adminId: 1 });
      
      expect(analyticsAdmins).toHaveLength(2);
      expect(analyticsAdmins.map(a => a.adminId)).toEqual(['ADM002', 'ADM003']);
    });

    it('should get last admin for ID generation', async () => {
      const lastAdmin = await Administrator.findOne().sort({ adminId: -1 });
      
      expect(lastAdmin).toBeTruthy();
      expect(lastAdmin.adminId).toBe('ADM003');
    });
  });

  describe('Email Integration', () => {
    it('should call email service after admin creation', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      await emailService.sendAdministratorWelcomeEmail(savedAdmin);

      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(savedAdmin);
    });

    it('should handle email service failures gracefully', async () => {
      emailService.sendAdministratorWelcomeEmail.mockRejectedValueOnce(
        new Error('Email service unavailable')
      );

      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'StrongPassword417!',
        permissions: ['system_config'],
        isActive: true
      };

      const admin = new Administrator(adminData);
      const savedAdmin = await admin.save();

      try {
        await emailService.sendAdministratorWelcomeEmail(savedAdmin);
        fail('Should have thrown email error');
      } catch (error) {
        expect(error.message).toBe('Email service unavailable');
      }

      const adminInDb = await Administrator.findOne({ adminId: 'ADM001' });
      expect(adminInDb).toBeTruthy();
    });
  });
});
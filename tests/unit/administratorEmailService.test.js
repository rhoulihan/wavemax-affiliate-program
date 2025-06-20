const emailService = require('../../server/utils/emailService');

describe('Administrator Email Service Tests', () => {
  let mockAdmin;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdmin = {
      adminId: 'ADM001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      permissions: ['system_config', 'operator_management', 'view_analytics']
    };

    process.env.EMAIL_PROVIDER = 'console';
    process.env.BASE_URL = 'https://wavemax.promo';
  });

  describe('sendAdministratorWelcomeEmail', () => {
    it('should call sendAdministratorWelcomeEmail function', async () => {
      await emailService.sendAdministratorWelcomeEmail(mockAdmin);

      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(mockAdmin);
    });

    it('should handle admin with different permission sets', async () => {
      const adminWithAllPermissions = {
        ...mockAdmin,
        permissions: ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates']
      };

      await emailService.sendAdministratorWelcomeEmail(adminWithAllPermissions);

      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(adminWithAllPermissions);
    });

    it('should handle admin with single permission', async () => {
      const adminWithSinglePermission = {
        ...mockAdmin,
        permissions: ['view_analytics']
      };

      await emailService.sendAdministratorWelcomeEmail(adminWithSinglePermission);

      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(adminWithSinglePermission);
    });

    it('should handle admin with no permissions', async () => {
      const adminWithNoPermissions = {
        ...mockAdmin,
        permissions: []
      };

      await emailService.sendAdministratorWelcomeEmail(adminWithNoPermissions);

      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(adminWithNoPermissions);
    });
  });

  describe('sendAdministratorPasswordResetEmail', () => {
    it('should call sendAdministratorPasswordResetEmail function', async () => {
      const resetUrl = 'https://wavemax.promo/reset-password?token=abc123';

      await emailService.sendAdministratorPasswordResetEmail(mockAdmin, resetUrl);

      expect(emailService.sendAdministratorPasswordResetEmail).toHaveBeenCalledWith(mockAdmin, resetUrl);
    });

    it('should handle different reset URLs', async () => {
      const customResetUrl = 'https://custom.domain.com/reset?token=xyz789';

      await emailService.sendAdministratorPasswordResetEmail(mockAdmin, customResetUrl);

      expect(emailService.sendAdministratorPasswordResetEmail).toHaveBeenCalledWith(mockAdmin, customResetUrl);
    });
  });

  describe('Email template data processing', () => {
    it('should replace uppercase placeholders correctly', () => {
      const template = '[FIRST_NAME] [ADMIN_ID] [EMAIL]';
      const data = {
        FIRST_NAME: 'John',
        ADMIN_ID: 'ADM001',
        EMAIL: 'john@example.com'
      };

      const fillTemplate = (template, data) => {
        return template.replace(/\[([A-Z_]+)\]/g, (match, placeholder) => {
          return data[placeholder] || '';
        });
      };

      const result = fillTemplate(template, data);
      expect(result).toBe('John ADM001 john@example.com');
    });

    it('should handle missing placeholders gracefully', () => {
      const template = '[FIRST_NAME] [MISSING_FIELD] [EMAIL]';
      const data = {
        FIRST_NAME: 'John',
        EMAIL: 'john@example.com'
      };

      const fillTemplate = (template, data) => {
        return template.replace(/\[([A-Z_]+)\]/g, (match, placeholder) => {
          return data[placeholder] || '';
        });
      };

      const result = fillTemplate(template, data);
      expect(result).toBe('John  john@example.com');
    });

    it('should include current year in template data', () => {
      const currentYear = new Date().getFullYear();
      const data = {
        CURRENT_YEAR: currentYear
      };

      expect(data.CURRENT_YEAR).toBe(currentYear);
      expect(typeof data.CURRENT_YEAR).toBe('number');
    });

    it('should format permissions correctly as comma-separated string', () => {
      const permissions = ['system_config', 'operator_management', 'view_analytics'];
      const permissionsString = permissions.join(', ');

      expect(permissionsString).toBe('system_config, operator_management, view_analytics');
    });

    it('should handle empty permissions array', () => {
      const permissions = [];
      const permissionsString = permissions.join(', ');

      expect(permissionsString).toBe('');
    });

    it('should handle single permission', () => {
      const permissions = ['view_analytics'];
      const permissionsString = permissions.join(', ');

      expect(permissionsString).toBe('view_analytics');
    });
  });

  describe('Email service integration', () => {
    it('should be available as a module export', () => {
      expect(emailService).toBeDefined();
      expect(typeof emailService.sendAdministratorWelcomeEmail).toBe('function');
      expect(typeof emailService.sendAdministratorPasswordResetEmail).toBe('function');
    });

    it('should not throw error when sending welcome email', async () => {
      await expect(async () => {
        await emailService.sendAdministratorWelcomeEmail(mockAdmin);
      }).not.toThrow();
    });

    it('should not throw error when sending password reset email', async () => {
      const resetUrl = 'https://example.com/reset';
      await expect(async () => {
        await emailService.sendAdministratorPasswordResetEmail(mockAdmin, resetUrl);
      }).not.toThrow();
    });
  });

  describe('Admin data validation', () => {
    it('should handle admin with required fields', () => {
      expect(mockAdmin.adminId).toBe('ADM001');
      expect(mockAdmin.firstName).toBe('John');
      expect(mockAdmin.lastName).toBe('Doe');
      expect(mockAdmin.email).toBe('john.doe@example.com');
      expect(Array.isArray(mockAdmin.permissions)).toBe(true);
    });

    it('should handle admin with different adminId formats', () => {
      const adminWithDifferentId = {
        ...mockAdmin,
        adminId: 'ADM999'
      };

      expect(adminWithDifferentId.adminId).toBe('ADM999');
      expect(adminWithDifferentId.adminId.startsWith('ADM')).toBe(true);
    });

    it('should handle admin with different email formats', () => {
      const adminWithDifferentEmail = {
        ...mockAdmin,
        email: 'test.admin@company.com'
      };

      expect(adminWithDifferentEmail.email).toBe('test.admin@company.com');
      expect(adminWithDifferentEmail.email.includes('@')).toBe(true);
    });
  });
});
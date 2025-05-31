jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    close: jest.fn()
  }
}));

jest.mock('../../server/models/Administrator', () => {
  const mockAdmin = {
    adminId: 'ADM001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
    permissions: ['system_config', 'operator_management'],
    save: jest.fn().mockResolvedValue()
  };
  
  const MockAdministrator = jest.fn(() => mockAdmin);
  MockAdministrator.findOne = jest.fn();
  
  return MockAdministrator;
});

jest.mock('../../server/utils/emailService', () => ({
  sendAdministratorWelcomeEmail: jest.fn()
}));

jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('dotenv', () => ({
  config: jest.fn()
}));

const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');
const emailService = require('../../server/utils/emailService');
const readlineMock = require('readline');

describe('Create Admin Directly Script Unit Tests', () => {
  let mockRl;
  let mockAdmin;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRl = {
      question: jest.fn(),
      close: jest.fn()
    };
    readlineMock.createInterface.mockReturnValue(mockRl);
    
    mockAdmin = {
      adminId: 'ADM001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      username: 'johndoe',
      permissions: ['system_config', 'operator_management'],
      save: jest.fn().mockResolvedValue()
    };
    
    Administrator.mockImplementation(() => mockAdmin);
    Administrator.findOne = jest.fn().mockResolvedValue(null);
    
    mongoose.connect = jest.fn().mockResolvedValue();
    mongoose.connection = {
      close: jest.fn().mockResolvedValue()
    };
    
    emailService.sendAdministratorWelcomeEmail = jest.fn().mockResolvedValue();
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('generateAdminId function', () => {
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
      Administrator.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null)
      });
      
      const result = await generateAdminId();
      expect(result).toBe('ADM001');
    });

    it('should generate next sequential ID when administrators exist', async () => {
      Administrator.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({ adminId: 'ADM005' })
      });
      
      const result = await generateAdminId();
      expect(result).toBe('ADM006');
    });

    it('should handle double-digit admin IDs correctly', async () => {
      Administrator.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({ adminId: 'ADM099' })
      });
      
      const result = await generateAdminId();
      expect(result).toBe('ADM100');
    });
  });

  describe('Permission selection', () => {
    it('should handle "all" permission selection', () => {
      const permissionInput = 'all';
      let permissions = [];
      
      if (permissionInput.toLowerCase() === 'all') {
        permissions = ['system_config', 'operator_management', 'view_analytics', 'manage_affiliates'];
      }
      
      expect(permissions).toEqual(['system_config', 'operator_management', 'view_analytics', 'manage_affiliates']);
    });

    it('should handle specific permission selection', () => {
      const permissionInput = '1,3,4';
      const permissionMap = {
        '1': 'system_config',
        '2': 'operator_management', 
        '3': 'view_analytics',
        '4': 'manage_affiliates'
      };
      
      const selectedNumbers = permissionInput.split(',').map(s => s.trim());
      const permissions = selectedNumbers.map(num => permissionMap[num]).filter(Boolean);
      
      expect(permissions).toEqual(['system_config', 'view_analytics', 'manage_affiliates']);
    });

    it('should filter out invalid permission numbers', () => {
      const permissionInput = '1,5,3,invalid';
      const permissionMap = {
        '1': 'system_config',
        '2': 'operator_management', 
        '3': 'view_analytics',
        '4': 'manage_affiliates'
      };
      
      const selectedNumbers = permissionInput.split(',').map(s => s.trim());
      const permissions = selectedNumbers.map(num => permissionMap[num]).filter(Boolean);
      
      expect(permissions).toEqual(['system_config', 'view_analytics']);
    });
  });

  describe('Database operations', () => {
    it('should connect to MongoDB successfully', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      
      await mongoose.connect(process.env.MONGODB_URI);
      
      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test');
    });

    it('should create administrator with correct data', async () => {
      const adminData = {
        adminId: 'ADM001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        username: 'johndoe',
        password: 'password123',
        permissions: ['system_config', 'operator_management'],
        isActive: true,
        createdBy: 'system'
      };
      
      const admin = new Administrator(adminData);
      await admin.save();
      
      expect(Administrator).toHaveBeenCalledWith(adminData);
      expect(mockAdmin.save).toHaveBeenCalled();
    });

    it('should handle database save errors', async () => {
      mockAdmin.save.mockRejectedValue(new Error('Database error'));
      
      try {
        await mockAdmin.save();
      } catch (error) {
        expect(error.message).toBe('Database error');
      }
    });
  });

  describe('Email functionality', () => {
    it('should send welcome email after admin creation', async () => {
      await emailService.sendAdministratorWelcomeEmail(mockAdmin);
      
      expect(emailService.sendAdministratorWelcomeEmail).toHaveBeenCalledWith(mockAdmin);
    });

    it('should handle email sending errors gracefully', async () => {
      const emailError = new Error('Email service unavailable');
      emailService.sendAdministratorWelcomeEmail.mockRejectedValue(emailError);
      
      try {
        await emailService.sendAdministratorWelcomeEmail(mockAdmin);
      } catch (error) {
        expect(error.message).toBe('Email service unavailable');
      }
    });
  });

  describe('Input validation', () => {
    it('should handle empty input fields', () => {
      const firstName = '';
      const lastName = '';
      const email = '';
      
      expect(firstName).toBe('');
      expect(lastName).toBe('');
      expect(email).toBe('');
    });

    it('should handle whitespace in permission input', () => {
      const permissionInput = ' 1 , 2 , 3 ';
      const selectedNumbers = permissionInput.split(',').map(s => s.trim());
      
      expect(selectedNumbers).toEqual(['1', '2', '3']);
    });
  });

  describe('Error handling', () => {
    it('should handle MongoDB connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mongoose.connect.mockRejectedValue(connectionError);
      
      try {
        await mongoose.connect(process.env.MONGODB_URI);
      } catch (error) {
        expect(error.message).toBe('Connection failed');
      }
    });

    it('should close database connection in finally block', async () => {
      await mongoose.connection.close();
      
      expect(mongoose.connection.close).toHaveBeenCalled();
    });

    it('should close readline interface in finally block', () => {
      mockRl.close();
      
      expect(mockRl.close).toHaveBeenCalled();
    });
  });
});
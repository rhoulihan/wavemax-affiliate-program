// Password Validation Integration Tests
// Tests for strong password validation across all authentication endpoints

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

describe('Password Validation Integration Tests', () => {
  let agent;
  let csrfToken;

  beforeEach(async () => {
    // Clean up test data
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Administrator.deleteMany({});
    await Operator.deleteMany({});
    
    // Create agent and get CSRF token
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('Affiliate Registration Password Validation', () => {
    test('should reject weak passwords during affiliate registration', async () => {
      const weakPasswords = [
        'weak',
        'password',
        '12345678',
        'Password1',
        'password123',
        'ALLUPPERCASE123!',
        'alllowercase123!',
        'NoNumbers!',
        'NoSpecialChars123'
      ];

      for (let i = 0; i < weakPasswords.length; i++) {
        const weakPassword = weakPasswords[i];
        const registrationData = {
          firstName: 'Test',
          lastName: 'User',
          email: `test${i}@example.com`,
          username: `testuser${i}`,
          password: weakPassword,
          confirmPassword: weakPassword,
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          serviceArea: 'Downtown',
          deliveryFee: 5.99,
          paymentMethod: 'check',
          termsAgreement: true
        };

        const response = await agent
          .post('/api/v1/affiliates/register')
          .set('x-csrf-token', csrfToken)
          .send(registrationData);

        // Test with missing email to see if other validations work
        const testResponse = await agent
          .post('/api/v1/affiliates/register')
          .set('x-csrf-token', csrfToken)
          .send({...registrationData, email: ''});
        console.log(`Email validation test - Status: ${testResponse.status}, Body:`, testResponse.body);
        
        console.log(`Test password: ${weakPassword}, Status: ${response.status}, Body:`, response.body);
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Check for either message or errors array
        if (response.body.message) {
          expect(response.body.message).toContain('Password');
        } else if (response.body.errors) {
          expect(Array.isArray(response.body.errors)).toBe(true);
          expect(response.body.errors.some(err => err.msg && err.msg.includes('Password'))).toBe(true);
        }
      }
    });

    test('should accept strong passwords during affiliate registration', async () => {
      const strongPasswords = [
        'SecurePassw0rd!',
        'MyStr0ng&P@ssw0rd',
        'C0mpl3x#S3cur3Pass',
        'Val1dP@ssw0rd2025',
        'Strong8rP@ssw0rd!'
      ];

      for (let i = 0; i < strongPasswords.length; i++) {
        const strongPassword = strongPasswords[i];
        const registrationData = {
          firstName: 'Test',
          lastName: 'User',
          email: `test${i}@example.com`,
          username: `testuser${i}`,
          password: strongPassword,
          confirmPassword: strongPassword,
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          serviceArea: 'Downtown',
          deliveryFee: 5.99,
          paymentMethod: 'check',
          termsAgreement: true
        };

        const response = await agent
          .post('/api/v1/affiliates/register')
          .set('x-csrf-token', csrfToken)
          .send(registrationData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });

    test('should reject passwords containing username', async () => {
      const registrationData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'testusr@example.com',
        username: 'johndoe',
        password: 'johndoePassword123!', // Contains username
        confirmPassword: 'johndoePassword123!',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array format
      if (response.body.message) {
        expect(response.body.message).toContain('username');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('username'))).toBe(true);
      }
    });

    test('should reject passwords containing email', async () => {
      const registrationData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'john.doe@example.com',
        username: 'uniqueuser',
        password: 'john.doePassword123!', // Contains email prefix
        confirmPassword: 'john.doePassword123!',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array format
      if (response.body.message) {
        expect(response.body.message).toContain('email');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('email'))).toBe(true);
      }
    });

    test('should reject passwords with sequential characters', async () => {
      const sequentialPasswords = [
        'ValidPassword123!', // Contains '123'
        'Password456Strong!', // Contains '456'
        'PasswordABC1Strong!', // Contains 'ABC'
        'Strongdef1Password!' // Contains 'def' (lowercase)
      ];

      for (let i = 0; i < sequentialPasswords.length; i++) {
        const password = sequentialPasswords[i];
        const registrationData = {
          firstName: 'Test',
          lastName: 'User',
          email: `test${i}seq@example.com`,
          username: `testuser${i}seq`,
          password: password,
          confirmPassword: password,
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          serviceArea: 'Downtown',
          deliveryFee: 5.99,
          paymentMethod: 'check',
          termsAgreement: true
        };

        const response = await agent
          .post('/api/v1/affiliates/register')
          .set('x-csrf-token', csrfToken)
          .send(registrationData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Check for either message or errors array
        if (response.body.message) {
          expect(response.body.message).toContain('sequential');
        } else if (response.body.errors) {
          expect(Array.isArray(response.body.errors)).toBe(true);
          expect(response.body.errors.some(err => err.msg && err.msg.includes('sequential'))).toBe(true);
        }
      }
    });
  });

  describe('Customer Registration Password Validation', () => {
    test('should enforce strong passwords for customer registration', async () => {
      // First create a test affiliate for the customer
      const { hashPassword } = require('../../server/utils/encryption');
      const testAffiliate = new Affiliate({
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'testaffiliate@example.com',
        username: 'testaffiliate123',
        passwordHash: hashPassword('TestAffiliatePass123!').hash,
        passwordSalt: hashPassword('TestAffiliatePass123!').salt,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      });
      await testAffiliate.save();

      const weakPassword = 'weak123';
      const customerData = {
        firstName: 'Customer',
        lastName: 'Test',
        email: 'customer@example.com',
        username: 'customertest',
        password: weakPassword,
        confirmPassword: weakPassword,
        phone: '+1234567890',
        address: '456 Customer St',
        city: 'Customer City',
        state: 'CC',
        zipCode: '54321',
        affiliateId: testAffiliate.affiliateId
      };

      const response = await agent
        .post('/api/v1/customers/register')
        .set('x-csrf-token', csrfToken)
        .send(customerData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array
      if (response.body.message) {
        expect(response.body.message).toContain('Password');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('Password'))).toBe(true);
      }
    });

    test('should accept strong passwords for customer registration', async () => {
      // Create a test affiliate for the customer
      const { hashPassword } = require('../../server/utils/encryption');
      const testAffiliate = new Affiliate({
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'testaffiliate2@example.com',
        username: 'testaffiliate124',
        passwordHash: hashPassword('TestAffiliatePass123!').hash,
        passwordSalt: hashPassword('TestAffiliatePass123!').salt,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      });
      await testAffiliate.save();

      const strongPassword = 'SecureCustomer8!';
      const customerData = {
        firstName: 'Customer',
        lastName: 'Test',
        email: 'customer2@example.com',
        username: 'customertest2',
        password: strongPassword,
        confirmPassword: strongPassword,
        phone: '+1234567890',
        address: '456 Customer St',
        city: 'Customer City',
        state: 'CC',
        zipCode: '54321',
        affiliateId: testAffiliate.affiliateId
      };

      const response = await agent
        .post('/api/v1/customers/register')
        .set('x-csrf-token', csrfToken)
        .send(customerData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Administrator Password Validation', () => {
    let adminToken;
    
    beforeEach(async () => {
      // Create a test administrator for authentication
      const testAdmin = new Administrator({
        adminId: 'ADMIN001',
        firstName: 'Test',
        lastName: 'Admin',
        email: 'setup@example.com',
        password: 'SecureM@ster7!9K',
        permissions: ['administrators.create'],
        isActive: true
      });
      await testAdmin.save();

      // Login to get admin token
      const loginResponse = await agent
        .post('/api/v1/auth/administrator/login')
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'setup@example.com',
          password: 'SecureM@ster7!9K'
        });
      
      adminToken = loginResponse.body.token;
    });

    test('should enforce strong passwords for administrator creation', async () => {
      const weakPassword = 'Zq8#Rv2%'; // 8 chars - fails minimum 12 requirement
      const adminData = {
        firstName: 'Administrator',
        lastName: 'User',
        email: 'user@test.com',
        password: weakPassword,
        permissions: ['administrators.read', 'system_config']
      };

      const response = await agent
        .post('/api/v1/administrators')
        .set('x-csrf-token', csrfToken)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adminData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either errors array or message
      if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        // Check if errors array contains password-related validation
        const hasPasswordError = response.body.errors.some(err => 
          (typeof err === 'string' && err.includes('Password')) ||
          (err.msg && err.msg.includes('Password'))
        );
        expect(hasPasswordError).toBe(true);
      } else if (response.body.message) {
        expect(response.body.message).toContain('Password');
      }
    });

    test('should accept strong passwords for administrator creation', async () => {
      const strongPassword = 'SecureM@ster7!9K'; // Master password - all requirements met
      const adminData = {
        firstName: 'Administrator',
        lastName: 'User',
        email: 'newuser@example.com',
        password: strongPassword,
        permissions: ['administrators.read', 'system_config']
      };

      const response = await agent
        .post('/api/v1/administrators')
        .set('x-csrf-token', csrfToken)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adminData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Operator Password Validation', () => {
    let adminToken;
    
    beforeEach(async () => {
      // Create a test administrator for authentication
      const testAdmin = new Administrator({
        adminId: 'ADMIN002',
        firstName: 'Test',
        lastName: 'Admin',
        email: 'opsetup@example.com',
        password: 'SecureM@ster7!9K',
        permissions: ['operators.create'],
        isActive: true
      });
      await testAdmin.save();

      // Login to get admin token
      const loginResponse = await agent
        .post('/api/v1/auth/administrator/login')
        .set('x-csrf-token', csrfToken)
        .send({
          email: 'opsetup@example.com',
          password: 'SecureM@ster7!9K'
        });
      
      adminToken = loginResponse.body.token;
    });

    test('should enforce strong passwords for operator creation', async () => {
      const weakPassword = 'Short1!'; // 7 characters - fails minimum 12 requirement
      const operatorData = {
        firstName: 'Worker',
        lastName: 'Person',
        email: 'operator@example.com',
        password: weakPassword,
        role: 'pickup_delivery',
        assignedRoutes: ['route1']
      };

      const response = await agent
        .post('/api/v1/operators')
        .set('x-csrf-token', csrfToken)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(operatorData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either errors array or message
      if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        // Check if errors array contains password-related validation
        const hasPasswordError = response.body.errors.some(err => 
          (typeof err === 'string' && err.includes('Password')) ||
          (err.msg && err.msg.includes('Password'))
        );
        expect(hasPasswordError).toBe(true);
      } else if (response.body.message) {
        expect(response.body.message).toContain('Password');
      }
    });

    test('should accept strong passwords for operator creation', async () => {
      const strongPassword = 'SecureM@ster7!9K'; // Master password - all requirements met
      const operatorData = {
        firstName: 'Worker',
        lastName: 'Person',
        email: 'newoperator@example.com',
        password: strongPassword,
        role: 'pickup_delivery',
        assignedRoutes: ['route1']
      };

      const response = await agent
        .post('/api/v1/operators')
        .set('x-csrf-token', csrfToken)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(operatorData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Password Reset Validation', () => {
    test('should enforce strong passwords during password reset', async () => {
      // First create an affiliate
      const hashedPassword = hashPassword('SecurePassword123!');
      const affiliate = new Affiliate({
        firstName: 'Reset',
        lastName: 'Test',
        email: 'resettest@example.com',
        username: 'resettest',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '123 Reset St',
        city: 'Reset City',
        state: 'RC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      });
      await affiliate.save();

      // Request password reset
      const resetRequestResponse = await agent
        .post('/api/v1/auth/forgot-password')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'resettest@example.com', userType: 'affiliate' });

      expect(resetRequestResponse.status).toBe(200);

      // Extract reset token (in real implementation, this would come from email)
      const updatedAffiliate = await Affiliate.findOne({ email: 'resettest@example.com' });
      const resetToken = updatedAffiliate.resetToken;

      // Try to reset with weak password
      const weakPassword = 'weak123';
      const resetResponse = await agent
        .post('/api/v1/auth/reset-password')
        .set('x-csrf-token', csrfToken)
        .send({
          token: resetToken,
          userType: 'affiliate',
          password: weakPassword
        });

      expect(resetResponse.status).toBe(400);
      expect(resetResponse.body.success).toBe(false);
      // Check for either errors array or message
      if (resetResponse.body.errors) {
        expect(Array.isArray(resetResponse.body.errors)).toBe(true);
        // Check if errors array contains password-related validation
        const hasPasswordError = resetResponse.body.errors.some(err => 
          (typeof err === 'string' && err.includes('Password')) ||
          (err.msg && err.msg.includes('Password'))
        );
        expect(hasPasswordError).toBe(true);
      } else if (resetResponse.body.message) {
        expect(resetResponse.body.message).toContain('Password');
      }
    });

    test('should accept strong passwords during password reset', async () => {
      // First create an affiliate
      const hashedPassword = hashPassword('SecurePassword123!');
      const affiliate = new Affiliate({
        firstName: 'Reset',
        lastName: 'Test',
        email: 'resettest2@example.com',
        username: 'resettest2',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '123 Reset St',
        city: 'Reset City',
        state: 'RC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      });
      await affiliate.save();

      // Request password reset
      const resetRequestResponse = await agent
        .post('/api/v1/auth/forgot-password')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'resettest2@example.com', userType: 'affiliate' });

      expect(resetRequestResponse.status).toBe(200);

      // Extract reset token
      const updatedAffiliate = await Affiliate.findOne({ email: 'resettest2@example.com' });
      const resetToken = updatedAffiliate.resetToken;

      // Reset with strong password
      const strongPassword = 'NewSecurePassw0rd!';
      const resetResponse = await agent
        .post('/api/v1/auth/reset-password')
        .set('x-csrf-token', csrfToken)
        .send({
          token: resetToken,
          userType: 'affiliate',
          password: strongPassword
        });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);
    });
  });

  describe('Login with Updated Passwords', () => {
    test('should successfully login with strong password', async () => {
      const strongPassword = 'LoginTest123!';
      
      // Create affiliate with strong password
      const hashedPassword = hashPassword(strongPassword);
      const affiliate = new Affiliate({
        firstName: 'Login',
        lastName: 'Test',
        email: 'logintest@example.com',
        username: 'logintest',
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        phone: '+1234567890',
        address: '123 Login St',
        city: 'Login City',
        state: 'LC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check'
      });
      await affiliate.save();

      // Test login
      const loginResponse = await agent
        .post('/api/v1/auth/affiliate/login')
        .set('x-csrf-token', csrfToken)
        .send({
          username: 'logintest',
          password: strongPassword
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();
    });

    test('should handle case-insensitive username/email validation during registration', async () => {
      const registrationData = {
        firstName: 'Case',
        lastName: 'Test',
        email: 'CASE.TEST@EXAMPLE.COM',
        username: 'CASETEST',
        password: 'casetestPassw0rd!', // Contains lowercase version of username but no sequential chars
        confirmPassword: 'casetestPassw0rd!',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either errors array or message
      if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        // Check if errors array contains username-related validation
        const hasUsernameError = response.body.errors.some(err => 
          (typeof err === 'string' && err.includes('username')) ||
          (err.msg && err.msg.includes('username'))
        );
        expect(hasUsernameError).toBe(true);
      } else if (response.body.message) {
        expect(response.body.message).toContain('username');
      }
    });
  });

  describe('Password Strength Edge Cases', () => {
    test('should reject passwords with only special characters at the end', async () => {
      const weakPassword = 'SecureM@ster7!9K!!!'; // Master password + 3 consecutive ! chars
      
      const registrationData = {
        firstName: 'Edge',
        lastName: 'Case',
        email: 'edge@example.com',
        username: 'edgecase',
        password: weakPassword,
        confirmPassword: weakPassword,
        phone: '+1234567890',
        address: '123 Edge St',
        city: 'Edge City',
        state: 'EC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Check for either message or errors array
      if (response.body.message) {
        expect(response.body.message).toContain('more than 2 consecutive identical characters');
      } else if (response.body.errors) {
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.some(err => err.msg && err.msg.includes('more than 2 consecutive identical characters'))).toBe(true);
      }
    });

    test('should accept passwords with mixed character distribution', async () => {
      const strongPassword = 'M1x3d&Ch@r$Distr1but10n!';
      
      const registrationData = {
        firstName: 'Mixed',
        lastName: 'Distribution',
        email: 'mixed@example.com',
        username: 'mixeduser',
        password: strongPassword,
        confirmPassword: strongPassword,
        phone: '+1234567890',
        address: '123 Mixed St',
        city: 'Mixed City',
        state: 'MC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('should handle Unicode characters in passwords appropriately', async () => {
      const unicodePassword = 'Üñ1c0d3&P@ssw0rd!';
      
      const registrationData = {
        firstName: 'Unicode',
        lastName: 'Test',
        email: 'unicode@example.com',
        username: 'unicodeuser',
        password: unicodePassword,
        confirmPassword: unicodePassword,
        phone: '+1234567890',
        address: '123 Unicode St',
        city: 'Unicode City',
        state: 'UC',
        zipCode: '12345',
        serviceArea: 'Downtown',
        deliveryFee: 5.99,
        paymentMethod: 'check',
        termsAgreement: true
      };

      const response = await agent
        .post('/api/v1/affiliates/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationData);

      // Should either accept (if unicode is supported) or reject gracefully
      expect([200, 201, 400]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.message).toBeDefined();
      }
    });
  });
});
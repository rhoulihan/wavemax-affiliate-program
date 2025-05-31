const mongoose = require('mongoose');
const Operator = require('../../server/models/Operator');
const crypto = require('crypto');

describe('Operator Model', () => {
  let createdById;

  beforeAll(() => {
    // Create a fake administrator ID for createdBy field
    createdById = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    // Clear the collection before each test
    await Operator.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid operator', async () => {
      const operatorData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'SecurePassword123!',
        workStation: 'Station A',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        createdBy: createdById
      };

      const operator = new Operator(operatorData);
      const saved = await operator.save();

      expect(saved._id).toBeDefined();
      expect(saved.operatorId).toBeDefined();
      expect(saved.operatorId).toMatch(/^OPR/);
      expect(saved.firstName).toBe('John');
      expect(saved.lastName).toBe('Doe');
      expect(saved.email).toBe('john.doe@wavemax.com');
      expect(saved.role).toBe('operator');
      expect(saved.isActive).toBe(true);
      expect(saved.workStation).toBe('Station A');
      expect(saved.shiftStart).toBe('08:00');
      expect(saved.shiftEnd).toBe('17:00');
      expect(saved.currentOrderCount).toBe(0);
      expect(saved.totalOrdersProcessed).toBe(0);
      expect(saved.averageProcessingTime).toBe(0);
      expect(saved.qualityScore).toBe(100);
      expect(saved.loginAttempts).toBe(0);
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const operator = new Operator({});

      let error;
      try {
        await operator.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.firstName).toBeDefined();
      expect(error.errors.lastName).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
      expect(error.errors.createdBy).toBeDefined();
    });

    it('should enforce email format validation', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'password123',
        createdBy: createdById
      });

      let error;
      try {
        await operator.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toContain('Please enter a valid email');
    });

    it('should enforce unique email constraint', async () => {
      await Operator.ensureIndexes();

      const operatorData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'password123',
        createdBy: createdById
      };

      await new Operator(operatorData).save();

      const duplicate = new Operator({
        ...operatorData,
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

    it('should enforce unique operatorId constraint', async () => {
      await Operator.ensureIndexes();

      const operator1 = new Operator({
        operatorId: 'OPR123456',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });
      await operator1.save();

      const operator2 = new Operator({
        operatorId: 'OPR123456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@wavemax.com',
        password: 'password456',
        createdBy: createdById
      });

      let error;
      try {
        await operator2.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code === 11000 || error.name === 'MongoServerError').toBe(true);
    });

    it('should validate shift time format', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        shiftStart: '25:00', // Invalid time
        shiftEnd: '17:00',
        createdBy: createdById
      });

      let error;
      try {
        await operator.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.shiftStart).toBeDefined();
      expect(error.errors.shiftStart.message).toContain('Please enter a valid time format');
    });

    it('should accept valid shift times', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        shiftStart: '08:30',
        shiftEnd: '17:45',
        createdBy: createdById
      });

      const saved = await operator.save();
      expect(saved.shiftStart).toBe('08:30');
      expect(saved.shiftEnd).toBe('17:45');
    });

    it('should enforce quality score range', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        qualityScore: 150, // Out of range
        createdBy: createdById
      });

      let error;
      try {
        await operator.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.qualityScore).toBeDefined();
    });

    it('should trim whitespace from string fields', async () => {
      const operator = new Operator({
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  john@wavemax.com  ',
        workStation: '  Station A  ',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      expect(saved.firstName).toBe('John');
      expect(saved.lastName).toBe('Doe');
      expect(saved.email).toBe('john@wavemax.com');
      expect(saved.workStation).toBe('Station A');
    });

    it('should convert email to lowercase', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'John.Doe@WaveMAX.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      expect(saved.email).toBe('john.doe@wavemax.com');
    });

    it('should not allow role to be changed after creation', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      expect(saved.role).toBe('operator');

      saved.role = 'administrator';
      await saved.save();

      const updated = await Operator.findById(saved._id);
      expect(updated.role).toBe('operator');
    });
  });

  describe('Password Handling', () => {
    it('should hash password on save', async () => {
      const plainPassword = 'SecurePassword123!';
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: plainPassword,
        createdBy: createdById
      });

      const saved = await operator.save();
      
      const operatorWithPassword = await Operator.findById(saved._id).select('+password');
      
      expect(operatorWithPassword.password).toBeDefined();
      expect(operatorWithPassword.password).not.toBe(plainPassword);
      expect(operatorWithPassword.password).toContain(':');
    });

    it('should verify correct password', async () => {
      const plainPassword = 'SecurePassword123!';
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: plainPassword,
        createdBy: createdById
      });

      await operator.save();
      
      const operatorWithPassword = await Operator.findByEmailWithPassword('john@wavemax.com');
      const isValid = operatorWithPassword.verifyPassword(plainPassword);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'CorrectPassword123!',
        createdBy: createdById
      });

      await operator.save();
      
      const operatorWithPassword = await Operator.findByEmailWithPassword('john@wavemax.com');
      const isValid = operatorWithPassword.verifyPassword('WrongPassword123!');
      
      expect(isValid).toBe(false);
    });

    it('should not expose password in JSON output', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      const json = saved.toJSON();
      
      expect(json.password).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.passwordResetExpires).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe('Login Attempts and Account Locking', () => {
    it('should increment login attempts', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      await operator.save();
      await operator.incLoginAttempts();
      
      const updated = await Operator.findById(operator._id);
      expect(updated.loginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 4,
        createdBy: createdById
      });

      await operator.save();
      await operator.incLoginAttempts();
      
      const updated = await Operator.findById(operator._id);
      expect(updated.loginAttempts).toBe(5);
      expect(updated.lockUntil).toBeDefined();
      expect(updated.lockUntil).toBeInstanceOf(Date);
      expect(updated.lockUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('should lock for 30 minutes', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 4,
        createdBy: createdById
      });

      await operator.save();
      const beforeLock = Date.now();
      await operator.incLoginAttempts();
      
      const updated = await Operator.findById(operator._id);
      const lockDuration = updated.lockUntil.getTime() - beforeLock;
      
      // Should be approximately 30 minutes (with some tolerance)
      expect(lockDuration).toBeGreaterThan(29 * 60 * 1000);
      expect(lockDuration).toBeLessThan(31 * 60 * 1000);
    });

    it('should reset login attempts on successful login', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 3,
        lockUntil: new Date(Date.now() + 60000),
        createdBy: createdById
      });

      await operator.save();
      await operator.resetLoginAttempts();
      
      const updated = await Operator.findById(operator._id);
      expect(updated.loginAttempts).toBe(0);
      expect(updated.lockUntil).toBeUndefined();
      expect(updated.lastLogin).toBeDefined();
    });

    it('should reset attempts if lock has expired', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        loginAttempts: 5,
        lockUntil: new Date(Date.now() - 60000), // Expired lock
        createdBy: createdById
      });

      await operator.save();
      await operator.incLoginAttempts();
      
      const updated = await Operator.findById(operator._id);
      expect(updated.loginAttempts).toBe(1);
      expect(updated.lockUntil).toBeUndefined();
    });

    it('should correctly identify locked accounts', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      await operator.save();
      
      expect(operator.isLocked).toBe(false);
      
      operator.lockUntil = new Date(Date.now() + 60000);
      expect(operator.isLocked).toBe(true);
      
      operator.lockUntil = new Date(Date.now() - 60000);
      expect(operator.isLocked).toBe(false);
    });
  });

  describe('Password Reset', () => {
    it('should generate password reset token', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      await operator.save();
      
      const resetToken = operator.generatePasswordResetToken();
      
      expect(resetToken).toBeDefined();
      expect(resetToken).toHaveLength(64);
      expect(operator.passwordResetToken).toBeDefined();
      expect(operator.passwordResetToken).not.toBe(resetToken);
      expect(operator.passwordResetExpires).toBeDefined();
      expect(operator.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set password reset expiry to 30 minutes', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      await operator.save();
      
      const now = Date.now();
      operator.generatePasswordResetToken();
      
      const expiryTime = operator.passwordResetExpires.getTime();
      const timeDiff = expiryTime - now;
      
      expect(timeDiff).toBeGreaterThan(29 * 60 * 1000);
      expect(timeDiff).toBeLessThan(31 * 60 * 1000);
    });
  });

  describe('Shift Management', () => {
    describe('isOnShift virtual', () => {
      it('should return true when no shift times are set', async () => {
        const operator = new Operator({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          createdBy: createdById
        });

        await operator.save();
        expect(operator.isOnShift).toBe(true);
      });

      it('should correctly identify operator on shift during normal hours', async () => {
        const operator = new Operator({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          createdBy: createdById
        });

        await operator.save();
        
        // Mock the Date constructor for the virtual property check
        const originalDate = global.Date;
        const mockDate = new originalDate();
        mockDate.setHours(10, 0, 0, 0);
        
        global.Date = class extends originalDate {
          constructor() {
            return mockDate;
          }
          static now() {
            return originalDate.now();
          }
        };

        expect(operator.isOnShift).toBe(true);

        global.Date = originalDate;
      });

      it('should correctly identify operator off shift', async () => {
        const operator = new Operator({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          createdBy: createdById
        });

        await operator.save();
        
        // Mock the Date constructor for the virtual property check
        const originalDate = global.Date;
        const mockDate = new originalDate();
        mockDate.setHours(20, 0, 0, 0);
        
        global.Date = class extends originalDate {
          constructor() {
            return mockDate;
          }
          static now() {
            return originalDate.now();
          }
        };

        expect(operator.isOnShift).toBe(false);

        global.Date = originalDate;
      });

      it('should handle overnight shifts correctly', async () => {
        const operator = new Operator({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          shiftStart: '22:00',
          shiftEnd: '06:00',
          createdBy: createdById
        });

        await operator.save();
        
        // Mock the Date constructor for the virtual property check
        const originalDate = global.Date;
        const mockDate = new originalDate();
        
        global.Date = class extends originalDate {
          constructor() {
            return mockDate;
          }
          static now() {
            return originalDate.now();
          }
        };

        // Test at 23:00
        mockDate.setHours(23, 0, 0, 0);
        expect(operator.isOnShift).toBe(true);

        // Test early morning hours
        mockDate.setHours(3, 0, 0, 0);
        expect(operator.isOnShift).toBe(true);

        // Test after shift end
        mockDate.setHours(7, 0, 0, 0);
        expect(operator.isOnShift).toBe(false);

        global.Date = originalDate;
      });
    });
  });

  describe('Processing Statistics', () => {
    it('should update processing stats correctly', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        totalOrdersProcessed: 10,
        averageProcessingTime: 30,
        createdBy: createdById
      });

      await operator.save();
      
      await operator.updateProcessingStats(45);
      
      expect(operator.totalOrdersProcessed).toBe(11);
      // Average should be (30 * 10 + 45) / 11 = 31.36
      expect(operator.averageProcessingTime).toBeCloseTo(31.36, 1);
    });

    it('should handle first order processing', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      await operator.save();
      
      await operator.updateProcessingStats(25);
      
      expect(operator.totalOrdersProcessed).toBe(1);
      expect(operator.averageProcessingTime).toBe(25);
    });

    it('should update quality score with passing result', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        qualityScore: 90,
        createdBy: createdById
      });

      await operator.save();
      
      await operator.updateQualityScore(true);
      
      // Score should increase: 90 * 0.9 + 100 * 0.1 = 91
      expect(operator.qualityScore).toBeCloseTo(91, 1);
    });

    it('should update quality score with failing result', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        qualityScore: 90,
        createdBy: createdById
      });

      await operator.save();
      
      await operator.updateQualityScore(false);
      
      // Score should decrease: 90 * 0.9 + 0 * 0.1 = 81
      expect(operator.qualityScore).toBeCloseTo(81, 1);
    });
  });

  describe('Static Methods', () => {
    describe('findActive', () => {
      it('should find only active operators', async () => {
        await Operator.create([
          {
            firstName: 'Active',
            lastName: 'Operator1',
            email: 'active1@wavemax.com',
            password: 'password123',
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Inactive',
            lastName: 'Operator',
            email: 'inactive@wavemax.com',
            password: 'password123',
            isActive: false,
            createdBy: createdById
          },
          {
            firstName: 'Active',
            lastName: 'Operator2',
            email: 'active2@wavemax.com',
            password: 'password123',
            isActive: true,
            createdBy: createdById
          }
        ]);

        const activeOperators = await Operator.findActive();
        
        expect(activeOperators).toHaveLength(2);
        expect(activeOperators.every(op => op.isActive === true)).toBe(true);
      });
    });

    describe('findOnShift', () => {
      it('should find only operators on shift', async () => {
        await Operator.create([
          {
            firstName: 'OnShift',
            lastName: 'Operator',
            email: 'onshift@wavemax.com',
            password: 'password123',
            shiftStart: '08:00',
            shiftEnd: '17:00',
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'OffShift',
            lastName: 'Operator',
            email: 'offshift@wavemax.com',
            password: 'password123',
            shiftStart: '18:00',
            shiftEnd: '02:00',
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'NoShift',
            lastName: 'Operator',
            email: 'noshift@wavemax.com',
            password: 'password123',
            isActive: true,
            createdBy: createdById
          }
        ]);

        // Mock the Date constructor for the virtual property check
        const originalDate = global.Date;
        const mockDate = new originalDate();
        mockDate.setHours(10, 0, 0, 0);
        
        global.Date = class extends originalDate {
          constructor() {
            return mockDate;
          }
          static now() {
            return originalDate.now();
          }
        };

        const onShiftOperators = await Operator.findOnShift();
        
        expect(onShiftOperators).toHaveLength(2);
        expect(onShiftOperators.some(op => op.email === 'onshift@wavemax.com')).toBe(true);
        expect(onShiftOperators.some(op => op.email === 'noshift@wavemax.com')).toBe(true);

        global.Date = originalDate;
      });
    });

    describe('findByEmailWithPassword', () => {
      it('should find operator by email with password', async () => {
        await Operator.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          createdBy: createdById
        });

        const operator = await Operator.findByEmailWithPassword('john@wavemax.com');
        
        expect(operator).toBeDefined();
        expect(operator.email).toBe('john@wavemax.com');
        expect(operator.password).toBeDefined();
      });

      it('should handle case-insensitive email search', async () => {
        await Operator.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@wavemax.com',
          password: 'password123',
          createdBy: createdById
        });

        const operator = await Operator.findByEmailWithPassword('JOHN@WAVEMAX.COM');
        
        expect(operator).toBeDefined();
        expect(operator.email).toBe('john@wavemax.com');
      });

      it('should return null for non-existent email', async () => {
        const operator = await Operator.findByEmailWithPassword('nonexistent@wavemax.com');
        expect(operator).toBeNull();
      });
    });

    describe('findAvailableOperators', () => {
      it('should find operators with low order count', async () => {
        await Operator.create([
          {
            firstName: 'Available1',
            lastName: 'Operator',
            email: 'avail1@wavemax.com',
            password: 'password123',
            currentOrderCount: 2,
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Busy',
            lastName: 'Operator',
            email: 'busy@wavemax.com',
            password: 'password123',
            currentOrderCount: 12,
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Available2',
            lastName: 'Operator',
            email: 'avail2@wavemax.com',
            password: 'password123',
            currentOrderCount: 5,
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Inactive',
            lastName: 'Operator',
            email: 'inactive@wavemax.com',
            password: 'password123',
            currentOrderCount: 0,
            isActive: false,
            createdBy: createdById
          }
        ]);

        const available = await Operator.findAvailableOperators();
        
        expect(available).toHaveLength(2);
        expect(available.every(op => op.currentOrderCount < 10)).toBe(true);
        expect(available.every(op => op.isActive === true)).toBe(true);
      });

      it('should sort by current order count', async () => {
        await Operator.create([
          {
            firstName: 'Op1',
            lastName: 'Operator',
            email: 'op1@wavemax.com',
            password: 'password123',
            currentOrderCount: 5,
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Op2',
            lastName: 'Operator',
            email: 'op2@wavemax.com',
            password: 'password123',
            currentOrderCount: 2,
            isActive: true,
            createdBy: createdById
          },
          {
            firstName: 'Op3',
            lastName: 'Operator',
            email: 'op3@wavemax.com',
            password: 'password123',
            currentOrderCount: 8,
            isActive: true,
            createdBy: createdById
          }
        ]);

        const available = await Operator.findAvailableOperators();
        
        expect(available[0].currentOrderCount).toBe(2);
        expect(available[1].currentOrderCount).toBe(5);
        expect(available[2].currentOrderCount).toBe(8);
      });

      it('should respect limit parameter', async () => {
        // Create 10 available operators
        const operators = [];
        for (let i = 0; i < 10; i++) {
          operators.push({
            firstName: `Op${i}`,
            lastName: 'Operator',
            email: `op${i}@wavemax.com`,
            password: 'password123',
            currentOrderCount: i,
            isActive: true,
            createdBy: createdById
          });
        }
        await Operator.create(operators);

        const available = await Operator.findAvailableOperators(3);
        
        expect(available).toHaveLength(3);
      });
    });
  });

  describe('Timestamps', () => {
    it('should auto-generate timestamps on creation', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const operator = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      const originalUpdatedAt = saved.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      saved.firstName = 'Jane';
      await saved.save();
      
      expect(saved.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Operator ID Generation', () => {
    it('should auto-generate unique operator ID', async () => {
      const operator1 = new Operator({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const operator2 = new Operator({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@wavemax.com',
        password: 'password456',
        createdBy: createdById
      });

      const saved1 = await operator1.save();
      const saved2 = await operator2.save();
      
      expect(saved1.operatorId).toBeDefined();
      expect(saved2.operatorId).toBeDefined();
      expect(saved1.operatorId).not.toBe(saved2.operatorId);
      expect(saved1.operatorId).toMatch(/^OPR[A-Z0-9]+$/);
    });

    it('should not override provided operator ID', async () => {
      const customId = 'OPRCUSTOM123';
      const operator = new Operator({
        operatorId: customId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@wavemax.com',
        password: 'password123',
        createdBy: createdById
      });

      const saved = await operator.save();
      expect(saved.operatorId).toBe(customId);
    });
  });
});
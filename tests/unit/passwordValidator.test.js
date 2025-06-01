// Password Validator Unit Tests
// Comprehensive test coverage for the new strong password validation functionality

const {
  validatePasswordStrength,
  passwordValidationMiddleware,
  customPasswordValidator,
  isPasswordInHistory,
  getPasswordStrength,
  commonPasswords
} = require('../../server/utils/passwordValidator');

describe('Password Validator Utility', () => {
  
  describe('validatePasswordStrength', () => {
    
    describe('Basic Requirements', () => {
      test('should validate minimum length requirement', () => {
        const shortPassword = 'Short1!';
        const validLength = 'ValidPass4892!';
        
        const shortResult = validatePasswordStrength(shortPassword);
        const validResult = validatePasswordStrength(validLength);
        
        expect(shortResult.success).toBe(false);
        expect(shortResult.errors).toContain('Password must be at least 12 characters long');
        
        expect(validResult.success).toBe(true);
        expect(validResult.errors).toHaveLength(0);
      });

      test('should require uppercase letters', () => {
        const noUppercase = 'validpassword4892!';
        const withUppercase = 'ValidPassword4892!';
        
        const noUpperResult = validatePasswordStrength(noUppercase);
        const withUpperResult = validatePasswordStrength(withUppercase);
        
        expect(noUpperResult.success).toBe(false);
        expect(noUpperResult.errors).toContain('Password must contain at least one uppercase letter');
        
        expect(withUpperResult.success).toBe(true);
      });

      test('should require lowercase letters', () => {
        const noLowercase = 'VALIDPASSWORD4892!';
        const withLowercase = 'ValidPassword4892!';
        
        const noLowerResult = validatePasswordStrength(noLowercase);
        const withLowerResult = validatePasswordStrength(withLowercase);
        
        expect(noLowerResult.success).toBe(false);
        expect(noLowerResult.errors).toContain('Password must contain at least one lowercase letter');
        
        expect(withLowerResult.success).toBe(true);
      });

      test('should require numbers', () => {
        const noNumber = 'ValidPassword!';
        const withNumber = 'ValidPassword4892!';
        
        const noNumberResult = validatePasswordStrength(noNumber);
        const withNumberResult = validatePasswordStrength(withNumber);
        
        expect(noNumberResult.success).toBe(false);
        expect(noNumberResult.errors).toContain('Password must contain at least one number');
        
        expect(withNumberResult.success).toBe(true);
      });

      test('should require special characters', () => {
        const noSpecial = 'ValidPassword4892';
        const withSpecial = 'ValidPassword4892!';
        
        const noSpecialResult = validatePasswordStrength(noSpecial);
        const withSpecialResult = validatePasswordStrength(withSpecial);
        
        expect(noSpecialResult.success).toBe(false);
        expect(noSpecialResult.errors).toContain('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
        
        expect(withSpecialResult.success).toBe(true);
      });
    });

    describe('Security Validations', () => {
      test('should reject common passwords', () => {
        const commonPasswordTests = [
          'password',        // In common list
          'wavemax',        // Domain-specific in common list  
          'qwerty',         // In common list
          'admin123456'     // admin is in common list, would also trigger length
        ];
        
        commonPasswordTests.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.success).toBe(false);
          expect(result.errors.some(error => error.includes('common') || error.includes('12 characters'))).toBe(true);
        });
      });

      test('should reject passwords containing username', () => {
        const username = 'johndoe';
        const passwordWithUsername = 'johndoePassword4892!';
        const validPassword = 'ValidPassword4892!';
        
        const invalidResult = validatePasswordStrength(passwordWithUsername, { username });
        const validResult = validatePasswordStrength(validPassword, { username });
        
        expect(invalidResult.success).toBe(false);
        expect(invalidResult.errors).toContain('Password cannot contain your username or email');
        
        expect(validResult.success).toBe(true);
      });

      test('should reject passwords containing email', () => {
        const email = 'john.doe@example.com';
        const passwordWithEmail = 'john.doePassword4892!';
        const validPassword = 'ValidPassword4892!';
        
        const invalidResult = validatePasswordStrength(passwordWithEmail, { email });
        const validResult = validatePasswordStrength(validPassword, { email });
        
        expect(invalidResult.success).toBe(false);
        expect(invalidResult.errors).toContain('Password cannot contain your username or email');
        
        expect(validResult.success).toBe(true);
      });

      test('should reject sequential characters', () => {
        const sequentialPasswords = [
          'ValidPassword123!',  // Contains '123'
          'ValidPasswordabc!',  // Contains 'abc'
          'ValidPassword456!',  // Contains '456'
          'ValidPassworddef!'   // Contains 'def'
        ];
        
        sequentialPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.success).toBe(false);
          expect(result.errors).toContain('Password cannot contain sequential characters (e.g., 123, abc)');
        });
      });

      test('should reject repeated characters', () => {
        const repeatedPasswords = [
          'ValidPasssssword1!',  // Contains 'ssss'
          'ValidPassword111!',   // Contains '111'
          'ValidPasswordaaa!'    // Contains 'aaa'
        ];
        
        repeatedPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.success).toBe(false);
          expect(result.errors).toContain('Password cannot have more than 2 consecutive identical characters');
        });
      });
    });

    describe('Valid Passwords', () => {
      test('should accept strong valid passwords', () => {
        const validPasswords = [
          'SecurePass4892!@#',
          'MyStr0ngP@ssw0rd',
          'C0mpl3x&S3cur3!',
          'Val1dP@ssw0rd2024'
        ];
        
        validPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.success).toBe(true);
          expect(result.errors).toHaveLength(0);
        });
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty password', () => {
        const result = validatePasswordStrength('');
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      test('should handle null/undefined password', () => {
        const nullResult = validatePasswordStrength(null);
        const undefinedResult = validatePasswordStrength(undefined);
        
        expect(nullResult.success).toBe(false);
        expect(undefinedResult.success).toBe(false);
      });

      test('should handle case-insensitive username/email checks', () => {
        const username = 'JohnDoe';
        const email = 'JOHN.DOE@EXAMPLE.COM';
        const password = 'johndoePassword741!';
        
        const result = validatePasswordStrength(password, { username, email });
        expect(result.success).toBe(false);
        expect(result.errors.some(error => error.includes('username') || error.includes('email'))).toBe(true);
      });
    });
  });

  describe('customPasswordValidator', () => {
    test('should work as express-validator custom validator', () => {
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      const validPassword = 'SecurePass4892!@#';
      const invalidPassword = 'weak';

      const validator = customPasswordValidator();
      expect(() => validator(validPassword, { req: mockReq })).not.toThrow();
      expect(() => validator(invalidPassword, { req: mockReq })).toThrow();
    });

    test('should include validation errors in thrown message', () => {
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      const invalidPassword = 'short';

      try {
        const validator = customPasswordValidator();
        validator(invalidPassword, { req: mockReq });
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Password must be at least 12 characters long');
      }
    });
  });

  describe('passwordValidationMiddleware', () => {
    test('should create middleware function', () => {
      expect(typeof passwordValidationMiddleware).toBe('function');
    });

    test('should validate password and call next on success', () => {
      const req = {
        body: {
          password: 'SecurePass4892!@#',
          username: 'testuser',
          email: 'test@example.com'
        }
      };
      const res = {};
      const next = jest.fn();

      passwordValidationMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should return error response on validation failure', () => {
      const req = {
        body: {
          password: 'weak',
          username: 'testuser',
          email: 'test@example.com'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      passwordValidationMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('12 characters')
        ]),
        strength: expect.objectContaining({
          score: expect.any(Number),
          label: expect.any(String)
        })
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('isPasswordInHistory', () => {
    test('should return false for empty history', () => {
      const result = isPasswordInHistory('newPassword123!', [], 'salt');
      expect(result).toBe(false);
    });

    test('should return false for password not in history', () => {
      const passwordHistory = ['oldHash1', 'oldHash2', 'oldHash3'];
      const result = isPasswordInHistory('newPassword123!', passwordHistory, 'salt');
      expect(result).toBe(false);
    });

    test('should handle null/undefined history', () => {
      const result1 = isPasswordInHistory('password123!', null, 'salt');
      const result2 = isPasswordInHistory('password123!', undefined, 'salt');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('getPasswordStrength', () => {
    test('should return higher scores for stronger passwords', () => {
      const weakPassword = 'weak';
      const strongPassword = 'SecurePass4892!@#';
      
      const weakScore = getPasswordStrength(weakPassword);
      const strongScore = getPasswordStrength(strongPassword);
      
      expect(strongScore.score).toBeGreaterThan(weakScore.score);
      expect(strongScore.score).toBeGreaterThanOrEqual(4); // High score for strong password
    });

    test('should score length appropriately', () => {
      const shortPassword = 'Short1!';     // < 12 chars
      const mediumPassword = 'MediumPass1!'; // 12+ chars
      const longPassword = 'VeryLongPassword1!'; // 16+ chars
      
      const shortScore = getPasswordStrength(shortPassword);
      const mediumScore = getPasswordStrength(mediumPassword);
      const longScore = getPasswordStrength(longPassword);
      
      expect(mediumScore.score).toBeGreaterThan(shortScore.score);
      expect(longScore.score).toBeGreaterThanOrEqual(mediumScore.score);
    });

    test('should score character variety', () => {
      const noVariety = 'aaaaaaaaaaaaa';
      const someVariety = 'AaaaaaaaaaaA1';
      const fullVariety = 'Aa1!aaaaaaaa';
      
      const noVarietyScore = getPasswordStrength(noVariety);
      const someVarietyScore = getPasswordStrength(someVariety);
      const fullVarietyScore = getPasswordStrength(fullVariety);
      
      expect(someVarietyScore.score).toBeGreaterThan(noVarietyScore.score);
      expect(fullVarietyScore.score).toBeGreaterThan(someVarietyScore.score);
    });

    test('should penalize common patterns', () => {
      const withSequential = 'Password123!test';
      const withoutSequential = 'Password479!test';
      
      const sequentialScore = getPasswordStrength(withSequential);
      const cleanScore = getPasswordStrength(withoutSequential);
      
      expect(cleanScore.score).toBeGreaterThanOrEqual(sequentialScore.score);
    });
  });

  describe('commonPasswords array', () => {
    test('should contain common passwords', () => {
      expect(commonPasswords).toContain('password');
      expect(commonPasswords).toContain('123456');
      expect(commonPasswords).toContain('qwerty');
      expect(commonPasswords).toContain('admin');
    });

    test('should contain domain-specific passwords', () => {
      expect(commonPasswords).toContain('wavemax');
      expect(commonPasswords).toContain('laundry');
    });
  });
});
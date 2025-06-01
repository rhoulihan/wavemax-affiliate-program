// Enhanced Password Validator Unit Tests for WaveMAX Laundry Affiliate Program

const {
  validatePasswordStrength,
  passwordValidationMiddleware,
  customPasswordValidator,
  isPasswordInHistory,
  getPasswordStrength
} = require('../../server/utils/passwordValidator');

describe('Enhanced Password Validator', () => {
  describe('validatePasswordStrength', () => {
    describe('Length Requirements', () => {
      test('should reject passwords shorter than 12 characters', () => {
        const shortPasswords = [
          'Short1!',
          'Pass123!',
          'Ab1!',
          'ValidPass1!'  // 11 characters
        ];

        shortPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password must be at least 12 characters long');
        });
      });

      test('should accept passwords with 12 or more characters', () => {
        const validLengthPasswords = [
          'ValidPassword1!',   // 15 characters
          'LongPassword123!',  // 16 characters
          'VeryLongPassword1!' // 18 characters
        ];

        validLengthPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.errors).not.toContain('Password must be at least 12 characters long');
        });
      });
    });

    describe('Character Type Requirements', () => {
      test('should require at least one uppercase letter', () => {
        const noUppercasePasswords = [
          'validpassword1!',
          'password123!',
          'test_password1!'
        ];

        noUppercasePasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });
      });

      test('should require at least one lowercase letter', () => {
        const noLowercasePasswords = [
          'VALIDPASSWORD1!',
          'PASSWORD123!',
          'TEST_PASSWORD1!'
        ];

        noLowercasePasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });
      });

      test('should require at least one number', () => {
        const noNumberPasswords = [
          'ValidPassword!',
          'TestPassword!',
          'MySecurePass!'
        ];

        noNumberPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password must contain at least one number');
        });
      });

      test('should require at least one special character', () => {
        const noSpecialCharPasswords = [
          'ValidPassword1',
          'TestPassword123',
          'MySecurePass456'
        ];

        noSpecialCharPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
        });
      });

      test('should accept passwords with all required character types', () => {
        const validCharacterPasswords = [
          'ValidPassword1!',
          'TestPassword123@',
          'MySecurePass456#',
          'ComplexPass789$'
        ];

        validCharacterPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          const characterErrors = result.errors.filter(error => 
            error.includes('uppercase') || 
            error.includes('lowercase') || 
            error.includes('number') || 
            error.includes('special character')
          );
          expect(characterErrors).toHaveLength(0);
        });
      });
    });

    describe('Common Password Detection', () => {
      test('should reject common passwords', () => {
        const commonPasswords = [
          'Password123!',
          'Welcome123!',
          'Admin123456!',
          'User123456!',
          'Test123456!',
          'Demo123456!',
          'Temp123456!',
          'Pass123456!',
          'Login123456!'
        ];

        commonPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password is too common');
        });
      });

      test('should accept non-common passwords', () => {
        const uniquePasswords = [
          'MyUniqueSecret1!',
          'CustomPassword99@',
          'PersonalKey789#',
          'SpecialAccess456$'
        ];

        uniquePasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.errors).not.toContain('Password is too common');
        });
      });
    });

    describe('Sequential Character Detection', () => {
      test('should reject passwords with sequential numbers', () => {
        const sequentialNumberPasswords = [
          'ValidPass123!',
          'MyPassword456@',
          'TestPass789#',
          'SecurePass012$'
        ];

        sequentialNumberPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot contain sequential characters (e.g., 123, abc)');
        });
      });

      test('should reject passwords with sequential letters', () => {
        const sequentialLetterPasswords = [
          'ValidPassabc1!',
          'MyPassworddef2@',
          'TestPassxyz3#'
        ];

        sequentialLetterPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot contain sequential characters (e.g., 123, abc)');
        });
      });

      test('should accept passwords without sequential characters', () => {
        const nonSequentialPasswords = [
          'ValidPass147!',
          'MyPassword258@',
          'TestPass369#',
          'SecurePass147$'
        ];

        nonSequentialPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.errors).not.toContain('Password cannot contain sequential characters (e.g., 123, abc)');
        });
      });
    });

    describe('Repeated Character Detection', () => {
      test('should reject passwords with too many repeated characters', () => {
        const repeatedCharPasswords = [
          'ValidPasssss1!',  // 4 consecutive 's'
          'MyPasswordddd2@', // 4 consecutive 'd'
          'TestPassAAA3#',   // 3 consecutive 'A'
          'SecurePass1111$'  // 4 consecutive '1'
        ];

        repeatedCharPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot have more than 2 consecutive identical characters');
        });
      });

      test('should accept passwords with acceptable repeated characters', () => {
        const acceptablePasswords = [
          'ValidPassss1!',   // Only 2 consecutive 's'
          'MyPassworddd2@',  // Only 2 consecutive 'd'
          'TestPassAA3#',    // Only 2 consecutive 'A'
          'SecurePass11$'    // Only 2 consecutive '1'
        ];

        // First, let's create passwords that actually have only 2 consecutive chars
        const validPasswords = [
          'ValidPasss1!',
          'MyPasswordd2@',
          'TestPassA3#',
          'SecurePass1$'
        ];

        validPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.errors).not.toContain('Password cannot have more than 2 consecutive identical characters');
        });
      });
    });

    describe('Username/Email Inclusion Check', () => {
      test('should reject passwords containing username', () => {
        const username = 'testuser';
        const passwordsWithUsername = [
          'testuserPassword1!',
          'MyTestuserPass1@',
          'Password_testuser1#'
        ];

        passwordsWithUsername.forEach(password => {
          const result = validatePasswordStrength(password, { username });
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot contain your username or email');
        });
      });

      test('should reject passwords containing email', () => {
        const email = 'user@example.com';
        const passwordsWithEmail = [
          'userPassword123!',
          'MyUserPass456@',
          'examplePassword789#'
        ];

        passwordsWithEmail.forEach(password => {
          const result = validatePasswordStrength(password, { email });
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot contain your username or email');
        });
      });

      test('should accept passwords not containing username or email', () => {
        const username = 'testuser';
        const email = 'user@example.com';
        const validPasswords = [
          'CompletelyDifferent1!',
          'MySecurePassword2@',
          'UniquePassphrase3#'
        ];

        validPasswords.forEach(password => {
          const result = validatePasswordStrength(password, { username, email });
          expect(result.errors).not.toContain('Password cannot contain your username or email');
        });
      });
    });

    describe('Password History Check', () => {
      test('should reject passwords in history', () => {
        const passwordHistory = [
          'OldPassword123!',
          'PreviousPass456@',
          'FormerSecret789#'
        ];

        passwordHistory.forEach(password => {
          const result = validatePasswordStrength(password, { passwordHistory });
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('Password cannot be one of your last 5 passwords');
        });
      });

      test('should accept passwords not in history', () => {
        const passwordHistory = [
          'OldPassword123!',
          'PreviousPass456@',
          'FormerSecret789#'
        ];

        const newPassword = 'BrandNewSecret1!';
        const result = validatePasswordStrength(newPassword, { passwordHistory });
        expect(result.errors).not.toContain('Password cannot be one of your last 5 passwords');
      });
    });

    describe('Complete Valid Passwords', () => {
      test('should accept completely valid passwords', () => {
        const validPasswords = [
          'MyComplexSecret147!',
          'SecurePassphrase258@',
          'StrongPassword369#',
          'PrivateAccess741$'
        ];

        validPasswords.forEach(password => {
          const result = validatePasswordStrength(password);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });
      });
    });
  });

  describe('getPasswordStrength', () => {
    test('should return correct strength scores', () => {
      const passwordTests = [
        { password: 'weak1!', expectedScore: 0 },
        { password: 'StrongerPass1!', expectedScore: 3 },
        { password: 'VeryStrongPassword123!', expectedScore: 4 },
        { password: 'ExtremelyStrongAndSecurePassword456@', expectedScore: 5 }
      ];

      passwordTests.forEach(({ password, expectedScore }) => {
        const strength = getPasswordStrength(password);
        expect(strength.score).toBe(expectedScore);
      });
    });

    test('should return correct strength labels', () => {
      const strengthLabels = [
        { password: 'weak', expected: 'Very Weak' },
        { password: 'StrongerPass1!', expected: 'Good' },
        { password: 'VeryStrongPassword123!', expected: 'Strong' },
        { password: 'ExtremelyStrongAndSecurePassword456@', expected: 'Very Strong' }
      ];

      strengthLabels.forEach(({ password, expected }) => {
        const strength = getPasswordStrength(password);
        expect(strength.label).toBe(expected);
      });
    });
  });

  describe('isPasswordInHistory', () => {
    test('should return true for passwords in history', () => {
      const passwordHistory = [
        'OldPassword123!',
        'PreviousPass456@',
        'FormerSecret789#'
      ];

      passwordHistory.forEach(password => {
        expect(isPasswordInHistory(password, passwordHistory)).toBe(true);
      });
    });

    test('should return false for passwords not in history', () => {
      const passwordHistory = [
        'OldPassword123!',
        'PreviousPass456@',
        'FormerSecret789#'
      ];

      const newPasswords = [
        'BrandNewSecret1!',
        'FreshPassword2@',
        'UnusedPass3#'
      ];

      newPasswords.forEach(password => {
        expect(isPasswordInHistory(password, passwordHistory)).toBe(false);
      });
    });

    test('should handle empty history', () => {
      expect(isPasswordInHistory('AnyPassword1!', [])).toBe(false);
      expect(isPasswordInHistory('AnyPassword1!', null)).toBe(false);
      expect(isPasswordInHistory('AnyPassword1!', undefined)).toBe(false);
    });
  });

  describe('customPasswordValidator', () => {
    test('should return custom validator function', () => {
      const validator = customPasswordValidator();
      expect(typeof validator).toBe('function');
    });

    test('should validate passwords correctly in express-validator context', () => {
      const validator = customPasswordValidator();
      
      // Mock express-validator context
      const mockValue = 'ValidPassword123!';
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      // Should not throw for valid password
      expect(() => validator(mockValue, { req: mockReq })).not.toThrow();
    });

    test('should throw for invalid passwords in express-validator context', () => {
      const validator = customPasswordValidator();
      
      // Mock express-validator context with invalid password
      const mockValue = 'weak';
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      // Should throw for invalid password
      expect(() => validator(mockValue, { req: mockReq })).toThrow();
    });

    test('should include admin-specific validation when userType is admin', () => {
      const validator = customPasswordValidator();
      
      const mockValue = 'testuser123!'; // Contains username
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          userType: 'admin'
        }
      };

      // Should throw because admin passwords cannot contain username
      expect(() => validator(mockValue, { req: mockReq })).toThrow('Password cannot contain your username or email');
    });

    test('should include admin-specific validation when userType is operator', () => {
      const validator = customPasswordValidator();
      
      const mockValue = 'testuser123!'; // Contains username
      const mockReq = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          userType: 'operator'
        }
      };

      // Should throw because operator passwords cannot contain username
      expect(() => validator(mockValue, { req: mockReq })).toThrow('Password cannot contain your username or email');
    });
  });

  describe('passwordValidationMiddleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        body: {}
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    test('should call next() for valid passwords', () => {
      mockReq.body = {
        password: 'ValidPassword123!',
        username: 'testuser',
        email: 'test@example.com'
      };

      passwordValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should return 400 error for invalid passwords', () => {
      mockReq.body = {
        password: 'weak',
        username: 'testuser',
        email: 'test@example.com'
      };

      passwordValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password validation failed',
        errors: expect.any(Array)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should skip validation if no password in request', () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com'
      };

      passwordValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should include strength assessment in response for invalid passwords', () => {
      mockReq.body = {
        password: 'WeakPass1!',
        username: 'testuser',
        email: 'test@example.com'
      };

      passwordValidationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password validation failed',
        errors: expect.any(Array),
        strength: expect.objectContaining({
          score: expect.any(Number),
          label: expect.any(String)
        })
      });
    });
  });

  describe('Edge Cases and Security', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(() => validatePasswordStrength(null)).not.toThrow();
      expect(() => validatePasswordStrength(undefined)).not.toThrow();
      expect(() => validatePasswordStrength('')).not.toThrow();

      const nullResult = validatePasswordStrength(null);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors.length).toBeGreaterThan(0);
    });

    test('should handle very long passwords', () => {
      const veryLongPassword = 'A'.repeat(1000) + '1!';
      const result = validatePasswordStrength(veryLongPassword);
      
      // Should not crash and should validate properly
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    test('should handle special Unicode characters', () => {
      const unicodePassword = 'ValidPassword123!你好';
      const result = validatePasswordStrength(unicodePassword);
      
      // Should handle Unicode gracefully
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    test('should be case-sensitive for username/email checks', () => {
      const username = 'TestUser';
      const password = 'testuser123!'; // lowercase version

      const result = validatePasswordStrength(password, { username });
      
      // Should still detect case-insensitive username inclusion
      expect(result.errors).toContain('Password cannot contain your username or email');
    });
  });
});
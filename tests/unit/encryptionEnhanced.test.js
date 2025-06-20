// tests/unit/encryptionEnhanced.test.js
// Enhanced tests for encryption utility covering all error paths

const crypto = require('crypto');
const encryptionUtil = require('../../server/utils/encryption');

describe('Encryption Utility - Enhanced Coverage', () => {
  let originalEnv;
  let consoleErrorSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up a valid encryption key for most tests
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console
    consoleErrorSpy.mockRestore();

    // Restore any mocked crypto functions
    jest.restoreAllMocks();
  });

  describe('Encryption Error Paths', () => {
    test('should return null for falsy inputs', () => {
      expect(encryptionUtil.encrypt('')).toBeNull();
      expect(encryptionUtil.encrypt(null)).toBeNull();
      expect(encryptionUtil.encrypt(undefined)).toBeNull();
      expect(encryptionUtil.encrypt(0)).toBeNull();
      expect(encryptionUtil.encrypt(false)).toBeNull();
    });

    test('should throw error with invalid encryption key length', () => {
      process.env.ENCRYPTION_KEY = 'too-short';

      expect(() => {
        encryptionUtil.encrypt('test data');
      }).toThrow('Failed to encrypt data');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should throw error when encryption key is missing', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => {
        encryptionUtil.encrypt('test data');
      }).toThrow('Failed to encrypt data');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should handle crypto errors gracefully', () => {
      // Mock crypto.createCipheriv to throw
      jest.spyOn(crypto, 'createCipheriv').mockImplementation(() => {
        throw new Error('Crypto error');
      });

      expect(() => {
        encryptionUtil.encrypt('test data');
      }).toThrow('Failed to encrypt data');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Encryption error:',
        expect.any(Error)
      );
    });
  });

  describe('Decryption Error Paths', () => {
    test('should return null for falsy inputs', () => {
      expect(encryptionUtil.decrypt(null)).toBeNull();
      expect(encryptionUtil.decrypt(undefined)).toBeNull();
      expect(encryptionUtil.decrypt(false)).toBeNull();
      expect(encryptionUtil.decrypt(0)).toBeNull();
    });

    test('should throw error with invalid encrypted object structure', () => {
      const invalidObjects = [
        { iv: 'invalid-hex' },
        { encryptedData: 'data', authTag: 'tag' }, // missing iv
        { iv: 'abc', encryptedData: 'data' }, // missing authTag
        { iv: 'not-hex!@#', encryptedData: 'data', authTag: 'tag' }
      ];

      invalidObjects.forEach(obj => {
        expect(() => {
          encryptionUtil.decrypt(obj);
        }).toThrow('Failed to decrypt data');
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should throw error with tampered data', () => {
      const encrypted = encryptionUtil.encrypt('test data');

      // Tamper with auth tag
      encrypted.authTag = crypto.randomBytes(16).toString('hex');

      expect(() => {
        encryptionUtil.decrypt(encrypted);
      }).toThrow('Failed to decrypt data');
    });

    test('should throw error with wrong encryption key', () => {
      const encrypted = encryptionUtil.encrypt('test data');

      // Change the key
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

      expect(() => {
        encryptionUtil.decrypt(encrypted);
      }).toThrow('Failed to decrypt data');
    });

    test('should handle corrupted encrypted data', () => {
      const encrypted = encryptionUtil.encrypt('test data');

      // Corrupt the encrypted data
      encrypted.encryptedData = encrypted.encryptedData.slice(0, -4) + 'XXXX';

      expect(() => {
        encryptionUtil.decrypt(encrypted);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('Password Hashing Error Paths', () => {
    test('should handle crypto.randomBytes failure', () => {
      jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      expect(() => {
        encryptionUtil.hashPassword('password123');
      }).toThrow('Failed to hash password');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Password hashing error:',
        expect.any(Error)
      );
    });

    test('should handle crypto.pbkdf2Sync failure', () => {
      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation(() => {
        throw new Error('PBKDF2 failed');
      });

      expect(() => {
        encryptionUtil.hashPassword('password123');
      }).toThrow('Failed to hash password');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Password hashing error:',
        expect.any(Error)
      );
    });

    test('should handle empty password', () => {
      const { salt, hash } = encryptionUtil.hashPassword('');
      expect(salt).toBeTruthy();
      expect(hash).toBeTruthy();
      expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(hash).toHaveLength(128); // 64 bytes = 128 hex chars
    });
  });

  describe('Password Verification Error Paths', () => {
    test('should throw error when pbkdf2Sync fails', () => {
      // Generate valid salt and hash
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.randomBytes(64).toString('hex');

      // Mock pbkdf2Sync to throw
      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation(() => {
        throw new Error('PBKDF2 failed');
      });

      expect(() => {
        encryptionUtil.verifyPassword('password', salt, hash);
      }).toThrow('Failed to verify password');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Password verification error:',
        expect.any(Error)
      );
    });

    test('should handle invalid inputs gracefully', () => {
      const { salt, hash } = encryptionUtil.hashPassword('test');

      // Null/undefined password
      expect(() => {
        encryptionUtil.verifyPassword(null, salt, hash);
      }).toThrow('Failed to verify password');

      expect(() => {
        encryptionUtil.verifyPassword(undefined, salt, hash);
      }).toThrow('Failed to verify password');

      // Null/undefined salt
      expect(() => {
        encryptionUtil.verifyPassword('password', null, hash);
      }).toThrow('Failed to verify password');

      expect(() => {
        encryptionUtil.verifyPassword('password', undefined, hash);
      }).toThrow('Failed to verify password');

      // Null/undefined hash (returns false, doesn't throw)
      expect(encryptionUtil.verifyPassword('password', salt, null)).toBe(false);
      expect(encryptionUtil.verifyPassword('password', salt, undefined)).toBe(false);
    });

    test('should return false for invalid salt format', () => {
      // Non-hex salt should cause pbkdf2Sync to fail internally
      // but verifyPassword catches and returns false
      const result = encryptionUtil.verifyPassword('password', 'not-hex!', 'somehash');
      expect(result).toBe(false);
    });
  });

  describe('Token and Barcode Generation', () => {
    test('should generate tokens of correct length', () => {
      const defaultToken = encryptionUtil.generateToken();
      expect(defaultToken).toHaveLength(64); // 32 bytes * 2

      const customToken = encryptionUtil.generateToken(16);
      expect(customToken).toHaveLength(32); // 16 bytes * 2

      const longToken = encryptionUtil.generateToken(64);
      expect(longToken).toHaveLength(128); // 64 bytes * 2
    });

    test('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(encryptionUtil.generateToken());
      }
      expect(tokens.size).toBe(100);
    });

    test('should handle token generation errors', () => {
      jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      expect(() => {
        encryptionUtil.generateToken();
      }).toThrow('Random generation failed');
    });

    test('should generate barcodes with correct format', () => {
      const barcode = encryptionUtil.generateBarcode();
      expect(barcode).toMatch(/^WM-[A-F0-9]{8}$/);
      expect(barcode).toHaveLength(11); // WM- + 8 chars
    });

    test('should generate unique barcodes', () => {
      const barcodes = new Set();
      for (let i = 0; i < 100; i++) {
        barcodes.add(encryptionUtil.generateBarcode());
      }
      expect(barcodes.size).toBe(100);
    });

    test('should handle barcode generation errors', () => {
      jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      expect(() => {
        encryptionUtil.generateBarcode();
      }).toThrow('Random generation failed');
    });
  });

  describe('Edge Cases and Security Tests', () => {
    test('should handle large data encryption/decryption', () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      const encrypted = encryptionUtil.encrypt(largeData);
      const decrypted = encryptionUtil.decrypt(encrypted);
      expect(decrypted).toBe(largeData);
    });

    test('should handle unicode and special characters', () => {
      const testStrings = [
        '🔐 Emoji test 🚀',
        'Chinese: 中文测试',
        'Arabic: اختبار عربي',
        'Special: !@#$%^&*()_+-=[]{}|;\':",./<>?`~',
        'Null char: \0 test',
        'Newlines:\n\r\ntest'
      ];

      testStrings.forEach(str => {
        const encrypted = encryptionUtil.encrypt(str);
        const decrypted = encryptionUtil.decrypt(encrypted);
        expect(decrypted).toBe(str);
      });
    });

    test('should produce different IVs for same input', () => {
      const data = 'test data';
      const results = [];

      for (let i = 0; i < 10; i++) {
        results.push(encryptionUtil.encrypt(data));
      }

      // All IVs should be different
      const ivs = results.map(r => r.iv);
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(10);

      // But all should decrypt to same value
      results.forEach(encrypted => {
        expect(encryptionUtil.decrypt(encrypted)).toBe(data);
      });
    });

    test('should validate encryption output structure', () => {
      const encrypted = encryptionUtil.encrypt('test');

      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('authTag');

      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.encryptedData).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');

      // All should be hex strings
      expect(encrypted.iv).toMatch(/^[a-f0-9]+$/);
      expect(encrypted.encryptedData).toMatch(/^[a-f0-9]+$/);
      expect(encrypted.authTag).toMatch(/^[a-f0-9]+$/);
    });

    test('should handle password edge cases', () => {
      const passwords = [
        '', // empty
        'a', // single char
        'a'.repeat(1000), // very long
        '12345678', // numbers only
        '!@#$%^&*()', // special chars only
        '中文密码', // unicode
        'pass\0word', // null char
        'pass\nword' // newline
      ];

      passwords.forEach(password => {
        const { salt, hash } = encryptionUtil.hashPassword(password);
        expect(encryptionUtil.verifyPassword(password, salt, hash)).toBe(true);
        expect(encryptionUtil.verifyPassword(password + 'x', salt, hash)).toBe(false);
      });
    });
  });
});
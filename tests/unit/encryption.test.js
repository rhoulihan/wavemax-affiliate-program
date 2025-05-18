// Create a new file
const encryptionUtil = require('../../server/utils/encryption');

describe('Encryption Utility', () => {
  test('should hash password correctly', () => {
    const password = 'TestPassword123!';
    const { salt, hash } = encryptionUtil.hashPassword(password);
    
    expect(salt).toBeTruthy();
    expect(salt.length).toBeGreaterThan(0);
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(0);
  });
  
  test('should verify password correctly', () => {
    const password = 'TestPassword123!';
    const { salt, hash } = encryptionUtil.hashPassword(password);
    
    const isValid = encryptionUtil.verifyPassword(password, salt, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = encryptionUtil.verifyPassword('WrongPassword', salt, hash);
    expect(isInvalid).toBe(false);
  });
  
  test('should encrypt and decrypt data correctly', () => {
    const originalData = 'Sensitive information';
    const encrypted = encryptionUtil.encrypt(originalData);
    
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('encryptedData');
    expect(encrypted).toHaveProperty('authTag');
    
    const decrypted = encryptionUtil.decrypt(encrypted);
    expect(decrypted).toBe(originalData);
  });
});
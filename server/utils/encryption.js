// Encryption Utility for WaveMAX Laundry Affiliate Program

const crypto = require('crypto');

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Data to encrypt
 * @returns {object} Encrypted data with IV and auth tag
 */
exports.encrypt = (text) => {
  if (!text) return null;
  
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher using AES-256-GCM with the encryption key
    const cipher = crypto.createCipheriv(
      'aes-256-gcm', 
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), 
      iv
    );
    
    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-256-GCM
 * @param {object} encryptedObj - Object containing encrypted data, IV, and auth tag
 * @returns {string} Decrypted data
 */
exports.decrypt = (encryptedObj) => {
  if (!encryptedObj) return null;
  
  try {
    // Create decipher using AES-256-GCM with the encryption key
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(encryptedObj.iv, 'hex')
    );
    
    // Set the authentication tag
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate a secure password hash with salt
 * @param {string} password - Password to hash
 * @returns {object} Salt and hash
 */
exports.hashPassword = (password) => {
  try {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash the password with PBKDF2
    const hash = crypto.pbkdf2Sync(
      password, 
      salt, 
      10000, // 10,000 iterations
      64,    // 64 bytes (512 bits)
      'sha512'
    ).toString('hex');
    
    return {
      salt,
      hash
    };
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
};

/**
 * Verify a password against a stored hash
 * @param {string} password - Password to verify
 * @param {string} storedSalt - Stored salt
 * @param {string} storedHash - Stored hash
 * @returns {boolean} True if password matches
 */
exports.verifyPassword = (password, storedSalt, storedHash) => {
  try {
    // Hash the provided password with the stored salt
    const hash = crypto.pbkdf2Sync(
      password, 
      storedSalt, 
      10000, // Must match the iteration count used in hashPassword
      64,    // Must match the byte length used in hashPassword
      'sha512'
    ).toString('hex');
    
    // Compare the generated hash with the stored hash
    return hash === storedHash;
  } catch (error) {
    console.error('Password verification error:', error);
    throw new Error('Failed to verify password');
  }
};

/**
 * Generate a random token
 * @param {number} length - Length of the token in bytes
 * @returns {string} Hex-encoded random token
 */
exports.generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a secure random string for use as a barcode
 * @returns {string} Random alphanumeric string
 */
exports.generateBarcode = () => {
  // Generate a unique ID with a prefix
  const prefix = 'WM-';
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  
  return `${prefix}${randomPart}`;
};

module.exports = exports;
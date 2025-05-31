// Password Validation Utility for WaveMAX Laundry Affiliate Program

/**
 * Strong password validation utility with comprehensive security requirements
 */

const commonPasswords = [
  'password', 'password123', '123456', '123456789', 'qwerty', 'abc123', 
  'password1', 'admin', 'letmein', 'welcome', 'monkey', '1234567890',
  'qwerty123', 'password12', 'admin123', 'root', 'user', 'test',
  'guest', 'login', 'pass', 'secret', 'master', 'super', 'admin1',
  'changeme', 'default', 'temp', 'temporary', 'wavemax', 'laundry'
];

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @param {string} username - Username to check against (optional)
 * @param {string} email - Email to check against (optional)
 * @returns {object} - Validation result with success boolean and errors array
 */
const validatePasswordStrength = (password, username = '', email = '') => {
  const errors = [];
  
  // Handle null/undefined password
  if (!password) {
    errors.push('Password is required');
    return { success: false, errors };
  }
  
  // Check minimum length (12 characters)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check for numbers
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  // Check against common passwords
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }
  
  // Check if password contains username
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('Password cannot contain your username');
  }
  
  // Check if password contains email (without domain)
  if (email) {
    const emailUser = email.split('@')[0];
    if (password.toLowerCase().includes(emailUser.toLowerCase())) {
      errors.push('Password cannot contain your email address');
    }
  }
  
  // Check for sequential characters (123, abc, etc.)
  if (/123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    errors.push('Password cannot contain sequential characters (e.g., 123, abc)');
  }
  
  // Check for repeated characters (more than 2 in a row)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 repeated characters in a row');
  }
  
  return {
    success: errors.length === 0,
    errors: errors
  };
};

/**
 * Express validator middleware for password validation
 * @param {string} field - The field name to validate (default: 'password')
 * @param {string} usernameField - The username field to compare against (optional)
 * @param {string} emailField - The email field to compare against (optional)
 */
const passwordValidationMiddleware = (field = 'password', usernameField = null, emailField = null) => {
  return (req, res, next) => {
    const password = req.body[field];
    const username = usernameField ? req.body[usernameField] : '';
    const email = emailField ? req.body[emailField] : '';
    
    const validation = validatePasswordStrength(password, username, email);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: validation.errors
      });
    }
    
    next();
  };
};

/**
 * Express validator custom validator function
 */
const customPasswordValidator = (value, { req }) => {
  const username = req.body.username || '';
  const email = req.body.email || '';
  
  const validation = validatePasswordStrength(value, username, email);
  
  if (!validation.success) {
    throw new Error(validation.errors.join('; '));
  }
  
  return true;
};

/**
 * Check if password has been used recently (for administrators/operators)
 * @param {string} newPassword - The new password to check
 * @param {Array} passwordHistory - Array of previous password hashes
 * @param {string} salt - Salt to use for hashing
 * @returns {boolean} - True if password is in history
 */
const isPasswordInHistory = (newPassword, passwordHistory = [], salt) => {
  if (!passwordHistory || passwordHistory.length === 0) {
    return false;
  }
  
  const encryptionUtil = require('./encryption');
  const newPasswordHash = encryptionUtil.hashPassword(newPassword, salt);
  
  return passwordHistory.some(historyHash => historyHash === newPasswordHash);
};

/**
 * Generate password strength score (0-100)
 * @param {string} password - Password to score
 * @returns {number} - Strength score
 */
const getPasswordStrength = (password) => {
  let score = 0;
  
  // Length scoring (max 30 points)
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 10;
  
  // Character variety (max 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score += 10;
  
  // Complexity bonus (max 30 points)
  if (!/(.)\1{1,}/.test(password)) score += 10; // No repeated chars
  if (!/123|234|345|456|567|678|789|890|abc|bcd|cde/i.test(password)) score += 10; // No sequences
  if (!commonPasswords.includes(password.toLowerCase())) score += 10; // Not common
  
  return Math.min(score, 100);
};

module.exports = {
  validatePasswordStrength,
  passwordValidationMiddleware,
  customPasswordValidator,
  isPasswordInHistory,
  getPasswordStrength,
  commonPasswords
};
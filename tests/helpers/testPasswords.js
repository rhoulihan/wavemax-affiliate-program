// Test Password Helper
// Strong passwords that meet the new security requirements for testing

/**
 * Strong test passwords that meet all security requirements:
 * - Minimum 12 characters
 * - Contains uppercase, lowercase, numbers, and special characters
 * - No common patterns
 * - Suitable for automated testing
 */

const strongTestPasswords = {
  // For affiliate tests
  affiliate1: 'TestAff4892!@#',
  affiliate2: 'SecureAff7315$%',
  affiliate3: 'ValidAff8047&*(',
  
  // For customer tests  
  customer1: 'TestCust4892!@#',
  customer2: 'SecureCust7315$%',
  customer3: 'ValidCust8047&*(',
  
  // For administrator tests
  admin1: 'TestAdmin4892!@#',
  admin2: 'SecureAdmin7315$%',
  admin3: 'ValidAdmin8047&*(',
  
  // For operator tests
  operator1: 'TestOp4892!@#$',
  operator2: 'SecureOp7315$%^',
  operator3: 'ValidOp8047&*()_',
  
  // For general testing
  general: 'StrongTest4892!@#',
  reset: 'ResetPass7315$%^',
  update: 'UpdatePass8047&*()',
  
  // For negative testing (these should fail)
  weak: {
    tooShort: 'Short1!',
    noUppercase: 'lowercase123!@#',
    noLowercase: 'UPPERCASE123!@#',
    noNumbers: 'NoNumbersHere!@#',
    noSpecial: 'NoSpecialChars123',
    common: 'password123456',
    sequential: 'abcdefgh1234'
  }
};

/**
 * Get a strong password for testing
 * @param {string} type - Type of password (affiliate, customer, admin, operator, general)
 * @param {number} index - Index for multiple passwords of same type (1, 2, 3)
 * @returns {string} Strong password
 */
function getStrongPassword(type = 'general', index = 1) {
  const key = index > 1 ? `${type}${index}` : type;
  return strongTestPasswords[key] || strongTestPasswords.general;
}

/**
 * Get a weak password for negative testing
 * @param {string} type - Type of weak password
 * @returns {string} Weak password that should fail validation
 */
function getWeakPassword(type = 'tooShort') {
  return strongTestPasswords.weak[type] || strongTestPasswords.weak.tooShort;
}

/**
 * Generate a random strong password for testing
 * @returns {string} Random strong password
 */
function generateRandomStrongPassword() {
  const chars = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-='
  };
  
  let password = '';
  
  // Ensure at least one character from each category
  password += chars.upper[Math.floor(Math.random() * chars.upper.length)];
  password += chars.lower[Math.floor(Math.random() * chars.lower.length)];
  password += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
  password += chars.special[Math.floor(Math.random() * chars.special.length)];
  
  // Fill remaining 8 characters randomly
  const allChars = chars.upper + chars.lower + chars.numbers + chars.special;
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = {
  strongTestPasswords,
  getStrongPassword,
  getWeakPassword,
  generateRandomStrongPassword
};
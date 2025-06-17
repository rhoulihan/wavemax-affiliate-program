/**
 * Utility helper functions for the WaveMAX application
 */

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code (default: 'USD')
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (amount, currency = 'USD') => {
  // Handle null/undefined amounts
  if (amount == null || isNaN(amount)) {
    amount = 0;
  }

  // Ensure amount is a number
  const numAmount = parseFloat(amount);

  // Format based on currency
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return formatter.format(numAmount);
};

/**
 * Format a date to a readable string
 * @param {Date|string} date - The date to format
 * @param {string} format - The format type ('short', 'long', 'iso')
 * @returns {string} - Formatted date string
 */
const formatDate = (date, format = 'short') => {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';

  switch (format) {
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'iso':
      return dateObj.toISOString().split('T')[0];
    case 'short':
    default:
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
  }
};

/**
 * Generate a random string of specified length
 * @param {number} length - The length of the string to generate
 * @returns {string} - Random string
 */
const generateRandomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Sanitize a string for use in CSV files
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeForCSV = (str) => {
  if (str == null) return '';
  
  // Convert to string
  str = String(str);
  
  // Escape double quotes by doubling them
  str = str.replace(/"/g, '""');
  
  // Wrap in quotes if contains comma, newline, or quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    str = `"${str}"`;
  }
  
  return str;
};

/**
 * Calculate percentage
 * @param {number} value - The value
 * @param {number} total - The total
 * @param {number} decimals - Number of decimal places
 * @returns {number} - Percentage
 */
const calculatePercentage = (value, total, decimals = 2) => {
  if (!total || total === 0) return 0;
  const percentage = (value / total) * 100;
  return Math.round(percentage * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

module.exports = {
  formatCurrency,
  formatDate,
  generateRandomString,
  sanitizeForCSV,
  calculatePercentage
};
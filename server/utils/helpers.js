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

module.exports = {
  formatCurrency,
  formatDate
};
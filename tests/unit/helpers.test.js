const {
  formatCurrency,
  formatDate
} = require('../../server/utils/helpers');

describe('Helpers Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format a number as USD currency by default', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(999999.99)).toBe('$999,999.99');
    });

    it('should handle null and undefined amounts', () => {
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
    });

    it('should handle NaN values', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
      expect(formatCurrency('not a number')).toBe('$0.00');
    });

    it('should parse string amounts', () => {
      expect(formatCurrency('123.45')).toBe('$123.45');
      expect(formatCurrency('1000')).toBe('$1,000.00');
    });

    it('should format with different currencies', () => {
      expect(formatCurrency(100, 'EUR')).toMatch(/100/);
      expect(formatCurrency(100, 'GBP')).toMatch(/100/);
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(10.999)).toBe('$11.00');
      expect(formatCurrency(10.001)).toBe('$10.00');
      expect(formatCurrency(10.005)).toBe('$10.01');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2025-06-22T10:30:00Z');

    it('should format date with short format by default', () => {
      const result = formatDate(testDate);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // MM/DD/YYYY format
    });

    it('should format date with long format', () => {
      const result = formatDate(testDate, 'long');
      expect(result).toContain('June');
      expect(result).toContain('22');
      expect(result).toContain('2025');
    });

    it('should format date with ISO format', () => {
      const result = formatDate(testDate, 'iso');
      expect(result).toBe('2025-06-22');
    });

    it('should handle string dates', () => {
      expect(formatDate('2025-06-22')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatDate('2025-06-22', 'iso')).toBe('2025-06-22');
    });

    it('should handle null and undefined dates', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid date')).toBe('');
      expect(formatDate(new Date('invalid'))).toBe('');
    });

    it('should handle different format cases', () => {
      expect(formatDate(testDate, 'unknown')).toMatch(/\d{2}\/\d{2}\/\d{4}/); // defaults to short
    });
  });

  // Note: The following functions were removed from helpers.js:
  // - generateRandomString
  // - sanitizeForCSV  
  // - calculatePercentage
  // These were identified as dead code and removed in the cleanup
});
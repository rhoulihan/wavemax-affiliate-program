const {
  formatCurrency,
  formatDate,
  generateRandomString,
  sanitizeForCSV,
  calculatePercentage
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

  describe('generateRandomString', () => {
    it('should generate a string of default length 10', () => {
      const result = generateRandomString();
      expect(result).toHaveLength(10);
      expect(result).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate strings of specified length', () => {
      expect(generateRandomString(5)).toHaveLength(5);
      expect(generateRandomString(20)).toHaveLength(20);
      expect(generateRandomString(0)).toHaveLength(0);
    });

    it('should generate different strings on each call', () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(generateRandomString());
      }
      expect(results.size).toBeGreaterThan(5); // Very unlikely to get duplicates
    });

    it('should only use alphanumeric characters', () => {
      const result = generateRandomString(100);
      expect(result).toMatch(/^[A-Za-z0-9]*$/);
    });
  });

  describe('sanitizeForCSV', () => {
    it('should return empty string for null and undefined', () => {
      expect(sanitizeForCSV(null)).toBe('');
      expect(sanitizeForCSV(undefined)).toBe('');
    });

    it('should convert non-string values to strings', () => {
      expect(sanitizeForCSV(123)).toBe('123');
      expect(sanitizeForCSV(true)).toBe('true');
      expect(sanitizeForCSV(false)).toBe('false');
    });

    it('should leave simple strings unchanged', () => {
      expect(sanitizeForCSV('hello')).toBe('hello');
      expect(sanitizeForCSV('test123')).toBe('test123');
    });

    it('should escape double quotes by doubling them', () => {
      expect(sanitizeForCSV('She said "hello"')).toBe('"She said ""hello"""');
      expect(sanitizeForCSV('""')).toBe('""""""');
    });

    it('should wrap strings containing commas in quotes', () => {
      expect(sanitizeForCSV('hello, world')).toBe('"hello, world"');
      expect(sanitizeForCSV('a,b,c')).toBe('"a,b,c"');
    });

    it('should wrap strings containing newlines in quotes', () => {
      expect(sanitizeForCSV('hello\nworld')).toBe('"hello\nworld"');
      expect(sanitizeForCSV('line1\nline2\nline3')).toBe('"line1\nline2\nline3"');
    });

    it('should handle complex strings with multiple special characters', () => {
      expect(sanitizeForCSV('John "JD" Doe, CEO\nAcme Corp')).toBe('"John ""JD"" Doe, CEO\nAcme Corp"');
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(75, 150)).toBe(50);
    });

    it('should handle zero total', () => {
      expect(calculatePercentage(10, 0)).toBe(0);
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it('should handle null or undefined total', () => {
      expect(calculatePercentage(10, null)).toBe(0);
      expect(calculatePercentage(10, undefined)).toBe(0);
    });

    it('should respect decimal places parameter', () => {
      expect(calculatePercentage(1, 3, 0)).toBe(33);
      expect(calculatePercentage(1, 3, 1)).toBe(33.3);
      expect(calculatePercentage(1, 3, 2)).toBe(33.33);
      expect(calculatePercentage(1, 3, 3)).toBe(33.333);
    });

    it('should round correctly', () => {
      expect(calculatePercentage(2, 3, 2)).toBe(66.67);
      expect(calculatePercentage(1, 6, 2)).toBe(16.67);
    });

    it('should handle edge cases', () => {
      expect(calculatePercentage(0, 100)).toBe(0);
      expect(calculatePercentage(100, 100)).toBe(100);
      expect(calculatePercentage(200, 100)).toBe(200);
    });

    it('should handle negative values', () => {
      expect(calculatePercentage(-50, 100)).toBe(-50);
      expect(calculatePercentage(50, -100)).toBe(-50);
    });
  });
});
// Mock dependencies before requiring emailService
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
  }))
}));

// NOTE: a previous version of this suite did jest.mock('fs', ...) (plus a
// matching jest.mock('util') for promisify) to stub the email template
// manager's file IO. That global fs replacement starved winston's logger
// (it needs real fs.existsSync at module load) and broke the whole suite at
// require time. formatSize is a pure function that never touches the
// filesystem, so those mocks are unnecessary here and have been removed.
const { formatSize } = require('../../server/utils/emailService');

describe('EmailService Helper Functions', () => {
  describe('formatSize', () => {
    it('should format small size correctly', () => {
      const result = formatSize('small');
      expect(result).toBe('Small (10-15 lbs)');
    });
    
    it('should format medium size correctly', () => {
      const result = formatSize('medium');
      expect(result).toBe('Medium (16-30 lbs)');
    });
    
    it('should format large size correctly', () => {
      const result = formatSize('large');
      expect(result).toBe('Large (31+ lbs)');
    });
    
    it('should return original value for unknown sizes', () => {
      const result = formatSize('extra-large');
      expect(result).toBe('extra-large');
    });
    
    it('should handle empty string', () => {
      const result = formatSize('');
      expect(result).toBe('');
    });
    
    it('should handle null value', () => {
      const result = formatSize(null);
      expect(result).toBe(null);
    });
    
    it('should handle undefined value', () => {
      const result = formatSize(undefined);
      expect(result).toBe(undefined);
    });
    
    it('should handle numeric values', () => {
      const result = formatSize(123);
      expect(result).toBe(123);
    });
    
    it('should handle uppercase input', () => {
      const result = formatSize('SMALL');
      expect(result).toBe('SMALL'); // Should not match case-sensitive
    });
    
    it('should handle mixed case input', () => {
      const result = formatSize('Small');
      expect(result).toBe('Small'); // Should not match case-sensitive
    });
  });
});
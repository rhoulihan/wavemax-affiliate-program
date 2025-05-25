const {
  sanitizeRequest,
  sanitizeEmail,
  sanitizePhone,
  sanitizeId,
  sanitizePath,
  sanitizeInput
} = require('../../server/middleware/sanitization');
const xss = require('xss');

// Mock xss module
jest.mock('xss');

describe('Sanitization Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();

    // Default mock implementation for xss
    xss.mockImplementation((input) => {
      // Simple mock that removes script tags
      return input.replace(/<script.*?>.*?<\/script>/gi, '');
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string input', () => {
      const input = '<script>alert("xss")</script>Hello';
      xss.mockReturnValue('Hello');

      const result = sanitizeInput(input);

      expect(xss).toHaveBeenCalledWith(input, expect.objectContaining({
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      }));
      expect(result).toBe('Hello');
    });

    it('should sanitize arrays recursively', () => {
      const input = ['<script>bad</script>', 'clean', '<b>bold</b>'];
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      const result = sanitizeInput(input);

      expect(result).toEqual(['', 'clean', 'bold']);
      expect(xss).toHaveBeenCalledTimes(3);
    });

    it('should sanitize objects recursively', () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        email: 'john@example.com',
        nested: {
          field: '<b>nested</b>'
        }
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      const result = sanitizeInput(input);

      expect(result).toEqual({
        name: 'John',
        email: 'john@example.com',
        nested: {
          field: 'nested'
        }
      });
    });

    it('should handle null values', () => {
      expect(sanitizeInput(null)).toBe(null);
    });

    it('should handle undefined values', () => {
      expect(sanitizeInput(undefined)).toBe(undefined);
    });

    it('should handle numbers', () => {
      expect(sanitizeInput(123)).toBe(123);
    });

    it('should handle booleans', () => {
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(false)).toBe(false);
    });

    it('should handle deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: '<script>deep xss</script>text'
          }
        }
      };
      xss.mockReturnValue('text');

      const result = sanitizeInput(input);

      expect(result.level1.level2.level3).toBe('text');
    });

    it('should handle arrays of objects', () => {
      const input = [
        { name: '<b>John</b>' },
        { name: '<i>Jane</i>' }
      ];
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      const result = sanitizeInput(input);

      expect(result).toEqual([
        { name: 'John' },
        { name: 'Jane' }
      ]);
    });

    it('should not modify prototype properties', () => {
      const input = Object.create({ inherited: '<script>bad</script>' });
      input.own = '<b>text</b>';
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      const result = sanitizeInput(input);

      expect(result.own).toBe('text');
      expect(result.inherited).toBeUndefined();
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize request body', () => {
      req.body = {
        username: '<script>alert("xss")</script>user',
        password: 'pass<b>word</b>'
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.body).toEqual({
        username: 'user',
        password: 'password'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      req.query = {
        search: '<img src=x onerror=alert("xss")>',
        page: '1'
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.query.search).toBe('');
      expect(req.query.page).toBe('1');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize URL parameters', () => {
      req.params = {
        id: 'ABC<script>123</script>',
        name: 'test'
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.params).toEqual({
        id: 'ABC123',
        name: 'test'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing request properties', () => {
      req = {};

      expect(() => sanitizeRequest(req, res, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    it('should handle all properties in one request', () => {
      req.body = { name: '<b>John</b>' };
      req.query = { filter: '<i>active</i>' };
      req.params = { id: '<u>123</u>' };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.body.name).toBe('John');
      expect(req.query.filter).toBe('active');
      expect(req.params.id).toBe('123');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize and validate email', () => {
      xss.mockImplementation(str => str);
      const result = sanitizeEmail('  John.Doe@Example.COM  ');

      expect(result).toBe('john.doe@example.com');
    });

    it('should remove HTML from email', () => {
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));
      const result = sanitizeEmail('<script>bad</script>john@example.com');

      expect(result).toBe('john@example.com');
    });

    it('should return empty string for invalid email', () => {
      xss.mockImplementation(str => str);

      expect(sanitizeEmail('not-an-email')).toBe('');
      expect(sanitizeEmail('missing@domain')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
      expect(sanitizeEmail('user@')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeEmail(null)).toBe('');
      expect(sanitizeEmail(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeEmail(123)).toBe('');
      expect(sanitizeEmail({})).toBe('');
      expect(sanitizeEmail([])).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizeEmail('')).toBe('');
    });

    it('should validate complex email formats', () => {
      xss.mockImplementation(str => str);

      expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
      expect(sanitizeEmail('user.name@sub.example.com')).toBe('user.name@sub.example.com');
      expect(sanitizeEmail('123@example.com')).toBe('123@example.com');
    });
  });

  describe('sanitizePhone', () => {
    it('should keep only allowed characters', () => {
      const result = sanitizePhone('(123) 456-7890');
      expect(result).toBe('(123) 456-7890');
    });

    it('should remove invalid characters', () => {
      const result = sanitizePhone('123-456-7890 ext. 123');
      expect(result).toBe('123-456-7890  123');
    });

    it('should handle international format', () => {
      const result = sanitizePhone('+1 (555) 123-4567');
      expect(result).toBe('+1 (555) 123-4567');
    });

    it('should remove HTML and special characters', () => {
      const result = sanitizePhone('<script>alert()</script>123-456-7890');
      expect(result).toBe('123-456-7890');
    });

    it('should handle null and undefined', () => {
      expect(sanitizePhone(null)).toBe('');
      expect(sanitizePhone(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizePhone(123)).toBe('');
      expect(sanitizePhone({})).toBe('');
    });

    it('should trim whitespace', () => {
      const result = sanitizePhone('  123-456-7890  ');
      expect(result).toBe('123-456-7890');
    });

    it('should handle empty string', () => {
      expect(sanitizePhone('')).toBe('');
    });
  });

  describe('sanitizeId', () => {
    it('should keep alphanumeric characters and hyphens', () => {
      const result = sanitizeId('ABC-123-xyz');
      expect(result).toBe('ABC-123-xyz');
    });

    it('should remove special characters', () => {
      const result = sanitizeId('ID_123@#$%');
      expect(result).toBe('ID123');
    });

    it('should remove spaces', () => {
      const result = sanitizeId('ID 123 456');
      expect(result).toBe('ID123456');
    });

    it('should handle script injection attempts', () => {
      const result = sanitizeId('<script>alert("xss")</script>ID123');
      expect(result).toBe('scriptalertxssscriptID123');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeId(null)).toBe('');
      expect(sanitizeId(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeId(123)).toBe('');
      expect(sanitizeId({})).toBe('');
    });

    it('should trim whitespace', () => {
      const result = sanitizeId('  ABC123  ');
      expect(result).toBe('ABC123');
    });

    it('should handle empty string', () => {
      expect(sanitizeId('')).toBe('');
    });

    it('should handle MongoDB ObjectId format', () => {
      const result = sanitizeId('507f1f77bcf86cd799439011');
      expect(result).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('sanitizePath', () => {
    it('should allow valid file paths', () => {
      const result = sanitizePath('/path/to/file.txt');
      expect(result).toBe('/path/to/file.txt');
    });

    it('should remove directory traversal attempts', () => {
      const result = sanitizePath('../../etc/passwd');
      expect(result).toBe('/etc/passwd');
    });

    it('should remove multiple directory traversal attempts', () => {
      const result = sanitizePath('path/../../../etc/passwd');
      expect(result).toBe('path//etc/passwd');
    });

    it('should allow valid characters in paths', () => {
      const result = sanitizePath('/path_to/file-name.test_123.txt');
      expect(result).toBe('/path_to/file-name.test_123.txt');
    });

    it('should remove invalid characters', () => {
      const result = sanitizePath('/path/to/<file>');
      expect(result).toBe('/path/to/file');
    });

    it('should handle Windows-style paths', () => {
      const result = sanitizePath('C:\\Users\\file.txt');
      expect(result).toBe('C\\Users\\file.txt');
    });

    it('should handle null and undefined', () => {
      expect(sanitizePath(null)).toBe('');
      expect(sanitizePath(undefined)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizePath(123)).toBe('');
      expect(sanitizePath({})).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizePath('')).toBe('');
    });

    it('should handle complex path traversal attempts', () => {
      const result = sanitizePath('valid/path/../../../../../../etc/passwd');
      expect(result).toBe('valid/path//etc/passwd');
    });

    it('should preserve forward slashes', () => {
      const result = sanitizePath('/var/www/html/index.html');
      expect(result).toBe('/var/www/html/index.html');
    });
  });

  describe('Integration tests', () => {
    it('should work with express middleware chain', () => {
      req.body = {
        email: '  <b>USER@EXAMPLE.COM</b>  ',
        phone: '(123) 456-7890 ext. 100',
        id: 'USER-123<script>',
        path: '../uploads/file.txt',
        message: '<script>alert("xss")</script>Hello World'
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.body.email).toBe('USER@EXAMPLE.COM');
      expect(req.body.phone).toBe('(123) 456-7890 ext. 100');
      expect(req.body.id).toBe('USER-123');
      expect(req.body.path).toBe('../uploads/file.txt');
      expect(req.body.message).toBe('Hello World');
      expect(next).toHaveBeenCalled();
    });

    it('should handle complex nested structures', () => {
      req.body = {
        user: {
          profile: {
            name: '<b>John Doe</b>',
            emails: ['<i>john@example.com</i>', 'doe@example.com'],
            settings: {
              notifications: true,
              theme: '<script>alert()</script>dark'
            }
          }
        }
      };
      xss.mockImplementation(str => str.replace(/<[^>]*>/g, ''));

      sanitizeRequest(req, res, next);

      expect(req.body.user.profile.name).toBe('John Doe');
      expect(req.body.user.profile.emails[0]).toBe('john@example.com');
      expect(req.body.user.profile.settings.theme).toBe('dark');
      expect(req.body.user.profile.settings.notifications).toBe(true);
    });
  });
});
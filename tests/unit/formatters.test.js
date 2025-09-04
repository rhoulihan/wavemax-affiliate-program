const Formatters = require('../../server/utils/formatters');

describe('Formatters', () => {
  describe('currency', () => {
    it('should format USD currency with default locale', () => {
      const result = Formatters.currency(1234.56);
      expect(result).toBe('$1,234.56');
    });

    it('should format zero amount', () => {
      const result = Formatters.currency(0);
      expect(result).toBe('$0.00');
    });

    it('should format negative amounts', () => {
      const result = Formatters.currency(-500.99);
      expect(result).toBe('-$500.99');
    });

    it('should handle different currencies', () => {
      const result = Formatters.currency(1000, 'EUR', 'de-DE');
      expect(result).toMatch(/1\.?000,00/); // Handles different locale formats
    });

    it('should handle null and undefined', () => {
      expect(Formatters.currency(null)).toBe('$0.00');
      expect(Formatters.currency(undefined)).toBe('$0.00');
    });

    it('should handle string numbers', () => {
      const result = Formatters.currency('1234.56');
      expect(result).toBe('$1,234.56');
    });
  });

  describe('date', () => {
    it('should format date with default (short) format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date);
      expect(result).toMatch(/1\/15\/2024|1\/15\/24/);
    });

    it('should format date with medium format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date, 'medium');
      expect(result).toMatch(/Jan 15, 2024/);
    });

    it('should format date with long format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date, 'long');
      expect(result).toMatch(/January 15, 2024/);
    });

    it('should format date with full format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date, 'full');
      expect(result).toMatch(/Monday, January 15, 2024/);
    });

    it('should format datetime', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date, 'datetime');
      expect(result).toMatch(/Jan 15, 2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should format time only', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = Formatters.date(date, 'time');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle ISO format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.date(date, 'iso');
      expect(result).toMatch(/2024-01-15T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should handle string dates', () => {
      const result = Formatters.date('2024-01-15');
      expect(result).toMatch(/1\/15\/2024|1\/15\/24/);
    });

    it('should handle invalid dates', () => {
      expect(Formatters.date(null)).toBe('');
      expect(Formatters.date(undefined)).toBe('');
      expect(Formatters.date('invalid')).toBe('');
    });
  });

  describe('datetime', () => {
    it('should format datetime with default options', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = Formatters.datetime(date);
      expect(result).toMatch(/01\/15\/2024, \d{2}:\d{2}/);
    });

    it('should format datetime with custom options', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const result = Formatters.datetime(date, options);
      expect(result).toMatch(/Monday, January 15, 2024/);
    });

    it('should handle invalid dates', () => {
      expect(Formatters.datetime(null)).toBe('');
      expect(Formatters.datetime(undefined)).toBe('');
      expect(Formatters.datetime('invalid')).toBe('');
    });
  });

  describe('relativeTime', () => {
    it('should format relative time for days', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const result = Formatters.relativeTime(yesterday);
      expect(result).toMatch(/(yesterday|1 day ago)/);
    });

    it('should format relative time for hours', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = Formatters.relativeTime(twoHoursAgo);
      expect(result).toMatch(/(2 hours ago)/);
    });

    it('should handle empty dates', () => {
      expect(Formatters.relativeTime(null)).toBe('');
      expect(Formatters.relativeTime(undefined)).toBe('');
    });
  });

  describe('phone', () => {
    it('should format 10-digit US phone number with default format', () => {
      const result = Formatters.phone('5551234567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should format phone with country code', () => {
      const result = Formatters.phone('15551234567');
      expect(result).toBe('+1 (555) 123-4567');
    });

    it('should format with dots format', () => {
      const result = Formatters.phone('5551234567', 'dots');
      expect(result).toBe('555.123.4567');
    });

    it('should format with international format', () => {
      const result = Formatters.phone('5551234567', 'international');
      expect(result).toBe('+1 5551234567');
    });

    it('should format 11-digit with international format', () => {
      const result = Formatters.phone('15551234567', 'international');
      expect(result).toBe('+15551234567');
    });

    it('should handle phone with existing formatting', () => {
      const result = Formatters.phone('555-123-4567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should handle phone with dots and format them', () => {
      const result = Formatters.phone('555.123.4567');
      expect(result).toBe('(555) 123-4567');
    });

    it('should return original for unrecognized formats', () => {
      const result = Formatters.phone('+44 20 7123 4567');
      expect(result).toBe('+44 20 7123 4567');
    });

    it('should handle invalid phone numbers', () => {
      expect(Formatters.phone('123')).toBe('123');
      expect(Formatters.phone('')).toBe('');
      expect(Formatters.phone(null)).toBe('');
      expect(Formatters.phone(undefined)).toBe('');
    });
  });

  describe('address', () => {
    it('should format complete address in single format', () => {
      const customer = {
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };
      const result = Formatters.address(customer);
      expect(result).toBe('123 Main St, Austin, TX, 78701');
    });

    it('should format address with address2', () => {
      const customer = {
        address: '123 Main St',
        address2: 'Apt 4B',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };
      const result = Formatters.address(customer);
      expect(result).toBe('123 Main St, Apt 4B, Austin, TX, 78701');
    });

    it('should handle missing fields', () => {
      const customer = {
        address: '123 Main St',
        city: 'Austin'
      };
      const result = Formatters.address(customer);
      expect(result).toBe('123 Main St, Austin');
    });

    it('should format as multi-line', () => {
      const customer = {
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };
      const result = Formatters.address(customer, 'multi');
      expect(result).toBe('123 Main St\nAustin, TX, 78701');
    });

    it('should format as short (city, state only)', () => {
      const customer = {
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      };
      const result = Formatters.address(customer, 'short');
      expect(result).toBe('Austin, TX');
    });

    it('should handle empty address', () => {
      expect(Formatters.address({})).toBe('');
      expect(Formatters.address(null)).toBe('');
      expect(Formatters.address(undefined)).toBe('');
    });
  });

  describe('name', () => {
    it('should format single name correctly', () => {
      const result = Formatters.name('john doe');
      expect(result).toBe('John Doe');
    });

    it('should capitalize names correctly', () => {
      const result = Formatters.name('mary-jane o\'connor');
      expect(result).toBe('Mary-Jane O\'Connor');
    });

    it('should handle McDonald and MacLeod type names', () => {
      expect(Formatters.name('mcdonald')).toBe('McDonald');
      expect(Formatters.name('macleod')).toBe('MacLeod');
    });

    it('should format as lastFirst when requested', () => {
      const result = Formatters.name('john doe', true);
      expect(result).toBe('Doe, John');
    });

    it('should handle single word names with lastFirst', () => {
      const result = Formatters.name('john', true);
      expect(result).toBe('John');
    });

    it('should handle empty names', () => {
      expect(Formatters.name('')).toBe('');
      expect(Formatters.name(null)).toBe('');
      expect(Formatters.name(undefined)).toBe('');
    });
  });

  describe('fullName', () => {
    it('should format full name from first and last', () => {
      const result = Formatters.fullName('john', 'doe');
      expect(result).toBe('John Doe');
    });

    it('should format as lastFirst when requested', () => {
      const result = Formatters.fullName('john', 'doe', true);
      expect(result).toBe('Doe, John');
    });

    it('should handle missing first name', () => {
      const result = Formatters.fullName('', 'doe');
      expect(result).toBe('Doe');
    });

    it('should handle missing last name', () => {
      const result = Formatters.fullName('john', '');
      expect(result).toBe('John');
    });

    it('should handle empty names', () => {
      expect(Formatters.fullName('', '')).toBe('');
      expect(Formatters.fullName(null, null)).toBe('');
      expect(Formatters.fullName(undefined, undefined)).toBe('');
    });
  });

  describe('percentage', () => {
    it('should format percentage with default decimals (0)', () => {
      const result = Formatters.percentage(0.1234);
      expect(result).toBe('12%');
    });

    it('should format percentage with custom decimals', () => {
      const result = Formatters.percentage(0.1234, 2);
      expect(result).toBe('12.34%');
    });

    it('should format zero percentage', () => {
      const result = Formatters.percentage(0);
      expect(result).toBe('0%');
    });

    it('should format percentage with 1 decimal', () => {
      const result = Formatters.percentage(0.155, 1);
      expect(result).toBe('15.5%');
    });

    it('should handle null and undefined', () => {
      expect(Formatters.percentage(null)).toBe('0%');
      expect(Formatters.percentage(undefined)).toBe('0%');
    });

    it('should multiply by 100 automatically', () => {
      const result = Formatters.percentage(0.5, 0);
      expect(result).toBe('50%');
    });
  });

  describe('weight', () => {
    it('should format weight with default unit (lbs)', () => {
      const result = Formatters.weight(5.5);
      expect(result).toBe('5.50 lbs');
    });

    it('should format weight with custom unit', () => {
      const result = Formatters.weight(2.3, 'kg');
      expect(result).toBe('2.30 kg');
    });

    it('should handle null and undefined', () => {
      expect(Formatters.weight(null)).toBe('0 lbs');
      expect(Formatters.weight(undefined)).toBe('0 lbs');
    });

    it('should handle zero weight', () => {
      const result = Formatters.weight(0);
      expect(result).toBe('0.00 lbs');
    });
  });

  describe('status', () => {
    it('should format order status', () => {
      expect(Formatters.status('pending', 'order')).toBe('Pending');
      expect(Formatters.status('scheduled', 'order')).toBe('Scheduled');
      expect(Formatters.status('collected', 'order')).toBe('Collected');
      expect(Formatters.status('processing', 'order')).toBe('Processing');
      expect(Formatters.status('processed', 'order')).toBe('Processed');
      expect(Formatters.status('delivered', 'order')).toBe('Delivered');
      expect(Formatters.status('completed', 'order')).toBe('Completed');
      expect(Formatters.status('cancelled', 'order')).toBe('Cancelled');
    });

    it('should format payment status', () => {
      expect(Formatters.status('pending', 'payment')).toBe('Pending');
      expect(Formatters.status('verified', 'payment')).toBe('Verified');
      expect(Formatters.status('failed', 'payment')).toBe('Failed');
      expect(Formatters.status('refunded', 'payment')).toBe('Refunded');
      expect(Formatters.status('partial', 'payment')).toBe('Partial Payment');
      expect(Formatters.status('overpaid', 'payment')).toBe('Overpaid');
    });

    it('should format bag status', () => {
      expect(Formatters.status('pending', 'bag')).toBe('Pending');
      expect(Formatters.status('collected', 'bag')).toBe('Collected');
      expect(Formatters.status('processing', 'bag')).toBe('In Processing');
      expect(Formatters.status('processed', 'bag')).toBe('Processed');
      expect(Formatters.status('delivered', 'bag')).toBe('Delivered');
      expect(Formatters.status('completed', 'bag')).toBe('Completed');
    });

    it('should handle unknown status with capitalization', () => {
      expect(Formatters.status('unknown_status', 'order')).toBe('Unknown_status');
      expect(Formatters.status('', 'payment')).toBe('');
      expect(Formatters.status(null, 'delivery')).toBe('');
    });

    it('should default to order status map', () => {
      expect(Formatters.status('pending')).toBe('Pending');
      expect(Formatters.status('completed')).toBe('Completed');
    });
  });

  describe('orderId', () => {
    it('should return full order ID', () => {
      const result = Formatters.orderId('ORD-12345678');
      expect(result).toBe('ORD-12345678');
    });

    it('should return short format when requested', () => {
      const result = Formatters.orderId('ORD-12345678901234', true);
      expect(result).toBe('ORD-12...1234');
    });

    it('should return full ID for short IDs even when short format requested', () => {
      const result = Formatters.orderId('ORD-123', true);
      expect(result).toBe('ORD-123');
    });

    it('should handle empty order ID', () => {
      expect(Formatters.orderId('')).toBe('');
      expect(Formatters.orderId(null)).toBe('');
      expect(Formatters.orderId(undefined)).toBe('');
    });
  });

  describe('bagId', () => {
    it('should return full bag ID', () => {
      const result = Formatters.bagId('ORD-123-BAG1');
      expect(result).toBe('ORD-123-BAG1');
    });

    it('should extract bag number when requested', () => {
      const result = Formatters.bagId('ORD-123-BAG1', true);
      expect(result).toBe('Bag #1');
    });

    it('should extract multi-digit bag number', () => {
      const result = Formatters.bagId('ORD-456-BAG15', true);
      expect(result).toBe('Bag #15');
    });

    it('should return full ID if no bag pattern found', () => {
      const result = Formatters.bagId('INVALID-ID', true);
      expect(result).toBe('INVALID-ID');
    });

    it('should handle empty bag ID', () => {
      expect(Formatters.bagId('')).toBe('');
      expect(Formatters.bagId(null)).toBe('');
      expect(Formatters.bagId(undefined)).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate long text with default settings', () => {
      const text = 'This is a very long text that needs to be truncated because it exceeds the limit';
      const result = Formatters.truncate(text);
      expect(result).toBe('This is a very long text that needs to be trunc...');
      expect(result.length).toBe(50);
    });

    it('should truncate with custom length', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = Formatters.truncate(text, 20);
      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      const result = Formatters.truncate(text, 20);
      expect(result).toBe('Short text');
    });

    it('should use custom suffix', () => {
      const text = 'This is a very long text';
      const result = Formatters.truncate(text, 15, '---');
      expect(result).toBe('This is a ve---');
      expect(result.length).toBe(15);
    });

    it('should handle text equal to max length', () => {
      const text = 'Exactly twenty chars';
      const result = Formatters.truncate(text, 20);
      expect(result).toBe('Exactly twenty chars');
    });

    it('should handle empty text', () => {
      expect(Formatters.truncate('', 10)).toBe('');
      expect(Formatters.truncate(null, 10)).toBe('');
      expect(Formatters.truncate(undefined, 10)).toBe('');
    });
  });

  describe('fileSize', () => {
    it('should format bytes', () => {
      expect(Formatters.fileSize(500)).toBe('500 Bytes');
    });

    it('should format zero bytes', () => {
      expect(Formatters.fileSize(0)).toBe('0 Bytes');
    });

    it('should format kilobytes', () => {
      expect(Formatters.fileSize(1024)).toBe('1 KB');
      expect(Formatters.fileSize(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(Formatters.fileSize(1048576)).toBe('1 MB');
      expect(Formatters.fileSize(5242880)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(Formatters.fileSize(1073741824)).toBe('1 GB');
    });

    it('should format with decimals when needed', () => {
      expect(Formatters.fileSize(1536)).toBe('1.5 KB'); // 1.5 * 1024
      expect(Formatters.fileSize(1572864)).toBe('1.5 MB'); // 1.5 * 1024^2
    });
  });

  describe('duration', () => {
    it('should format seconds only', () => {
      expect(Formatters.duration(30)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(Formatters.duration(90)).toBe('1m 30s');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(Formatters.duration(3661)).toBe('1h 1m 1s');
    });

    it('should handle zero duration', () => {
      expect(Formatters.duration(0)).toBe('0s');
    });

    it('should handle negative or null values', () => {
      expect(Formatters.duration(-10)).toBe('0s');
      expect(Formatters.duration(null)).toBe('0s');
      expect(Formatters.duration(undefined)).toBe('0s');
    });

    it('should format hours only', () => {
      expect(Formatters.duration(3600)).toBe('1h');
    });

    it('should format minutes only', () => {
      expect(Formatters.duration(60)).toBe('1m');
    });
  });

  describe('plural', () => {
    it('should use singular for count of 1', () => {
      const result = Formatters.plural(1, 'item', 'items');
      expect(result).toBe('1 item');
    });

    it('should use plural for count > 1', () => {
      const result = Formatters.plural(5, 'item', 'items');
      expect(result).toBe('5 items');
    });

    it('should use plural for count of 0', () => {
      const result = Formatters.plural(0, 'item', 'items');
      expect(result).toBe('0 items');
    });

    it('should auto-pluralize with s when no plural provided', () => {
      const result = Formatters.plural(3, 'bag');
      expect(result).toBe('3 bags');
    });

    it('should handle irregular plurals', () => {
      const result = Formatters.plural(2, 'child', 'children');
      expect(result).toBe('2 children');
    });

    it('should use singular for 1 even with custom plural', () => {
      const result = Formatters.plural(1, 'child', 'children');
      expect(result).toBe('1 child');
    });
  });

  describe('list', () => {
    it('should format single item', () => {
      const result = Formatters.list(['apple']);
      expect(result).toBe('apple');
    });

    it('should format two items with default separator', () => {
      const result = Formatters.list(['apple', 'banana']);
      expect(result).toBe('apple and banana');
    });

    it('should format multiple items with default separators', () => {
      const result = Formatters.list(['apple', 'banana', 'cherry']);
      expect(result).toBe('apple, banana and cherry');
    });

    it('should format with custom separators', () => {
      const result = Formatters.list(['apple', 'banana', 'cherry'], '; ', ' or ');
      expect(result).toBe('apple; banana or cherry');
    });

    it('should handle empty array', () => {
      expect(Formatters.list([])).toBe('');
      expect(Formatters.list(null)).toBe('');
      expect(Formatters.list(undefined)).toBe('');
    });

    it('should handle many items', () => {
      const result = Formatters.list(['a', 'b', 'c', 'd', 'e']);
      expect(result).toBe('a, b, c, d and e');
    });
  });
});
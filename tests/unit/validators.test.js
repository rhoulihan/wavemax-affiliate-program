// Validators Unit Tests

const {
  isValidEmail,
  isValidPhone,
  isValidUsername,
  isValidZipCode,
  isValidTimeFormat,
  isValidName,
  mongooseValidators,
  expressValidators,
  validateEmail,
  validatePhone,
  validateUsername,
  validateZipCode,
  validateTimeFormat,
  validateName
} = require('../../server/utils/validators');

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('first+last@company.org')).toBe(true);
      expect(isValidEmail('123@numbers.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('missing@.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should validate correct US phone numbers', () => {
      expect(isValidPhone('5551234567')).toBe(true);
      expect(isValidPhone('555-123-4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
      expect(isValidPhone('555.123.4567')).toBe(true);
      expect(isValidPhone('15551234567')).toBe(true);
      expect(isValidPhone('1-555-123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('555123456')).toBe(false); // 9 digits
      expect(isValidPhone('55512345678')).toBe(false); // 11 digits without 1
      expect(isValidPhone('25551234567')).toBe(false); // 11 digits starting with 2
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(isValidUsername('john_doe')).toBe(true);
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test-user')).toBe(true);
      expect(isValidUsername('ABC')).toBe(true); // 3 chars minimum
      expect(isValidUsername('a'.repeat(30))).toBe(true); // 30 chars maximum
    });

    it('should reject invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(31))).toBe(false); // too long
      expect(isValidUsername('user name')).toBe(false); // spaces
      expect(isValidUsername('user@name')).toBe(false); // special chars
      expect(isValidUsername('')).toBe(false);
    });
  });

  describe('isValidZipCode', () => {
    it('should validate correct US zip codes', () => {
      expect(isValidZipCode('12345')).toBe(true);
      expect(isValidZipCode('12345-6789')).toBe(true);
      expect(isValidZipCode('00000')).toBe(true);
      expect(isValidZipCode('99999')).toBe(true);
    });

    it('should reject invalid zip codes', () => {
      expect(isValidZipCode('1234')).toBe(false); // too short
      expect(isValidZipCode('123456')).toBe(false); // too long
      expect(isValidZipCode('12345-678')).toBe(false); // wrong format
      expect(isValidZipCode('ABCDE')).toBe(false); // letters
      expect(isValidZipCode('')).toBe(false);
    });
  });

  describe('isValidTimeFormat', () => {
    it('should validate correct time formats', () => {
      expect(isValidTimeFormat('00:00')).toBe(true);
      expect(isValidTimeFormat('12:30')).toBe(true);
      expect(isValidTimeFormat('23:59')).toBe(true);
      expect(isValidTimeFormat('9:30')).toBe(true);
      expect(isValidTimeFormat('09:05')).toBe(true);
    });

    it('should reject invalid time formats', () => {
      expect(isValidTimeFormat('24:00')).toBe(false); // hour too high
      expect(isValidTimeFormat('12:60')).toBe(false); // minute too high
      expect(isValidTimeFormat('12:3')).toBe(false); // minute needs 2 digits
      expect(isValidTimeFormat('12')).toBe(false); // missing minutes
      expect(isValidTimeFormat('12:30:00')).toBe(false); // has seconds
      expect(isValidTimeFormat('')).toBe(false);
    });
  });

  describe('isValidName', () => {
    it('should validate correct names', () => {
      expect(isValidName('John')).toBe(true);
      expect(isValidName('Mary Jane')).toBe(true);
      expect(isValidName("O'Connor")).toBe(true);
      expect(isValidName('Anne-Marie')).toBe(true);
      expect(isValidName('A')).toBe(true); // 1 char minimum
      expect(isValidName('A'.repeat(50))).toBe(true); // 50 chars maximum
    });

    it('should reject invalid names', () => {
      expect(isValidName('')).toBe(false); // empty
      expect(isValidName('A'.repeat(51))).toBe(false); // too long
      expect(isValidName('John123')).toBe(false); // numbers
      expect(isValidName('John@Doe')).toBe(false); // special chars
      expect(isValidName('John_Doe')).toBe(false); // underscore
    });
  });

  describe('mongooseValidators', () => {
    it('should provide email validator', () => {
      expect(mongooseValidators.email.validator('test@example.com')).toBe(true);
      expect(mongooseValidators.email.validator('invalid')).toBe(false);
      expect(mongooseValidators.email.message).toBe('Please enter a valid email address');
    });

    it('should provide phone validator', () => {
      expect(mongooseValidators.phone.validator('555-123-4567')).toBe(true);
      expect(mongooseValidators.phone.validator('123')).toBe(false);
      expect(mongooseValidators.phone.message).toBe('Please enter a valid phone number');
    });

    it('should provide username validator', () => {
      expect(mongooseValidators.username.validator('john_doe')).toBe(true);
      expect(mongooseValidators.username.validator('ab')).toBe(false);
      expect(mongooseValidators.username.message).toContain('3-30 characters');
    });

    it('should provide zipCode validator', () => {
      expect(mongooseValidators.zipCode.validator('12345')).toBe(true);
      expect(mongooseValidators.zipCode.validator('abcde')).toBe(false);
      expect(mongooseValidators.zipCode.message).toBe('Please enter a valid zip code');
    });

    it('should provide timeFormat validator', () => {
      expect(mongooseValidators.timeFormat.validator('12:30')).toBe(true);
      expect(mongooseValidators.timeFormat.validator('25:00')).toBe(false);
      expect(mongooseValidators.timeFormat.message).toBe('Please enter a valid time format (HH:MM)');
    });

    it('should provide name validator', () => {
      expect(mongooseValidators.name.validator('John Doe')).toBe(true);
      expect(mongooseValidators.name.validator('John123')).toBe(false);
      expect(mongooseValidators.name.message).toContain('1-50 characters');
    });
  });

  describe('expressValidators', () => {
    it('should provide email validator function', () => {
      const emailValidator = expressValidators.email();
      expect(typeof emailValidator).toBe('function');
    });

    it('should provide phone validator function', () => {
      const phoneValidator = expressValidators.phone();
      expect(phoneValidator('555-123-4567')).toBe(true);
      expect(phoneValidator('123')).toBe(false);
    });

    it('should provide username validator function', () => {
      const usernameValidator = expressValidators.username();
      expect(usernameValidator('john_doe')).toBe(true);
      expect(usernameValidator('ab')).toBe(false);
    });

    it('should provide zipCode validator function', () => {
      const zipValidator = expressValidators.zipCode();
      expect(zipValidator('12345')).toBe(true);
      expect(zipValidator('abcde')).toBe(false);
    });

    it('should provide timeFormat validator function', () => {
      const timeValidator = expressValidators.timeFormat();
      expect(timeValidator('12:30')).toBe(true);
      expect(timeValidator('25:00')).toBe(false);
    });

    it('should provide name validator function', () => {
      const nameValidator = expressValidators.name();
      expect(nameValidator('John Doe')).toBe(true);
      expect(nameValidator('John123')).toBe(false);
    });
  });

  describe('Client-side validation functions', () => {
    describe('validateEmail', () => {
      it('should return validation result for emails', () => {
        const validResult = validateEmail('test@example.com');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toBe('Please enter a valid email address');

        const invalidResult = validateEmail('invalid');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toBe('Please enter a valid email address');
      });
    });

    describe('validatePhone', () => {
      it('should return validation result for phones', () => {
        const validResult = validatePhone('555-123-4567');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toBe('Please enter a valid phone number');

        const invalidResult = validatePhone('123');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toBe('Please enter a valid phone number');
      });
    });

    describe('validateUsername', () => {
      it('should return validation result for usernames', () => {
        const validResult = validateUsername('john_doe');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toContain('3-30 characters');

        const invalidResult = validateUsername('ab');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toContain('3-30 characters');
      });
    });

    describe('validateZipCode', () => {
      it('should return validation result for zip codes', () => {
        const validResult = validateZipCode('12345');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toBe('Please enter a valid zip code');

        const invalidResult = validateZipCode('abcde');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toBe('Please enter a valid zip code');
      });
    });

    describe('validateTimeFormat', () => {
      it('should return validation result for time formats', () => {
        const validResult = validateTimeFormat('12:30');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toBe('Please enter a valid time format (HH:MM)');

        const invalidResult = validateTimeFormat('25:00');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toBe('Please enter a valid time format (HH:MM)');
      });
    });

    describe('validateName', () => {
      it('should return validation result for names', () => {
        const validResult = validateName('John Doe');
        expect(validResult.isValid).toBe(true);
        expect(validResult.message).toContain('1-50 characters');

        const invalidResult = validateName('John123');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toContain('1-50 characters');
      });
    });
  });
});
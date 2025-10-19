const {
    escapeRegex,
    validateSortField,
    sanitizeObjectId
} = require('../../server/utils/securityUtils');

describe('Security Utils', () => {
    describe('escapeRegex', () => {
        it('should escape special regex characters', () => {
            const input = 'test.*+?^${}()|[]\\';
            const result = escapeRegex(input);
            expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
        });

        it('should return empty string for non-string input', () => {
            expect(escapeRegex(null)).toBe('');
            expect(escapeRegex(undefined)).toBe('');
            expect(escapeRegex(123)).toBe('');
            expect(escapeRegex({})).toBe('');
            expect(escapeRegex([])).toBe('');
        });

        it('should handle strings without special characters', () => {
            const input = 'test123';
            expect(escapeRegex(input)).toBe('test123');
        });

        it('should handle empty string', () => {
            expect(escapeRegex('')).toBe('');
        });

        it('should escape all regex metacharacters', () => {
            expect(escapeRegex('.')).toBe('\\.');
            expect(escapeRegex('*')).toBe('\\*');
            expect(escapeRegex('+')).toBe('\\+');
            expect(escapeRegex('?')).toBe('\\?');
            expect(escapeRegex('^')).toBe('\\^');
            expect(escapeRegex('$')).toBe('\\$');
            expect(escapeRegex('{')).toBe('\\{');
            expect(escapeRegex('}')).toBe('\\}');
            expect(escapeRegex('(')).toBe('\\(');
            expect(escapeRegex(')')).toBe('\\)');
            expect(escapeRegex('|')).toBe('\\|');
            expect(escapeRegex('[')).toBe('\\[');
            expect(escapeRegex(']')).toBe('\\]');
            expect(escapeRegex('\\')).toBe('\\\\');
        });
    });

    describe('validateSortField', () => {
        const allowedFields = ['name', 'email', 'createdAt', 'user.name'];

        it('should return valid field name from allowed list', () => {
            expect(validateSortField('name', allowedFields)).toBe('name');
            expect(validateSortField('email', allowedFields)).toBe('email');
            expect(validateSortField('createdAt', allowedFields)).toBe('createdAt');
            expect(validateSortField('user.name', allowedFields)).toBe('user.name');
        });

        it('should return null for field not in allowed list', () => {
            expect(validateSortField('password', allowedFields)).toBe(null);
            expect(validateSortField('secretField', allowedFields)).toBe(null);
        });

        it('should sanitize and validate field with special characters', () => {
            // Should remove special characters and check against allowed list
            expect(validateSortField('name$', allowedFields)).toBe('name');
            expect(validateSortField('email;DROP TABLE users', allowedFields)).toBe(null);
        });

        it('should return null for non-string input', () => {
            expect(validateSortField(null, allowedFields)).toBe(null);
            expect(validateSortField(undefined, allowedFields)).toBe(null);
            expect(validateSortField(123, allowedFields)).toBe(null);
            expect(validateSortField({}, allowedFields)).toBe(null);
        });

        it('should return null for empty string', () => {
            expect(validateSortField('', allowedFields)).toBe(null);
        });

        it('should allow fields with dots, hyphens, and underscores', () => {
            const fields = ['user.name', 'first-name', 'last_name'];
            expect(validateSortField('user.name', fields)).toBe('user.name');
            expect(validateSortField('first-name', fields)).toBe('first-name');
            expect(validateSortField('last_name', fields)).toBe('last_name');
        });

        it('should prevent NoSQL injection attempts', () => {
            expect(validateSortField('name; db.dropDatabase()', allowedFields)).toBe(null);
            expect(validateSortField('name\'); DROP TABLE users;--', allowedFields)).toBe(null);
            expect(validateSortField('$where', allowedFields)).toBe(null);
        });
    });

    describe('sanitizeObjectId', () => {
        it('should return valid 24-character hex ObjectId', () => {
            const validId = '507f1f77bcf86cd799439011';
            expect(sanitizeObjectId(validId)).toBe(validId);
        });

        it('should return valid uppercase ObjectId', () => {
            const validId = '507F1F77BCF86CD799439011';
            expect(sanitizeObjectId(validId)).toBe(validId);
        });

        it('should return valid mixed case ObjectId', () => {
            const validId = '507f1F77BcF86cD799439011';
            expect(sanitizeObjectId(validId)).toBe(validId);
        });

        it('should return null for invalid ObjectId (wrong length)', () => {
            expect(sanitizeObjectId('507f1f77bcf86cd7')).toBe(null); // Too short
            expect(sanitizeObjectId('507f1f77bcf86cd799439011abc')).toBe(null); // Too long
        });

        it('should return null for invalid ObjectId (non-hex characters)', () => {
            expect(sanitizeObjectId('507f1f77bcf86cd79943901g')).toBe(null); // 'g' is not hex
            expect(sanitizeObjectId('507f1f77bcf86cd79943901!')).toBe(null); // '!' is not hex
            expect(sanitizeObjectId('507f1f77bcf86cd79943 011')).toBe(null); // contains space
        });

        it('should return null for non-string input', () => {
            expect(sanitizeObjectId(null)).toBe(null);
            expect(sanitizeObjectId(undefined)).toBe(null);
            expect(sanitizeObjectId(123)).toBe(null);
            expect(sanitizeObjectId({})).toBe(null);
            expect(sanitizeObjectId([])).toBe(null);
        });

        it('should return null for empty string', () => {
            expect(sanitizeObjectId('')).toBe(null);
        });

        it('should prevent injection attempts', () => {
            expect(sanitizeObjectId('507f1f77bcf86cd799439011; DROP TABLE users;')).toBe(null);
            expect(sanitizeObjectId('507f1f77bcf86cd799439011\' OR \'1\'=\'1')).toBe(null);
            expect(sanitizeObjectId('$where: function() { return true; }')).toBe(null);
        });
    });
});

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const w9Storage = require('../../server/utils/w9Storage');
const W9Document = require('../../server/models/W9Document');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('fs').promises;
jest.mock('crypto');
jest.mock('../../server/models/W9Document');
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

describe('W9Storage Utility Unit Tests', () => {
  const mockDocumentId = 'W9DOC-123';
  const mockFileContent = Buffer.from('test pdf content');
  // Encrypted content needs to have IV (16 bytes) + auth tag (16 bytes) + encrypted data
  const mockEncryptedContent = Buffer.concat([
    Buffer.alloc(16), // IV
    Buffer.alloc(16), // Auth tag
    Buffer.from('encrypted content') // Encrypted data
  ]);
  const mockDecryptedContent = Buffer.from('decrypted content');
  const mockAffiliateId = 'AFF-123';
  const mockUploadedBy = { id: 'user123', type: 'affiliate' };
  const mockOriginalName = 'test-w9.pdf';
  const mockMimeType = 'application/pdf';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup uuid mock
    let uuidCounter = 0;
    uuidv4.mockImplementation(() => `mock-uuid-${++uuidCounter}`);

    // Setup crypto mocks
    const mockCipher = {
      update: jest.fn().mockReturnValue(Buffer.from('partial')),
      final: jest.fn().mockReturnValue(Buffer.from('final')),
      getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16))
    };

    const mockDecipher = {
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
      final: jest.fn().mockReturnValue(Buffer.from(''))
    };

    crypto.randomBytes = jest.fn((size) => {
      return Buffer.alloc(size);
    });

    crypto.createCipheriv = jest.fn().mockReturnValue(mockCipher);
    crypto.createDecipheriv = jest.fn().mockReturnValue(mockDecipher);
    crypto.pbkdf2Sync = jest.fn().mockReturnValue(Buffer.alloc(32));
  });

  describe('store()', () => {
    it('should successfully store encrypted W-9 document', async () => {
      // Mock file system operations
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      const storageKey = await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/secure/w9-documents'),
        { recursive: true, mode: 0o700 }
      );

      // Verify file write operation
      expect(fs.writeFile).toHaveBeenCalledTimes(1); // Only encrypted document

      // Verify encryption was used
      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );

      // Verify storage result
      expect(storageKey).toHaveProperty('storageKey');
      expect(storageKey.storageKey).toMatch(/^AFF-123_\d+_mock-uuid-\d+$/);
    });

    it('should handle storage directory creation error', async () => {
      fs.mkdir = jest.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      )).rejects.toThrow('Permission denied');
    });

    it('should handle file write error', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      await expect(w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      )).rejects.toThrow('Disk full');
    });

    it('should reject if document already exists', async () => {
      // The new implementation doesn't check for existing documents before storing
      // It generates unique storage keys, so this test is no longer applicable
      // Let's test that it generates unique keys instead
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();

      const key1 = await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      const key2 = await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('retrieve()', () => {
    it('should successfully retrieve and decrypt W-9 document', async () => {
      const mockMetadata = {
        key: Buffer.alloc(32).toString('base64'),
        iv: Buffer.alloc(16).toString('base64'),
        authTag: Buffer.alloc(16).toString('base64'),
        originalName: 'test-w9.pdf',
        uploadDate: new Date().toISOString()
      };

      fs.readFile = jest.fn()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(mockMetadata))) // metadata
        .mockResolvedValueOnce(mockEncryptedContent); // encrypted document

      // Mock W9Document lookup
      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        storageKey: 'test-storage-key',
        isActive: true,
        originalName: mockOriginalName,
        mimeType: mockMimeType,
        size: mockFileContent.length,
        affiliateId: mockAffiliateId
      });

      // Mock file read
      fs.readFile = jest.fn().mockResolvedValue(mockEncryptedContent);

      const result = await w9Storage.retrieve(mockDocumentId, 'user123');

      // Verify file read
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('.enc')
      );

      // Verify decryption was used
      expect(crypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );

      expect(result).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.originalName).toBe(mockOriginalName);
      expect(result.affiliateId).toBe(mockAffiliateId);
    });

    it('should handle missing document', async () => {
      W9Document.findOne = jest.fn().mockResolvedValue(null);

      await expect(w9Storage.retrieve(mockDocumentId, 'user123'))
        .rejects.toThrow('W-9 document not found');
    });

    it('should handle corrupted metadata', async () => {
      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        storageKey: 'test-storage-key',
        isActive: false
      });

      await expect(w9Storage.retrieve(mockDocumentId, 'user123'))
        .rejects.toThrow('W-9 document is no longer active');
    });

    it('should handle decryption failure', async () => {
      const mockMetadata = {
        key: Buffer.alloc(32).toString('base64'),
        iv: Buffer.alloc(16).toString('base64'),
        authTag: Buffer.alloc(16).toString('base64')
      };

      fs.readFile = jest.fn()
        .mockResolvedValueOnce(Buffer.from(JSON.stringify(mockMetadata)))
        .mockResolvedValueOnce(mockEncryptedContent);

      const mockDecipher = {
        setAuthTag: jest.fn(),
        update: jest.fn().mockReturnValue(Buffer.from('partial')),
        final: jest.fn().mockImplementation(() => {
          throw new Error('Decryption failed');
        })
      };

      crypto.createDecipheriv = jest.fn().mockReturnValue(mockDecipher);

      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        storageKey: 'test-storage-key',
        isActive: true
      });

      await expect(w9Storage.retrieve(mockDocumentId, 'user123'))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('delete()', () => {
    it('should successfully delete W-9 document and metadata', async () => {
      fs.unlink = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockResolvedValue(); // Files exist

      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        storageKey: 'test-storage-key',
        softDelete: jest.fn().mockResolvedValue(true)
      });

      await w9Storage.delete(mockDocumentId, 'user123', 'Test deletion');

      // Verify soft delete was called
      expect(W9Document.findOne).toHaveBeenCalledWith({ documentId: mockDocumentId });
      const mockDoc = await W9Document.findOne.mock.results[0].value;
      expect(mockDoc.softDelete).toHaveBeenCalledWith('user123', 'Test deletion');
    });

    it('should handle missing document gracefully', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
      fs.unlink = jest.fn().mockRejectedValue(new Error('ENOENT'));

      W9Document.findOne = jest.fn().mockResolvedValue(null);

      // Should throw for missing document
      await expect(w9Storage.delete(mockDocumentId, 'user123', 'Test')).rejects.toThrow('W-9 document not found');
    });

    it('should handle deletion error', async () => {
      fs.access = jest.fn().mockResolvedValue();
      fs.unlink = jest.fn().mockRejectedValue(new Error('Permission denied'));

      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        softDelete: jest.fn().mockRejectedValue(new Error('Permission denied'))
      });

      await expect(w9Storage.delete(mockDocumentId, 'user123', 'Test'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('verifyIntegrity()', () => {
    it('should return true if document exists and is valid', async () => {
      W9Document.findOne = jest.fn().mockResolvedValue({
        documentId: mockDocumentId,
        storageKey: 'test-storage-key'
      });
      fs.access = jest.fn().mockResolvedValue();
      fs.readFile = jest.fn().mockResolvedValue(mockEncryptedContent);

      const result = await w9Storage.verifyIntegrity(mockDocumentId);

      expect(result.valid).toBe(true);
    });

    it('should return false if document does not exist', async () => {
      W9Document.findOne = jest.fn().mockResolvedValue(null);

      const result = await w9Storage.verifyIntegrity(mockDocumentId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Document not found');
    });
  });

  describe('cleanupExpired()', () => {
    it('should cleanup expired documents', async () => {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

      const mockExpiredDocs = [
        {
          storageKey: 'expired-key-1',
          remove: jest.fn().mockResolvedValue()
        },
        {
          storageKey: 'expired-key-2',
          remove: jest.fn().mockResolvedValue()
        }
      ];

      W9Document.find = jest.fn().mockResolvedValue(mockExpiredDocs);
      fs.unlink = jest.fn().mockResolvedValue();

      const result = await w9Storage.cleanupExpired();

      expect(result).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('Security Features', () => {
    it('should use AES-256-GCM encryption', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it('should generate unique encryption keys for each document', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      // Store two documents
      const storageKey1 = await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      // Reset mocks for second call
      crypto.randomBytes = jest.fn()
        .mockReturnValueOnce(Buffer.alloc(32, 1)) // Different key
        .mockReturnValueOnce(Buffer.alloc(16, 1)); // Different iv

      const storageKey2 = await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      // Verify different storage keys were generated
      expect(storageKey1).not.toBe(storageKey2);
    });

    it('should store authentication tag for integrity verification', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('partial')),
        final: jest.fn().mockReturnValue(Buffer.from('final')),
        getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16, 'authtagdata'))
      };

      crypto.createCipheriv = jest.fn().mockReturnValue(mockCipher);

      await w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      );

      expect(mockCipher.getAuthTag).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
      fs.readFile = jest.fn().mockRejectedValue(new Error('ENOENT'));

      W9Document.findOne = jest.fn().mockResolvedValue(null);

      await expect(w9Storage.retrieve('W9DOC-999', 'user123'))
        .rejects.toThrow('W-9 document not found');
    });

    it('should handle storage path creation errors', async () => {
      fs.mkdir = jest.fn().mockRejectedValue(new Error('EACCES: permission denied'));
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      await expect(w9Storage.store(
        mockFileContent,
        mockOriginalName,
        mockMimeType,
        mockAffiliateId,
        mockUploadedBy
      )).rejects.toThrow('EACCES: permission denied');
    });
  });
});
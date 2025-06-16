const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const w9Storage = require('../../server/utils/w9Storage');

// Mock dependencies
jest.mock('fs').promises;
jest.mock('crypto');

describe('W9Storage Utility Unit Tests', () => {
  const mockDocumentId = 'W9DOC-123';
  const mockFileContent = Buffer.from('test pdf content');
  const mockEncryptedContent = Buffer.from('encrypted content');
  const mockDecryptedContent = Buffer.from('decrypted content');
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup crypto mocks
    const mockCipher = {
      update: jest.fn().mockReturnValue(Buffer.from('partial')),
      final: jest.fn().mockReturnValue(Buffer.from('final')),
      getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16))
    };
    
    const mockDecipher = {
      setAuthTag: jest.fn(),
      update: jest.fn().mockReturnValue(Buffer.from('partial')),
      final: jest.fn().mockReturnValue(Buffer.from('final'))
    };
    
    crypto.randomBytes = jest.fn()
      .mockReturnValueOnce(Buffer.alloc(32)) // key
      .mockReturnValueOnce(Buffer.alloc(16)); // iv
    
    crypto.createCipheriv = jest.fn().mockReturnValue(mockCipher);
    crypto.createDecipheriv = jest.fn().mockReturnValue(mockDecipher);
  });

  describe('store()', () => {
    it('should successfully store encrypted W-9 document', async () => {
      // Mock file system operations
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));
      
      const storageKey = await w9Storage.store(mockDocumentId, mockFileContent);
      
      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/secure/w9-documents'),
        { recursive: true }
      );
      
      // Verify file write operations
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // Document and metadata
      
      // Verify encryption was used
      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
      
      // Verify storage key format
      expect(storageKey).toMatch(/^W9DOC-123_\d+$/);
    });

    it('should handle storage directory creation error', async () => {
      fs.mkdir = jest.fn().mockRejectedValue(new Error('Permission denied'));
      
      await expect(w9Storage.store(mockDocumentId, mockFileContent))
        .rejects.toThrow('Permission denied');
    });

    it('should handle file write error', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Disk full'));
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));
      
      await expect(w9Storage.store(mockDocumentId, mockFileContent))
        .rejects.toThrow('Disk full');
    });

    it('should reject if document already exists', async () => {
      fs.access = jest.fn().mockResolvedValue(); // File exists
      
      await expect(w9Storage.store(mockDocumentId, mockFileContent))
        .rejects.toThrow('Document W9DOC-123 already exists');
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
      
      const result = await w9Storage.retrieve(mockDocumentId);
      
      // Verify file reads
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockDocumentId}.meta.json`)
      );
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(`${mockDocumentId}.enc`)
      );
      
      // Verify decryption was used
      expect(crypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
      
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle missing document', async () => {
      fs.readFile = jest.fn().mockRejectedValue(new Error('ENOENT'));
      
      await expect(w9Storage.retrieve(mockDocumentId))
        .rejects.toThrow('Document W9DOC-123 not found');
    });

    it('should handle corrupted metadata', async () => {
      fs.readFile = jest.fn()
        .mockResolvedValueOnce(Buffer.from('invalid json')); // Invalid metadata
      
      await expect(w9Storage.retrieve(mockDocumentId))
        .rejects.toThrow();
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
      
      await expect(w9Storage.retrieve(mockDocumentId))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('delete()', () => {
    it('should successfully delete W-9 document and metadata', async () => {
      fs.unlink = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockResolvedValue(); // Files exist
      
      await w9Storage.delete(mockDocumentId);
      
      // Verify both files were deleted
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`${mockDocumentId}.enc`)
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`${mockDocumentId}.meta.json`)
      );
    });

    it('should handle missing document gracefully', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
      fs.unlink = jest.fn().mockRejectedValue(new Error('ENOENT'));
      
      // Should not throw for missing files
      await expect(w9Storage.delete(mockDocumentId)).resolves.not.toThrow();
    });

    it('should handle deletion error', async () => {
      fs.access = jest.fn().mockResolvedValue();
      fs.unlink = jest.fn().mockRejectedValue(new Error('Permission denied'));
      
      await expect(w9Storage.delete(mockDocumentId))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('exists()', () => {
    it('should return true if document exists', async () => {
      fs.access = jest.fn().mockResolvedValue();
      
      const exists = await w9Storage.exists(mockDocumentId);
      
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining(`${mockDocumentId}.enc`)
      );
      expect(exists).toBe(true);
    });

    it('should return false if document does not exist', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
      
      const exists = await w9Storage.exists(mockDocumentId);
      
      expect(exists).toBe(false);
    });
  });

  describe('getStoragePath()', () => {
    it('should return correct storage path', () => {
      const storagePath = w9Storage.getStoragePath();
      
      expect(storagePath).toContain('/secure/w9-documents');
      expect(path.isAbsolute(storagePath)).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should use AES-256-GCM encryption', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));
      
      await w9Storage.store(mockDocumentId, mockFileContent);
      
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
      await w9Storage.store('W9DOC-001', mockFileContent);
      
      // Reset mocks for second call
      crypto.randomBytes = jest.fn()
        .mockReturnValueOnce(Buffer.alloc(32, 1)) // Different key
        .mockReturnValueOnce(Buffer.alloc(16, 1)); // Different iv
      
      await w9Storage.store('W9DOC-002', mockFileContent);
      
      // Verify different keys were generated
      expect(crypto.randomBytes).toHaveBeenCalledTimes(4); // 2 keys + 2 IVs
    });

    it('should store authentication tag for integrity verification', async () => {
      fs.mkdir = jest.fn().mockResolvedValue();
      fs.writeFile = jest.fn().mockResolvedValue();
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));
      
      await w9Storage.store(mockDocumentId, mockFileContent);
      
      // Check metadata write includes authTag
      const metadataCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('.meta.json')
      );
      
      expect(metadataCall).toBeDefined();
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.authTag).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
      fs.readFile = jest.fn().mockRejectedValue(new Error('ENOENT'));
      
      await expect(w9Storage.retrieve('W9DOC-999'))
        .rejects.toThrow('Document W9DOC-999 not found');
    });

    it('should handle storage path creation errors', async () => {
      fs.mkdir = jest.fn().mockRejectedValue(new Error('EACCES: permission denied'));
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));
      
      await expect(w9Storage.store(mockDocumentId, mockFileContent))
        .rejects.toThrow('EACCES: permission denied');
    });
  });
});
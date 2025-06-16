// W9Storage Utility for WaveMAX Laundry Affiliate Program
// Handles secure storage and retrieval of W-9 tax documents

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const W9Document = require('../models/W9Document');

class W9Storage {
  constructor() {
    // Base directory for W-9 storage (outside web root)
    this.baseDir = path.join(__dirname, '..', '..', 'secure', 'w9-documents');
    
    // Encryption settings
    this.algorithm = 'aes-256-gcm';
    this.keyDerivationSalt = process.env.W9_ENCRYPTION_SALT || 'w9-default-salt-change-in-production';
  }

  // Derive encryption key from environment variable
  _deriveKey() {
    const masterKey = process.env.W9_ENCRYPTION_KEY || 'default-key-change-in-production';
    return crypto.pbkdf2Sync(masterKey, this.keyDerivationSalt, 100000, 32, 'sha256');
  }

  // Encrypt file data
  _encrypt(buffer) {
    const key = this._deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    return Buffer.concat([iv, tag, encrypted]);
  }

  // Decrypt file data
  _decrypt(encryptedBuffer) {
    const key = this._deriveKey();
    
    // Extract components
    const iv = encryptedBuffer.slice(0, 16);
    const tag = encryptedBuffer.slice(16, 32);
    const encrypted = encryptedBuffer.slice(32);
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  // Generate unique storage key
  _generateStorageKey(affiliateId) {
    const timestamp = Date.now();
    const uuid = uuidv4();
    return `${affiliateId}_${timestamp}_${uuid}`;
  }

  // Get full file path
  _getFilePath(storageKey) {
    // Create subdirectory based on first 2 chars of storage key for better organization
    const subdir = storageKey.substring(0, 2);
    return path.join(this.baseDir, subdir, `${storageKey}.enc`);
  }

  // Ensure directory exists
  async _ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // Store W-9 document
  async store(fileBuffer, originalName, mimeType, affiliateId, uploadedBy, metadata = {}) {
    try {
      // Validate inputs
      if (!fileBuffer || !originalName || !affiliateId) {
        throw new Error('Missing required parameters for W-9 storage');
      }

      // Validate file type (PDF only)
      if (mimeType !== 'application/pdf') {
        throw new Error('Only PDF files are accepted for W-9 documents');
      }

      // Check file size (5MB limit)
      if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit');
      }

      // Generate storage key
      const storageKey = this._generateStorageKey(affiliateId);
      const filePath = this._getFilePath(storageKey);
      
      // Ensure directory exists
      await this._ensureDirectory(path.dirname(filePath));
      
      // Encrypt file
      const encryptedData = this._encrypt(fileBuffer);
      
      // Write encrypted file
      await fs.writeFile(filePath, encryptedData, { mode: 0o600 });
      
      // Create database record
      const w9Document = new W9Document({
        affiliateId,
        filename: `${storageKey}.enc`,
        originalName,
        mimeType,
        size: fileBuffer.length,
        storageKey,
        uploadedBy,
        metadata
      });
      
      await w9Document.save();
      
      // Log storage event
      console.log(`W-9 document stored for affiliate ${affiliateId}: ${w9Document.documentId}`);
      
      return {
        documentId: w9Document.documentId,
        storageKey,
        size: fileBuffer.length
      };
      
    } catch (error) {
      console.error('Error storing W-9 document:', error);
      throw error;
    }
  }

  // Retrieve W-9 document
  async retrieve(documentId, requesterId) {
    try {
      // Find document record
      const w9Document = await W9Document.findOne({ documentId });
      
      if (!w9Document) {
        throw new Error('W-9 document not found');
      }
      
      if (!w9Document.isActive) {
        throw new Error('W-9 document is no longer active');
      }
      
      // Get file path
      const filePath = this._getFilePath(w9Document.storageKey);
      
      // Read encrypted file
      const encryptedData = await fs.readFile(filePath);
      
      // Decrypt file
      const decryptedData = this._decrypt(encryptedData);
      
      // Log access
      console.log(`W-9 document ${documentId} accessed by ${requesterId}`);
      
      return {
        buffer: decryptedData,
        originalName: w9Document.originalName,
        mimeType: w9Document.mimeType,
        size: w9Document.size,
        affiliateId: w9Document.affiliateId
      };
      
    } catch (error) {
      console.error('Error retrieving W-9 document:', error);
      throw error;
    }
  }

  // Delete W-9 document (soft delete)
  async delete(documentId, deletedBy, reason) {
    try {
      // Find document
      const w9Document = await W9Document.findOne({ documentId });
      
      if (!w9Document) {
        throw new Error('W-9 document not found');
      }
      
      // Soft delete in database
      await w9Document.softDelete(deletedBy, reason);
      
      // Schedule physical deletion after retention period (7 years)
      // In production, this would be handled by a scheduled job
      
      console.log(`W-9 document ${documentId} marked for deletion by ${deletedBy}`);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting W-9 document:', error);
      throw error;
    }
  }

  // Verify storage integrity
  async verifyIntegrity(documentId) {
    try {
      const w9Document = await W9Document.findOne({ documentId });
      
      if (!w9Document) {
        return { valid: false, error: 'Document not found' };
      }
      
      const filePath = this._getFilePath(w9Document.storageKey);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return { valid: false, error: 'File not found on disk' };
      }
      
      // Try to decrypt (validates encryption integrity)
      try {
        const encryptedData = await fs.readFile(filePath);
        this._decrypt(encryptedData);
      } catch (error) {
        return { valid: false, error: 'File corruption or decryption failure' };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Clean up expired documents (for scheduled jobs)
  async cleanupExpired() {
    try {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
      
      // Find documents older than 7 years that are soft deleted
      const expiredDocs = await W9Document.find({
        deletedAt: { $lt: sevenYearsAgo },
        isActive: false
      });
      
      let cleaned = 0;
      
      for (const doc of expiredDocs) {
        try {
          const filePath = this._getFilePath(doc.storageKey);
          await fs.unlink(filePath);
          await doc.remove();
          cleaned++;
        } catch (error) {
          console.error(`Failed to clean up document ${doc.documentId}:`, error);
        }
      }
      
      console.log(`Cleaned up ${cleaned} expired W-9 documents`);
      return cleaned;
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new W9Storage();
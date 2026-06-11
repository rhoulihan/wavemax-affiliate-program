// Encrypted W-9 file store (spec §4.3; settled decision §13 #7).
//
// Bytes are AES-256-GCM encrypted and written as SELF-FRAMED files —
// [iv(16) | authTag(16) | ciphertext] — under W9_STORAGE_PATH
// (a DRBD-replicated, single-primary volume in production; a tmp dir in
// tests). storageKey layout: aff/<affiliateId>/<uuid>.enc. The env var is
// the ONLY storage detail outside this module — swapping DRBD for another
// replicated FS later touches nothing else.
//
// NOT GridFS and never the DB (Oracle ADB Mongo-API GridFS support is
// uncertain — spec §13 #7). File mode 0600, dirs 0700.

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { encryptBuffer, decryptBuffer } = require('../utils/encryption');
const logger = require('../utils/logger');

const FRAME_HEADER_BYTES = 32; // iv(16) + authTag(16)

function storageRoot() {
  const root = process.env.W9_STORAGE_PATH;
  if (!root) throw new Error('W9_STORAGE_PATH is not configured');
  return path.resolve(root);
}

/** Resolve a storageKey to an absolute path, refusing path traversal. */
function resolvePath(storageKey) {
  const root = storageRoot();
  const abs = path.resolve(root, storageKey);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return abs;
}

/**
 * Encrypt and persist a document buffer.
 * @param {Buffer} buffer plaintext bytes
 * @param {{affiliateId: string, contentType: string, filename: string}} meta
 * @returns {Promise<{storageKey: string, sha256: string}>}
 *   sha256 is the integrity hash of the PLAINTEXT bytes (stored on
 *   Affiliate.w9Document and re-checked on every read).
 */
async function storeEncrypted(buffer, { affiliateId, contentType, filename }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('storeEncrypted requires a non-empty Buffer');
  }
  if (!affiliateId) throw new Error('storeEncrypted requires an affiliateId');

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const { iv, authTag, data } = encryptBuffer(buffer);
  const framed = Buffer.concat([iv, authTag, data]);

  const storageKey = path.posix.join('aff', affiliateId, `${uuidv4()}.enc`);
  const abs = resolvePath(storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await fs.writeFile(abs, framed, { mode: 0o600 });

  logger.info('W-9 document stored encrypted', {
    storageKey, sizeBytes: buffer.length, contentType, filename
  });
  return { storageKey, sha256 };
}

/**
 * Read and decrypt a stored document. The GCM authTag is verified by
 * decryptBuffer (throws on tampering); when expectedSha256 is supplied the
 * plaintext hash is re-checked too.
 * @param {string} storageKey
 * @param {{expectedSha256?: string}} [opts]
 * @returns {Promise<Buffer>} plaintext bytes
 */
async function readDecrypted(storageKey, { expectedSha256 } = {}) {
  const abs = resolvePath(storageKey);
  const framed = await fs.readFile(abs);
  if (framed.length <= FRAME_HEADER_BYTES) {
    throw new Error('Stored W-9 file is malformed');
  }
  const iv = framed.subarray(0, 16);
  const authTag = framed.subarray(16, 32);
  const data = framed.subarray(32);
  const plaintext = decryptBuffer({ iv, authTag, data });
  if (expectedSha256) {
    const actual = crypto.createHash('sha256').update(plaintext).digest('hex');
    if (actual !== expectedSha256) {
      throw new Error('W-9 integrity check failed (sha256 mismatch)');
    }
  }
  return plaintext;
}

/**
 * Delete a stored document (re-upload cleanup — spec §6.2 "no orphan files").
 * @returns {Promise<boolean>} true if a file was removed, false if absent.
 */
async function deleteFile(storageKey) {
  const abs = resolvePath(storageKey);
  try {
    await fs.unlink(abs);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

module.exports = { storeEncrypted, readDecrypted, deleteFile };

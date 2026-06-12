// W-9 multipart upload middleware (spec §6.2).
//
// multer + memoryStorage: the bytes only ever live in process memory until
// secureFileStore encrypts them — nothing unencrypted touches disk.
// Single field 'w9'; pdf/jpeg/png ONLY (SVG is script-bearing — rejected);
// size cap from SystemConfig w9_max_upload_mb (built per-request because
// getValue is async). Non-multipart requests pass through untouched, so
// the invited-registration route still accepts plain JSON bodies.

const multer = require('multer');
const SystemConfig = require('../models/SystemConfig');
const logger = require('../utils/logger');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  const err = new Error('invalid_file_type');
  err.code = 'INVALID_FILE_TYPE';
  cb(err);
}

module.exports = function uploadW9(req, res, next) {
  SystemConfig.getValue('w9_max_upload_mb', 10)
    .then((maxMb) => {
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
        fileFilter
      }).single('w9');

      upload(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          logger.warn('W-9 upload rejected: too large', { maxMb, path: req.path });
          return res.status(400).json({
            success: false,
            code: 'W9_FILE_TOO_LARGE',
            message: `W-9 file exceeds the ${maxMb} MB limit`
          });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          logger.warn('W-9 upload rejected: disallowed type', { path: req.path });
          return res.status(400).json({
            success: false,
            code: 'W9_INVALID_FILE_TYPE',
            message: 'Only PDF, JPEG, or PNG files are accepted'
          });
        }
        next(err);
      });
    })
    .catch(next);
};

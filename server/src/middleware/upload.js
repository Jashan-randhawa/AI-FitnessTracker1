const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

// In-Memory Multipart Parsing (capped at 4 MB per Phase 1 spec).
// Images are streamed directly to memory buffer and base64-encoded for Gemini Vision inlineData,
// eliminating orphaned temporary files on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF, HEIC, or HEIF.'));
  },
});

module.exports = upload;

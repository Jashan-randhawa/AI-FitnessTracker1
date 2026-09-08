const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

// Memory storage — the image only needs to be base64-encoded and forwarded
// to OpenRouter, never written to disk (matches original 10MB cap from
// Strapi's formidable config in config/middlewares.ts).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF, HEIC, or HEIF.'));
  },
});

module.exports = upload;

const multer = require('multer');
const { MAX_IMAGE_BYTES } = require('../utils/imageValidation');

// In-Memory Multipart Parsing (capped at MAX_IMAGE_BYTES = 4 MB).
// Images are streamed directly to memory buffer and base64-encoded for Gemini Vision inlineData,
// eliminating orphaned temporary files on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, _file, cb) => {
    // Limits enforce hard size cap. aiValidation middleware validates binary magic bytes,
    // sending typed HTTP 415 JSON responses without uncaught exception crashes.
    cb(null, true);
  },
});

module.exports = upload;

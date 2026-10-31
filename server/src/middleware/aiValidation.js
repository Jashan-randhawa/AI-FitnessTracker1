const { z } = require('zod');
const sendError = require('../utils/sendError');
const {
  MAX_IMAGE_BYTES,
  ALLOWED_MIME_TYPES,
  validateImageBuffer,
  parseAndValidateBase64,
} = require('../utils/imageValidation');

/**
 * Zod schema for incoming AI chat conversations.
 * Enforces:
 * - messages array must not be empty
 * - max 2000 characters per single message
 * - max 10000 characters total across the prompt conversation
 */
const ChatMessageSchema = z.object({
  role: z.string().optional(),
  content: z.string().max(2000, 'Single message cannot exceed 2000 characters').optional(),
  text: z.string().max(2000, 'Single message cannot exceed 2000 characters').optional(),
  parts: z.array(z.any()).optional(),
});

const ChatPayloadSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, 'Messages array must not be empty'),
  userContext: z.record(z.any()).optional().nullable(),
  options: z.record(z.any()).optional().nullable(),
  environment: z.record(z.any()).optional().nullable(),
}).refine(
  (data) => {
    let totalChars = 0;
    for (const m of data.messages) {
      if (typeof m.content === 'string') totalChars += m.content.length;
      if (typeof m.text === 'string') totalChars += m.text.length;
    }
    return totalChars <= 10000;
  },
  {
    message: 'Total conversation payload cannot exceed 10000 characters',
    path: ['messages'],
  }
);

/**
 * Express middleware validating AI chat requests against ChatPayloadSchema.
 */
const validateChatPayload = (req, res, next) => {
  const result = ChatPayloadSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => i.message).join('; ');
    return res.status(400).json({
      error: 'Validation Error',
      message: errorMsg,
      issues: result.error.issues,
    });
  }
  next();
};

const ALLOWED_FOOD_SNAP_MIMES = ALLOWED_MIME_TYPES;
const MAX_FOOD_SNAP_BYTES = MAX_IMAGE_BYTES;

/**
 * Express middleware validating Food Snap image upload:
 * - Must be provided (via multipart req.file or base64 req.body.image)
 * - Max 4MB file size (enforces HTTP 413)
 * - Allowed MIME types: image/jpeg, image/png, image/webp (enforces HTTP 415)
 * - Verifies binary magic bytes on image buffer to reject spoofed files
 */
const validateFoodSnapUpload = (req, res, next) => {
  let buffer = null;
  let declaredMime = null;

  if (req.file) {
    if (req.file.size > MAX_FOOD_SNAP_BYTES) {
      return sendError(res, 413, 'Image size exceeds maximum allowed limit of 4MB.', {
        code: 'LIMIT_FILE_SIZE',
      });
    }

    if (req.file.buffer) {
      buffer = req.file.buffer;
      declaredMime = req.file.mimetype;
    } else if (req.file.mimetype && !ALLOWED_FOOD_SNAP_MIMES.has(req.file.mimetype)) {
      return sendError(res, 415, 'Allowed image types are image/jpeg, image/png, and image/webp.', {
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
  } else if (req.body && req.body.image && typeof req.body.image === 'string') {
    try {
      const parsed = parseAndValidateBase64(req.body.image);
      buffer = parsed.buffer;
      declaredMime = parsed.mimeType;
      req.file = {
        buffer,
        mimetype: declaredMime,
        size: buffer.length,
      };
    } catch (err) {
      const status = err.status || 400;
      return sendError(res, status, err.message, { code: err.code || 'INVALID_INPUT' });
    }
  }

  if (!req.file && !buffer) {
    return sendError(res, 400, 'Please provide an image file to analyze.', {
      code: 'FILE_MISSING',
    });
  }

  if (buffer) {
    try {
      const validated = validateImageBuffer(buffer, declaredMime);
      req.file.mimetype = validated.mimeType;
    } catch (err) {
      const status = err.status || 415;
      return sendError(res, status, err.message, { code: err.code || 'INVALID_FILE_TYPE' });
    }
  }

  next();
};

module.exports = {
  ChatPayloadSchema,
  validateChatPayload,
  validateFoodSnapUpload,
  ALLOWED_FOOD_SNAP_MIMES,
  MAX_FOOD_SNAP_BYTES,
};

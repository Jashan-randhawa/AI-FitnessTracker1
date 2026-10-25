const { z } = require('zod');

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

const ALLOWED_FOOD_SNAP_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FOOD_SNAP_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Express middleware validating Food Snap image upload:
 * - Must be provided
 * - Max 4MB file size
 * - Allowed MIME types: image/jpeg, image/png, image/webp
 */
const validateFoodSnapUpload = (req, res, next) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: 'File Missing',
      message: 'Please provide an image file to analyze.',
    });
  }

  if (file.size > MAX_FOOD_SNAP_BYTES) {
    return res.status(400).json({
      error: 'Payload Too Large',
      message: 'Image size exceeds maximum allowed limit of 4MB.',
    });
  }

  if (!ALLOWED_FOOD_SNAP_MIMES.has(file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid File Type',
      message: 'Allowed image types are image/jpeg, image/png, and image/webp.',
    });
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

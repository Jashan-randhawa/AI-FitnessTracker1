/**
 * Server-Side Image Validation Utility
 *
 * Enforces security boundaries for image uploads:
 * - 4 MB decoded byte limit (MAX_IMAGE_BYTES)
 * - Whitelist of MIME types (image/jpeg, image/png, image/webp)
 * - Sniffing magic bytes on binary buffers (rejects spoofed extensions, SVGs, GIFs, BMPs, PDFs, HEIC)
 * - Safe base64 pre-check before decoding huge buffers
 * - Pixel-count guard read from the image header (no decoding), so a client that
 *   bypasses the 1024px resize cannot push a 4 MB / 20000x20000 image to the AI provider
 */

const MAX_IMAGE_BYTES = parseInt(process.env.MAX_IMAGE_BYTES, 10) || 4 * 1024 * 1024; // 4 MB

// Keep in sync with DEFAULT_MAX_PIXELS in client/src/utils/imageResize.ts
const MAX_IMAGE_PIXELS = parseInt(process.env.MAX_IMAGE_PIXELS, 10) || 50_000_000; // 50 MP

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

class ImageValidationError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ImageValidationError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Sniffs the MIME type of a binary buffer from its magic bytes.
 * @param {Buffer} buffer
 * @returns {string} Detected MIME type or 'unknown'
 */
function sniffMimeType(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 2) {
    return 'unknown';
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6) {
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return 'image/gif';
    }
  }

  // PDF: %PDF
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }

  // BMP: BM
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'image/bmp';
  }

  // TIFF: II*\0 or MM\0*
  if (buffer.length >= 4) {
    const tiffHeader = buffer.toString('ascii', 0, 4);
    if (tiffHeader.startsWith('II*') || tiffHeader.startsWith('MM\x00*')) {
      return 'image/tiff';
    }
  }

  // HEIC / HEIF: ftyp box at bytes 4..7 with brand heic/heix/mif1/msf1
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'avif'].includes(brand)) {
      return 'image/heic';
    }
  }

  // SVG: <?xml or <svg
  const textPrefix = buffer.slice(0, 64).toString('utf8').trim().toLowerCase();
  if (textPrefix.startsWith('<svg') || textPrefix.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  return 'unknown';
}

/**
 * Reads pixel dimensions from the image header without decoding pixel data.
 * Returns null when the header cannot be parsed (the caller must not treat that
 * as an error for JPEG/WebP, since valid but unusual files exist).
 * @param {Buffer} buffer
 * @param {string} mime  sniffed MIME type
 * @returns {{ width: number, height: number } | null}
 */
function getImageDimensions(buffer, mime) {
  try {
    if (mime === 'image/png') {
      // 8-byte signature, then IHDR chunk: length(4) 'IHDR'(4) width(4) height(4)
      if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    if (mime === 'image/jpeg') {
      let pos = 2; // skip SOI
      while (pos + 9 < buffer.length) {
        if (buffer[pos] !== 0xff) return null;
        const marker = buffer[pos + 1];
        if (marker === 0xff) { pos += 1; continue; } // fill byte
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          pos += 2; // standalone markers carry no length
          continue;
        }
        if (marker === 0xd9 || marker === 0xda) return null; // EOI / SOS reached before any SOF
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) {
          return { height: buffer.readUInt16BE(pos + 5), width: buffer.readUInt16BE(pos + 7) };
        }
        pos += 2 + buffer.readUInt16BE(pos + 2);
      }
      return null;
    }

    if (mime === 'image/webp') {
      if (buffer.length < 30) return null;
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
      }
      if (chunk === 'VP8L' && buffer[20] === 0x2f) {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
    }
  } catch {
    // Out-of-range read on a malformed header: treat as unparseable
  }
  return null;
}

/**
 * Validates raw image buffer against limits and MIME rules.
 * @param {Buffer} buffer
 * @param {string} [declaredMime]
 * @returns {{ mimeType: string, size: number }}
 */
function validateImageBuffer(buffer, declaredMime) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ImageValidationError(400, 'EMPTY_FILE', 'The uploaded image file is empty or missing.');
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      413,
      'LIMIT_FILE_SIZE',
      `Image size (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed limit of 4MB.`
    );
  }

  const sniffed = sniffMimeType(buffer);

  if (sniffed === 'image/heic') {
    throw new ImageValidationError(
      415,
      'HEIC_NOT_SUPPORTED',
      "iPhone HEIC photos are not supported. Switch Camera format to Most Compatible or take the photo in-app."
    );
  }

  if (['image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff', 'application/pdf'].includes(sniffed)) {
    throw new ImageValidationError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `Unsupported image format (${sniffed}). Allowed types are image/jpeg, image/png, and image/webp.`
    );
  }

  if (!ALLOWED_MIME_TYPES.has(sniffed)) {
    throw new ImageValidationError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Allowed image types are image/jpeg, image/png, and image/webp.'
    );
  }

  // Integrity checks for truncated/corrupt files
  if (sniffed === 'image/jpeg') {
    if (buffer.length < 16) {
      throw new ImageValidationError(400, 'CORRUPT_IMAGE', 'JPEG file is truncated or corrupted.');
    }
    let hasEoi = false;
    for (let i = buffer.length - 1; i >= Math.max(1, buffer.length - 1024); i--) {
      if (buffer[i] === 0xD9 && buffer[i - 1] === 0xFF) {
        hasEoi = true;
        break;
      }
    }
    if (!hasEoi) {
      throw new ImageValidationError(400, 'CORRUPT_IMAGE', 'JPEG file is incomplete or truncated (missing EOI marker).');
    }
  }

  if (sniffed === 'image/png') {
    if (buffer.length < 32 || !buffer.includes('IEND')) {
      throw new ImageValidationError(400, 'CORRUPT_IMAGE', 'PNG file is truncated or corrupted (missing IEND chunk).');
    }
  }

  // Verify declared MIME matches sniffed magic bytes (reject spoofed files)
  if (declaredMime && ALLOWED_MIME_TYPES.has(declaredMime) && declaredMime !== sniffed) {
    throw new ImageValidationError(
      415,
      'MIME_MISMATCH',
      `File contents (${sniffed}) do not match declared Content-Type (${declaredMime}).`
    );
  }

  // Header-only dimension checks (no pixel decoding)
  const dims = getImageDimensions(buffer, sniffed);
  if (dims) {
    if (dims.width < 1 || dims.height < 1) {
      throw new ImageValidationError(400, 'CORRUPT_IMAGE', 'Image header reports zero width or height.');
    }
    if (dims.width * dims.height > MAX_IMAGE_PIXELS) {
      throw new ImageValidationError(
        400,
        'IMAGE_DIMENSIONS_TOO_LARGE',
        `Image resolution (${dims.width}x${dims.height}) is too large. Please use a photo under ${Math.round(MAX_IMAGE_PIXELS / 1_000_000)} megapixels.`
      );
    }
  } else if (sniffed === 'image/png') {
    throw new ImageValidationError(400, 'CORRUPT_IMAGE', 'PNG file is missing a valid IHDR header.');
  }

  return { mimeType: sniffed, size: buffer.length, width: dims?.width ?? null, height: dims?.height ?? null };
}

/**
 * Validates and decodes base64 string image input safely before memory allocation.
 * @param {string} rawBase64
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
function parseAndValidateBase64(rawBase64) {
  if (typeof rawBase64 !== 'string' || !rawBase64.trim()) {
    throw new ImageValidationError(400, 'INVALID_BASE64', 'Invalid or empty base64 image data.');
  }

  let clean = rawBase64.trim();
  let declaredMime = null;

  // Strip data:image/...;base64, prefix
  const match = clean.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
  if (match) {
    declaredMime = match[1];
    clean = match[2];
  }

  // Validate base64 characters
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new ImageValidationError(400, 'INVALID_BASE64', 'Invalid base64 encoding characters.');
  }

  // Pre-calculate decoded byte length BEFORE decoding to prevent huge memory allocations
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const approxBytes = Math.floor((clean.length * 3) / 4) - padding;

  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      413,
      'LIMIT_FILE_SIZE',
      `Image size exceeds maximum allowed limit of 4MB.`
    );
  }

  const buffer = Buffer.from(clean, 'base64');
  const validated = validateImageBuffer(buffer, declaredMime);

  return { buffer, mimeType: validated.mimeType };
}

module.exports = {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  ALLOWED_MIME_TYPES,
  ImageValidationError,
  sniffMimeType,
  getImageDimensions,
  validateImageBuffer,
  parseAndValidateBase64,
};

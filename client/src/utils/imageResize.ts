/**
 * Image Resize & Compression Utility
 *
 * Client-side pre-processing for Food Snap uploads.
 * Downscales images to maxEdge (default 1024px) keeping aspect ratio,
 * auto-rotates via EXIF, converts transparent PNG/WebP to white-background JPEG,
 * steps down quality if size exceeds soft targets, and guards against
 * decompression bombs and unsupported formats.
 */

export type ImageResizeErrorCode =
  | 'INVALID_FILE'
  | 'RAW_FILE_TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'HEIC_NOT_SUPPORTED'
  | 'MIME_MISMATCH'
  | 'DECODE_FAILED'
  | 'INVALID_DIMENSIONS'
  | 'RESOLUTION_TOO_HIGH'
  | 'CANVAS_UNAVAILABLE'
  | 'TO_BLOB_FAILED'
  | 'OUTPUT_TOO_LARGE';

export class ImageResizeError extends Error {
  readonly code: ImageResizeErrorCode;
  readonly friendlyMessage: string;

  constructor(code: ImageResizeErrorCode, friendlyMessage: string, details?: unknown) {
    super(friendlyMessage);
    this.name = 'ImageResizeError';
    this.code = code;
    this.friendlyMessage = friendlyMessage;
    if (details && typeof details === 'object' && 'stack' in (details as object)) {
      this.stack = (details as Error).stack;
    }
    Object.setPrototypeOf(this, ImageResizeError.prototype);
  }
}

export type SniffedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/bmp'
  | 'image/tiff'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'image/heic'
  | 'unknown';

export const ALLOWED_INPUT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const DEFAULT_MAX_EDGE = 1024;
export const DEFAULT_QUALITY = 0.82;
export const DEFAULT_OUTPUT_MIME = 'image/jpeg' as const;
export const DEFAULT_SOFT_TARGET_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const DEFAULT_HARD_CAP_BYTES = 4 * 1024 * 1024; // 4 MB server limit
export const DEFAULT_MAX_RAW_BYTES = 25 * 1024 * 1024; // 25 MB decompression bomb guard
export const DEFAULT_MAX_PIXELS = 50_000_000; // 50 MP resolution bomb guard
export const DEFAULT_SKIP_RE_ENCODE_BYTES = 500 * 1024; // 500 KB skip threshold

export interface PrepareImageOptions {
  maxEdge?: number;
  quality?: number;
  outputMime?: 'image/jpeg' | 'image/webp';
  softTargetBytes?: number;
  maxAllowedBytes?: number;
  maxRawBytes?: number;
  maxPixels?: number;
  skipThresholdBytes?: number;
  generateDataUrl?: boolean;
}

export interface PrepareImageResult {
  blob: Blob;
  dataUrl?: string;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
  mime: string;
}

/**
 * Sniffs the MIME type of a file by inspecting magic bytes in the first 32 bytes.
 */
export function sniffMimeTypeFromBytes(bytes: Uint8Array): SniffedMimeType {
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 // '%PDF'
  ) {
    return 'application/pdf';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) { // 'BM'
    return 'image/bmp';
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
      (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A))
  ) {
    return 'image/tiff';
  }
  // HEIC/HEIF: offset 4..7 is 'ftyp'
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1', 'avif'].includes(brand)) {
      return 'image/heic';
    }
  }

  // Quick ASCII sniff for SVG
  const asciiHeader = String.fromCharCode(...bytes.slice(0, 16)).trim().toLowerCase();
  if (asciiHeader.startsWith('<svg') || asciiHeader.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  return 'unknown';
}

/**
 * Pure calculation for aspect-ratio preserving dimensions capped at maxEdge.
 * Never upscales. Rounds dimensions to integers with minimum 1px.
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxEdge: number = DEFAULT_MAX_EDGE
): { width: number; height: number } {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new ImageResizeError('INVALID_DIMENSIONS', 'Image has invalid or zero dimensions.');
  }

  if (width <= maxEdge && height <= maxEdge) {
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  if (width >= height) {
    const targetWidth = maxEdge;
    const targetHeight = Math.max(1, Math.round((height * maxEdge) / width));
    return { width: targetWidth, height: targetHeight };
  } else {
    const targetHeight = maxEdge;
    const targetWidth = Math.max(1, Math.round((width * maxEdge) / height));
    return { width: targetWidth, height: targetHeight };
  }
}

/**
 * Validates the file headers, declared MIME, raw size, and magic bytes.
 */
export async function validateImageFile(
  file: File,
  maxRawBytes: number = DEFAULT_MAX_RAW_BYTES
): Promise<SniffedMimeType> {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    throw new ImageResizeError('INVALID_FILE', 'Please select a valid, non-empty image file.');
  }

  if (file.size > maxRawBytes) {
    throw new ImageResizeError(
      'RAW_FILE_TOO_LARGE',
      `File size exceeds ${Math.round(maxRawBytes / (1024 * 1024))}MB limit. Please choose a smaller photo.`
    );
  }

  // Detect HEIC from type, extension, or content
  const declaredType = file.type ? file.type.toLowerCase().trim() : '';
  const isHeicExtension = /\.(heic|heif)$/i.test(file.name);
  if (declaredType === 'image/heic' || declaredType === 'image/heif' || isHeicExtension) {
    throw new ImageResizeError(
      'HEIC_NOT_SUPPORTED',
      "iPhone HEIC photos aren't supported here; switch Camera format to Most Compatible or take the photo in-app"
    );
  }

  // Sniff magic bytes
  const headerSlice = file.slice(0, 32);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const sniffedType = sniffMimeTypeFromBytes(bytes);

  if (sniffedType === 'image/heic') {
    throw new ImageResizeError(
      'HEIC_NOT_SUPPORTED',
      "iPhone HEIC photos aren't supported here; switch Camera format to Most Compatible or take the photo in-app"
    );
  }

  if (
    sniffedType === 'image/gif' ||
    sniffedType === 'image/svg+xml' ||
    sniffedType === 'image/bmp' ||
    sniffedType === 'image/tiff' ||
    sniffedType === 'application/pdf'
  ) {
    throw new ImageResizeError(
      'UNSUPPORTED_TYPE',
      `Unsupported file type (${sniffedType}). Allowed formats are JPEG, PNG, and WebP.`
    );
  }

  if (!ALLOWED_INPUT_MIMES.has(sniffedType)) {
    throw new ImageResizeError(
      'UNSUPPORTED_TYPE',
      'Unsupported or unrecognized image format. Please upload a JPEG, PNG, or WebP photo.'
    );
  }

  // If MIME was declared by browser/input, verify it does not conflict with sniffed type
  if (declaredType && ALLOWED_INPUT_MIMES.has(declaredType) && declaredType !== sniffedType) {
    throw new ImageResizeError(
      'MIME_MISMATCH',
      `File content (${sniffedType}) does not match declared type (${declaredType}).`
    );
  }

  if (declaredType && !ALLOWED_INPUT_MIMES.has(declaredType)) {
    throw new ImageResizeError(
      'UNSUPPORTED_TYPE',
      `Unsupported declared file type (${declaredType}). Allowed formats are JPEG, PNG, and WebP.`
    );
  }

  return sniffedType;
}

interface DecodedSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Decodes the image using createImageBitmap (with EXIF auto-rotation) or HTMLImageElement fallback.
 */
async function decodeImage(file: File): Promise<DecodedSource> {
  // 1. Prefer createImageBitmap with imageOrientation: 'from-image'
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {
            // Already closed
          }
        },
      };
    } catch {
      // Retry without options object (older browsers)
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            try {
              bitmap.close();
            } catch {
              // Already closed
            }
          },
        };
      } catch {
        // Fall back to HTMLImageElement
      }
    }
  }

  // 2. Fall back to HTMLImageElement + object URL
  if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return new Promise((resolve, reject) => {
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (err) {
        return reject(new ImageResizeError('DECODE_FAILED', 'Could not allocate preview URL for image.', err));
      }

      const img = new Image();
      let cleanedUp = false;
      const cleanup = () => {
        if (!cleanedUp) {
          cleanedUp = true;
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            // Ignore
          }
        }
      };

      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          cleanup();
          return reject(new ImageResizeError('DECODE_FAILED', 'Image loaded with zero dimensions.'));
        }
        resolve({
          source: img,
          width,
          height,
          cleanup,
        });
      };

      img.onerror = (err) => {
        cleanup();
        reject(
          new ImageResizeError(
            'DECODE_FAILED',
            'Failed to decode image data. The file may be corrupt or incomplete.',
            err
          )
        );
      };

      img.src = objectUrl;
    });
  }

  throw new ImageResizeError('DECODE_FAILED', 'No browser image decoding API is available.');
}

/**
 * Creates a canvas rendering context (OffscreenCanvas preferred).
 */
function createRenderingCanvas(width: number, height: number): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        return { canvas, ctx: ctx as OffscreenCanvasRenderingContext2D };
      }
    } catch {
      // Fallback to DOM canvas
    }
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      return { canvas, ctx };
    }
  }

  throw new ImageResizeError('CANVAS_UNAVAILABLE', 'Canvas 2D rendering context is not available.');
}

/**
 * Converts canvas to Blob across OffscreenCanvas and HTMLCanvasElement.
 */
async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: mime, quality });
    if (!blob) {
      throw new ImageResizeError('TO_BLOB_FAILED', 'Failed to convert offscreen canvas to image blob.');
    }
    return blob;
  }

  if ('toBlob' in canvas && typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new ImageResizeError('TO_BLOB_FAILED', 'Failed to convert canvas to image blob.'));
          } else {
            resolve(blob);
          }
        },
        mime,
        quality
      );
    });
  }

  throw new ImageResizeError('CANVAS_UNAVAILABLE', 'Blob export is not supported by current canvas.');
}

/**
 * Converts a Blob to a base64 Data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageResizeError('DECODE_FAILED', 'Failed reading blob as Data URL.', reader.error));
    reader.readAsDataURL(blob);
  });
}

/**
 * Prepares an image for Food Snap upload:
 * 1. Validates magic bytes, mime, and file size.
 * 2. Decodes via createImageBitmap (EXIF auto-orientation) or HTMLImageElement.
 * 3. Enforces decompression bomb resolution limits.
 * 4. Checks skip-reencoding condition (<= 1024, < 500KB, JPEG/WebP).
 * 5. Draws to canvas with high smoothing and white background for JPEG.
 * 6. Steps down quality if output exceeds soft target (1.5 MB).
 * 7. Enforces 4 MB hard cap and preserves original if re-encoding was larger.
 */
export async function prepareImageForUpload(
  file: File,
  opts: PrepareImageOptions = {}
): Promise<PrepareImageResult> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const initialQuality = opts.quality ?? DEFAULT_QUALITY;
  const outputMime = opts.outputMime ?? DEFAULT_OUTPUT_MIME;
  const softTargetBytes = opts.softTargetBytes ?? DEFAULT_SOFT_TARGET_BYTES;
  const maxAllowedBytes = opts.maxAllowedBytes ?? DEFAULT_HARD_CAP_BYTES;
  const maxRawBytes = opts.maxRawBytes ?? DEFAULT_MAX_RAW_BYTES;
  const maxPixels = opts.maxPixels ?? DEFAULT_MAX_PIXELS;
  const skipThresholdBytes = opts.skipThresholdBytes ?? DEFAULT_SKIP_RE_ENCODE_BYTES;

  // 1. Validate file headers and magic bytes
  const sniffedMime = await validateImageFile(file, maxRawBytes);

  // 2. Decode image
  const decoded = await decodeImage(file);

  try {
    const originalWidth = decoded.width;
    const originalHeight = decoded.height;

    // 3. Decompression bomb resolution check
    if (originalWidth * originalHeight > maxPixels) {
      throw new ImageResizeError(
        'RESOLUTION_TOO_HIGH',
        `Image resolution is too high (>50MP, ${Math.round((originalWidth * originalHeight) / 1_000_000)}MP). Please select a standard photo.`
      );
    }

    // 4. Skip re-encoding rule: already within dimensions & under ~500KB & is JPEG/WebP
    const isAlreadyCompatibleFormat = sniffedMime === 'image/jpeg' || sniffedMime === 'image/webp';
    if (
      originalWidth <= maxEdge &&
      originalHeight <= maxEdge &&
      file.size < skipThresholdBytes &&
      isAlreadyCompatibleFormat
    ) {
      let dataUrl: string | undefined;
      if (opts.generateDataUrl) {
        dataUrl = await blobToDataUrl(file);
      }
      return {
        blob: file,
        dataUrl,
        width: originalWidth,
        height: originalHeight,
        originalBytes: file.size,
        outputBytes: file.size,
        mime: sniffedMime,
      };
    }

    // Calculate target aspect-ratio preserving dimensions
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      originalWidth,
      originalHeight,
      maxEdge
    );

    // 5. Draw to canvas
    const { canvas, ctx } = createRenderingCanvas(targetWidth, targetHeight);
    ctx.imageSmoothingQuality = 'high';

    // White background for JPEG so transparency turns white rather than black
    if (outputMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    // 6. Quality step-down loop (0.82 -> 0.72 -> 0.62 -> 0.52 floor)
    let currentQuality = initialQuality;
    const minQuality = 0.52;
    const qualityStep = 0.10;

    let outputBlob = await canvasToBlob(canvas, outputMime, currentQuality);

    while (outputBlob.size > softTargetBytes && currentQuality - qualityStep >= minQuality - 0.001) {
      currentQuality = Math.max(minQuality, Math.round((currentQuality - qualityStep) * 100) / 100);
      outputBlob = await canvasToBlob(canvas, outputMime, currentQuality);
    }

    // 7. Enforce hard 4 MB cap
    if (outputBlob.size > maxAllowedBytes) {
      throw new ImageResizeError(
        'OUTPUT_TOO_LARGE',
        'Image could not be compressed below the 4MB server limit. Please select a smaller photo.'
      );
    }

    // If compressed result is larger than original AND original was already valid and under cap, prefer original
    let finalBlob: Blob = outputBlob;
    let finalMime: string = outputMime;
    if (
      outputBlob.size > file.size &&
      file.size <= maxAllowedBytes &&
      originalWidth <= maxEdge &&
      originalHeight <= maxEdge &&
      isAlreadyCompatibleFormat
    ) {
      finalBlob = file;
      finalMime = sniffedMime;
    }

    let dataUrl: string | undefined;
    if (opts.generateDataUrl) {
      dataUrl = await blobToDataUrl(finalBlob);
    }

    return {
      blob: finalBlob,
      dataUrl,
      width: targetWidth,
      height: targetHeight,
      originalBytes: file.size,
      outputBytes: finalBlob.size,
      mime: finalMime,
    };
  } finally {
    decoded.cleanup();
  }
}

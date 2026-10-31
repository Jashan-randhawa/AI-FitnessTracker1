import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTargetDimensions,
  sniffMimeTypeFromBytes,
  getImageDimensions,
  hasExifOrMetadata,
  validateImageFile,
  prepareImageForUpload,
  ImageResizeError,
} from '../utils/imageResize';

// Helper to create test File with specific magic bytes
function createMockFile(
  bytes: number[],
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  paddingLength: number = 64
): File {
  const arr = new Uint8Array(Math.max(bytes.length, paddingLength));
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes[i];
  }
  return new File([arr], name, { type });
}

describe('imageResize utility', () => {
  describe('calculateTargetDimensions (pure math)', () => {
    it('scales down landscape dimensions to max 1024 preserving aspect ratio', () => {
      const res = calculateTargetDimensions(2048, 1536, 1024);
      expect(res).toEqual({ width: 1024, height: 768 });
    });

    it('scales down portrait dimensions to max 1024 preserving aspect ratio', () => {
      const res = calculateTargetDimensions(1536, 2048, 1024);
      expect(res).toEqual({ width: 768, height: 1024 });
    });

    it('scales down square dimensions to max 1024', () => {
      const res = calculateTargetDimensions(4000, 4000, 1024);
      expect(res).toEqual({ width: 1024, height: 1024 });
    });

    it('does not upscale small images', () => {
      const res = calculateTargetDimensions(800, 600, 1024);
      expect(res).toEqual({ width: 800, height: 600 });

      const tiny = calculateTargetDimensions(320, 240, 1024);
      expect(tiny).toEqual({ width: 320, height: 240 });
    });

    it('rounds dimensions to whole integers with minimum 1px', () => {
      const res = calculateTargetDimensions(2048, 1, 1024);
      expect(res.width).toBe(1024);
      expect(res.height).toBe(1);
    });

    it('throws ImageResizeError for invalid or zero dimensions', () => {
      expect(() => calculateTargetDimensions(0, 500, 1024)).toThrow(ImageResizeError);
      expect(() => calculateTargetDimensions(-100, 500, 1024)).toThrow(ImageResizeError);
      expect(() => calculateTargetDimensions(NaN, 500, 1024)).toThrow(ImageResizeError);
    });
  });

  describe('sniffMimeTypeFromBytes', () => {
    it('detects JPEG magic bytes FF D8 FF', () => {
      const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/jpeg');
    });

    it('detects PNG magic bytes 89 50 4E 47 0D 0A 1A 0A', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/png');
    });

    it('detects WebP magic bytes RIFF....WEBP', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // 'WEBP'
      ]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/webp');
    });

    it('detects GIF magic bytes GIF87a and GIF89a', () => {
      const bytes87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      const bytes89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(sniffMimeTypeFromBytes(bytes87)).toBe('image/gif');
      expect(sniffMimeTypeFromBytes(bytes89)).toBe('image/gif');
    });

    it('detects PDF magic bytes %PDF', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('application/pdf');
    });

    it('detects BMP magic bytes BM', () => {
      const bytes = new Uint8Array([0x42, 0x4D]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/bmp');
    });

    it('detects HEIC/HEIF ftyp boxes', () => {
      const bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x18,
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x68, 0x65, 0x69, 0x63, // 'heic'
      ]);
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/heic');
    });

    it('detects SVG XML headers', () => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(sniffMimeTypeFromBytes(bytes)).toBe('image/svg+xml');
    });
  });

  describe('validateImageFile', () => {
    it('accepts valid JPEG file', async () => {
      const file = createMockFile([0xFF, 0xD8, 0xFF], 'photo.jpg', 'image/jpeg');
      const mime = await validateImageFile(file);
      expect(mime).toBe('image/jpeg');
    });

    it('accepts valid PNG file', async () => {
      const file = createMockFile([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'photo.png', 'image/png');
      const mime = await validateImageFile(file);
      expect(mime).toBe('image/png');
    });

    it('accepts valid WebP file', async () => {
      const file = createMockFile(
        [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
        'photo.webp',
        'image/webp'
      );
      const mime = await validateImageFile(file);
      expect(mime).toBe('image/webp');
    });

    it('rejects HEIC by declared MIME, extension, or magic bytes with iPhone-specific message', async () => {
      const file1 = createMockFile([0, 0, 0, 0], 'photo.heic', 'image/heic');
      await expect(validateImageFile(file1)).rejects.toMatchObject({
        code: 'HEIC_NOT_SUPPORTED',
        friendlyMessage: expect.stringContaining("iPhone HEIC photos aren't supported here"),
      });

      const file2 = createMockFile(
        [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
        'photo.jpg',
        'image/jpeg'
      );
      await expect(validateImageFile(file2)).rejects.toMatchObject({
        code: 'HEIC_NOT_SUPPORTED',
      });
    });

    it('rejects unsupported types like GIF, SVG, BMP, PDF', async () => {
      const gif = createMockFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'anim.gif', 'image/gif');
      await expect(validateImageFile(gif)).rejects.toMatchObject({
        code: 'UNSUPPORTED_TYPE',
      });

      const pdf = createMockFile([0x25, 0x50, 0x44, 0x46], 'doc.pdf', 'application/pdf');
      await expect(validateImageFile(pdf)).rejects.toMatchObject({
        code: 'UNSUPPORTED_TYPE',
      });
    });

    it('rejects magic-byte / MIME mismatch', async () => {
      // Declared image/jpeg but contents are PNG
      const mismatch = createMockFile(
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        'fake.jpg',
        'image/jpeg'
      );
      await expect(validateImageFile(mismatch)).rejects.toMatchObject({
        code: 'MIME_MISMATCH',
      });
    });

    it('rejects raw files exceeding 25MB before decoding', async () => {
      const bigFile = {
        size: 26 * 1024 * 1024,
        name: 'huge.jpg',
        type: 'image/jpeg',
        slice: () => new Blob([new Uint8Array([0xFF, 0xD8, 0xFF])]),
      } as unknown as File;

      await expect(validateImageFile(bigFile)).rejects.toMatchObject({
        code: 'RAW_FILE_TOO_LARGE',
      });
    });
  });

  describe('prepareImageForUpload (flow, canvas, and mock decoding)', () => {
    let originalCreateImageBitmap: typeof window.createImageBitmap;
    let originalCreateElement: typeof document.createElement;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    let revokedUrls: string[];

    beforeEach(() => {
      revokedUrls = [];
      originalCreateImageBitmap = window.createImageBitmap;
      originalCreateElement = document.createElement.bind(document);
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn((_blob: Blob) => {
        const url = `blob:test-${Math.random()}`;
        return url;
      });

      URL.revokeObjectURL = vi.fn((url: string) => {
        revokedUrls.push(url);
      });
    });

    afterEach(() => {
      window.createImageBitmap = originalCreateImageBitmap;
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it('skips re-encoding if image is already <= 1024px AND < 500KB AND is JPEG', async () => {
      const closeSpy = vi.fn();
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 800,
        height: 600,
        close: closeSpy,
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'small.jpg', 'image/jpeg', 100 * 1024); // 100 KB
      const res = await prepareImageForUpload(file);

      expect(res.blob).toBe(file); // Returns original file without canvas re-encode
      expect(res.width).toBe(800);
      expect(res.height).toBe(600);
      expect(res.mime).toBe('image/jpeg');
      expect(closeSpy).toHaveBeenCalled();
    });

    it('scales oversize dimensions to max 1024 keeping aspect ratio and closes bitmap', async () => {
      const closeSpy = vi.fn();
      window.createImageBitmap = vi.fn().mockImplementation((_file, opts) => {
        expect(opts).toEqual({ imageOrientation: 'from-image' });
        return Promise.resolve({
          width: 2048,
          height: 1536,
          close: closeSpy,
        });
      });

      let fillStyleApplied = '';
      let fillRectArgs: number[] = [];
      let drawImageArgs: unknown[] = [];

      const mockCtx = {
        imageSmoothingQuality: 'low',
        set fillStyle(val: string) { fillStyleApplied = val; },
        get fillStyle() { return fillStyleApplied; },
        fillRect: vi.fn((x, y, w, h) => { fillRectArgs = [x, y, w, h]; }),
        drawImage: vi.fn((...args: unknown[]) => { drawImageArgs = args; }),
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime: string) => {
          cb(new Blob(['compressed-jpeg'], { type: mime }));
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'big.jpg', 'image/jpeg', 2 * 1024 * 1024);
      const res = await prepareImageForUpload(file);

      expect(res.width).toBe(1024);
      expect(res.height).toBe(768);
      expect(closeSpy).toHaveBeenCalled();
      expect(mockCtx.imageSmoothingQuality).toBe('high');
      // For JPEG, white fill background applied first
      expect(fillStyleApplied).toBe('#FFFFFF');
      expect(fillRectArgs).toEqual([0, 0, 1024, 768]);
      expect(drawImageArgs[1]).toBe(0);
      expect(drawImageArgs[2]).toBe(0);
      expect(drawImageArgs[3]).toBe(1024);
      expect(drawImageArgs[4]).toBe(768);
    });

    it('fills white canvas background for transparent PNG converted to JPEG', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 1200,
        height: 1200,
        close: vi.fn(),
      });

      let whiteFilled = false;
      const mockCtx = {
        imageSmoothingQuality: 'low',
        fillStyle: '',
        fillRect: vi.fn((_x, _y, _w, _h) => {
          if (mockCtx.fillStyle === '#FFFFFF') whiteFilled = true;
        }),
        drawImage: vi.fn(),
      };

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
          cb(new Blob(['png-to-jpeg'], { type: 'image/jpeg' }));
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const pngFile = createMockFile(
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        'transparent.png',
        'image/png',
        600 * 1024
      );

      const res = await prepareImageForUpload(pngFile, { outputMime: 'image/jpeg' });
      expect(whiteFilled).toBe(true);
      expect(res.mime).toBe('image/jpeg');
    });

    it('rejects decompression bomb with pixel count > 50 MP', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 10000,
        height: 6000, // 60 MP > 50 MP
        close: vi.fn(),
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'huge-res.jpg', 'image/jpeg');
      await expect(prepareImageForUpload(file)).rejects.toMatchObject({
        code: 'RESOLUTION_TOO_HIGH',
        friendlyMessage: expect.stringContaining('>50MP'),
      });
    });

    it('steps down quality loop if output size exceeds soft target', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 2000,
        height: 1500,
        close: vi.fn(),
      });

      const qualitiesCalled: number[] = [];
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingQuality: 'low',
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime: string, q: number) => {
          qualitiesCalled.push(q);
          // First two qualities are > soft target (1.5 MB), 3rd is under
          const size = q > 0.7 ? 1.8 * 1024 * 1024 : 1.2 * 1024 * 1024;
          const fakeBlob = new Blob([new Uint8Array(Math.floor(size))], { type: mime });
          cb(fakeBlob);
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'food.jpg', 'image/jpeg', 3 * 1024 * 1024);
      const res = await prepareImageForUpload(file);

      // Should have stepped down from 0.82 -> 0.72 -> 0.62
      expect(qualitiesCalled.length).toBeGreaterThanOrEqual(2);
      expect(res.outputBytes).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    });

    it('throws OUTPUT_TOO_LARGE if compressed image exceeds 4 MB hard cap', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 2000,
        height: 1500,
        close: vi.fn(),
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingQuality: 'low',
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime: string) => {
          // Always 5 MB (over 4 MB)
          cb(new Blob([new Uint8Array(5 * 1024 * 1024)], { type: mime }));
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'stubborn.jpg', 'image/jpeg');
      await expect(prepareImageForUpload(file)).rejects.toMatchObject({
        code: 'OUTPUT_TOO_LARGE',
        friendlyMessage: expect.stringContaining('4MB'),
      });
    });

    it('falls back to HTMLImageElement when createImageBitmap throws, revoking object URL', async () => {
      // @ts-expect-error force undefined
      window.createImageBitmap = undefined;

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'fallback.jpg', 'image/jpeg', 100 * 1024);

      // Trigger HTMLImageElement onload
      const originalImage = window.Image;

      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 640;
        naturalHeight = 480;
        _src = '';
        set src(val: string) {
          this._src = val;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
        get src() {
          return this._src;
        }
      }

      // @ts-expect-error mock window.Image
      window.Image = MockImage;

      try {
        const res = await prepareImageForUpload(file);
        expect(res.width).toBe(640);
        expect(res.height).toBe(480);
        expect(revokedUrls.length).toBeGreaterThan(0);
      } finally {
        window.Image = originalImage;
      }
    });

    it('handles decode failure when HTMLImageElement errors, revoking object URL', async () => {
      // @ts-expect-error force undefined
      window.createImageBitmap = undefined;

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'corrupt.jpg', 'image/jpeg');

      const originalImage = window.Image;
      class MockCorruptImage {
        onload: (() => void) | null = null;
        onerror: ((err?: unknown) => void) | null = null;
        set src(_val: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Corrupt image data'));
          }, 0);
        }
      }

      // @ts-expect-error mock window.Image
      window.Image = MockCorruptImage;

      try {
        await expect(prepareImageForUpload(file)).rejects.toMatchObject({
          code: 'DECODE_FAILED',
        });
        expect(revokedUrls.length).toBeGreaterThan(0);
      } finally {
        window.Image = originalImage;
      }
    });

    it('throws CANVAS_UNAVAILABLE when canvas context is null', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 1500,
        height: 1200,
        close: vi.fn(),
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'pic.jpg', 'image/jpeg', 600 * 1024);
      await expect(prepareImageForUpload(file)).rejects.toMatchObject({
        code: 'CANVAS_UNAVAILABLE',
      });
    });

    it('throws TO_BLOB_FAILED when toBlob returns null', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 1500,
        height: 1200,
        close: vi.fn(),
      });

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingQuality: 'low',
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
          cb(null); // Failure
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'pic.jpg', 'image/jpeg', 600 * 1024);
      await expect(prepareImageForUpload(file)).rejects.toMatchObject({
        code: 'TO_BLOB_FAILED',
      });
    });

    it('forces re-encoding even for small images if EXIF APP1 metadata is present', async () => {
      // JPEG with SOI + APP1 marker (indicating EXIF/GPS)
      const exifBytes = [
        0xFF, 0xD8, // SOI
        0xFF, 0xE1, 0x00, 0x0A, // APP1 length 10
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
      ];
      const file = createMockFile(exifBytes, 'with-exif.jpg', 'image/jpeg', 100 * 1024);

      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 800,
        height: 600,
        close: vi.fn(),
      });

      let drawImageCalled = false;
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingQuality: 'low',
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(() => {
            drawImageCalled = true;
          }),
        }),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime: string) => {
          cb(new Blob(['re-encoded-clean-jpeg'], { type: mime }));
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const res = await prepareImageForUpload(file);
      // Because APP1 is present, it must NOT skip re-encode (must draw to canvas and produce clean blob)
      expect(drawImageCalled).toBe(true);
      expect(res.blob).not.toBe(file);
    });

    it('falls back to JPEG when requested WebP output is unsupported by canvas', async () => {
      window.createImageBitmap = vi.fn().mockResolvedValue({
        width: 1200,
        height: 800,
        close: vi.fn(),
      });

      const toBlobCalls: string[] = [];
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingQuality: 'low',
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((cb: (blob: Blob | null) => void, mime: string) => {
          toBlobCalls.push(mime);
          if (mime === 'image/webp') {
            // Browser canvas lacks WebP encoder and falls back to PNG per spec
            cb(new Blob(['fallback-png'], { type: 'image/png' }));
          } else {
            cb(new Blob(['clean-jpeg'], { type: 'image/jpeg' }));
          }
        }),
      };

      document.createElement = vi.fn((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return originalCreateElement(tag);
      });

      const file = createMockFile([0xFF, 0xD8, 0xFF], 'photo.jpg', 'image/jpeg', 200 * 1024);
      const res = await prepareImageForUpload(file, { outputMime: 'image/webp' });

      // Verifies it detected PNG fallback and re-encoded to JPEG
      expect(toBlobCalls).toContain('image/webp');
      expect(toBlobCalls).toContain('image/jpeg');
      expect(res.mime).toBe('image/jpeg');
      expect(res.blob.type).toBe('image/jpeg');
    });
  });

  describe('getImageDimensions and hasExifOrMetadata', () => {
    it('parses dimensions from PNG IHDR', () => {
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x03, 0x20, // width 800
        0x00, 0x00, 0x02, 0x58, // height 600
        0x08, 0x06, 0x00, 0x00, 0x00,
      ]);
      const dims = getImageDimensions(pngHeader, 'image/png');
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it('parses dimensions from JPEG SOF0', () => {
      const jpegHeader = new Uint8Array([
        0xFF, 0xD8, // SOI
        0xFF, 0xC0, 0x00, 0x0B, // SOF0
        0x08,
        0x03, 0x00, // height 768
        0x04, 0x00, // width 1024
        0x01, 0x01, 0x11, 0x00,
      ]);
      const dims = getImageDimensions(jpegHeader, 'image/jpeg');
      expect(dims).toEqual({ width: 1024, height: 768 });
    });

    it('detects EXIF APP1 metadata in JPEG', () => {
      const withApp1 = new Uint8Array([
        0xFF, 0xD8,
        0xFF, 0xE1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66,
      ]);
      expect(hasExifOrMetadata(withApp1, 'image/jpeg')).toBe(true);

      const withoutApp1 = new Uint8Array([
        0xFF, 0xD8,
        0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
      ]);
      expect(hasExifOrMetadata(withoutApp1, 'image/jpeg')).toBe(false);
    });

    it('rejects decompression bomb in validateImageFile before decoding', async () => {
      // JPEG header reporting 10000 x 6000 = 60 MP (> 50 MP)
      const bombBytes = [
        0xFF, 0xD8,
        0xFF, 0xC0, 0x00, 0x0B,
        0x08,
        0x17, 0x70, // height 6000
        0x27, 0x10, // width 10000
        0x01, 0x01, 0x11, 0x00,
      ];
      const file = createMockFile(bombBytes, 'bomb.jpg', 'image/jpeg', 200 * 1024);

      await expect(validateImageFile(file)).rejects.toMatchObject({
        code: 'RESOLUTION_TOO_HIGH',
        friendlyMessage: expect.stringContaining('>50MP'),
      });
    });
  });
});

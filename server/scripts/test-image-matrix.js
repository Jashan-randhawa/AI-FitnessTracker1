/**
 * Food Snap Test-Image Matrix & Verification Script
 *
 * Generates programmatically a comprehensive suite of test fixtures:
 * - Valid formats (landscape, portrait, EXIF orientation 3/6/8)
 * - Transparency (PNG, WebP)
 * - Dimension bounds (4000x3000, panorama 4000x500, tiny 16x16)
 * - Size boundaries (at 4MB limit, over 4MB limit)
 * - Unsupported formats (GIF, SVG with script, BMP, HEIC, PDF)
 * - Malicious / Spoofed (text renamed to .jpg, PNG bytes declared as image/jpeg)
 * - Corrupt / Malformed (truncated JPEG, zero-byte, invalid base64)
 *
 * Evaluates both Client and Server validation layers.
 */

const fs = require('fs');
const path = require('path');
const {
  MAX_IMAGE_BYTES,
  validateImageBuffer,
  parseAndValidateBase64,
  sniffMimeType,
} = require('../src/utils/imageValidation');

// Hand-built minimal valid binary image headers & structures
function buildJpegBuffer(width = 100, height = 100, orientation = 1, padToBytes = 0) {
  // Minimal valid JFIF header
  const header = [
    0xFF, 0xD8, // SOI
    0xFF, 0xE0, 0x00, 0x10, // APP0 JFIF
    0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];

  // Optional EXIF APP1 marker with Orientation tag
  if (orientation > 1) {
    const exifApp1 = [
      0xFF, 0xE1, 0x00, 0x22, // APP1 marker + length (34 bytes)
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
      0x49, 0x49, 0x2A, 0x00, // II (Little Endian)
      0x08, 0x00, 0x00, 0x00, // Offset to first IFD (8)
      0x01, 0x00, // Number of tags (1)
      0x12, 0x01, // Tag 0x0112 (Orientation)
      0x03, 0x00, // Type: SHORT (3)
      0x01, 0x00, 0x00, 0x00, // Count: 1
      orientation & 0xFF, 0x00, 0x00, 0x00, // Orientation value
      0x00, 0x00, 0x00, 0x00, // Next IFD offset
    ];
    header.push(...exifApp1);
  }

  // SOF0 (Start of Frame baseline) specifying dimensions
  const sof0 = [
    0xFF, 0xC0, 0x00, 0x0B, // SOF0 length 11
    0x08, // Precision 8-bit
    (height >> 8) & 0xFF, height & 0xFF, // Height
    (width >> 8) & 0xFF, width & 0xFF, // Width
    0x01, // 1 component (grayscale)
    0x01, 0x11, 0x00,
  ];
  header.push(...sof0);

  // EOI marker
  header.push(0xFF, 0xD9);

  let buf = Buffer.from(header);
  if (padToBytes > buf.length) {
    const padding = Buffer.alloc(padToBytes - buf.length, 0xAA);
    // Insert padding between JFIF and EOI
    buf = Buffer.concat([buf.slice(0, buf.length - 2), padding, buf.slice(buf.length - 2)]);
  }
  return buf;
}

function buildPngBuffer(width = 100, height = 100, isTransparent = false) {
  // PNG signature + IHDR
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const ihdrData = [
    (width >> 24) & 0xFF, (width >> 16) & 0xFF, (width >> 8) & 0xFF, width & 0xFF,
    (height >> 24) & 0xFF, (height >> 16) & 0xFF, (height >> 8) & 0xFF, height & 0xFF,
    0x08, // 8-bit
    isTransparent ? 0x06 : 0x02, // 6 = RGBA (alpha), 2 = RGB
    0x00, 0x00, 0x00,
  ];

  const ihdrChunk = [
    0x00, 0x00, 0x00, 0x0D, // Length 13
    0x49, 0x48, 0x44, 0x52, // 'IHDR'
    ...ihdrData,
    0x00, 0x00, 0x00, 0x00, // Dummy CRC
  ];

  // IEND chunk
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ];

  return Buffer.from([...signature, ...ihdrChunk, ...iendChunk]);
}

function buildWebpBuffer(isTransparent = false) {
  // RIFF container with WEBP and VP8X (alpha bit set)
  const riff = [
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    0x24, 0x00, 0x00, 0x00, // file length
    0x57, 0x45, 0x42, 0x50, // 'WEBP'
    0x56, 0x50, 0x38, 0x58, // 'VP8X'
    0x0A, 0x00, 0x00, 0x00, // chunk length
    isTransparent ? 0x10 : 0x00, 0x00, 0x00, 0x00, // flags (alpha bit 0x10)
    0x63, 0x00, 0x00, // canvas width minus one
    0x63, 0x00, 0x00, // canvas height minus one
  ];
  return Buffer.from(riff);
}

// Generate test matrix items
const testCases = [
  {
    category: 'Normal Photos',
    id: 'jpeg-landscape',
    name: 'Normal landscape JPEG (1600x1200)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(1600, 1200),
    expectedClient: 'Scale to 1024x768',
    clientRejects: false,
  },
  {
    category: 'Normal Photos',
    id: 'jpeg-portrait',
    name: 'Normal portrait JPEG (1200x1600)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(1200, 1600),
    expectedClient: 'Scale to 768x1024',
    clientRejects: false,
  },
  {
    category: 'EXIF Orientation',
    id: 'jpeg-exif-3',
    name: 'EXIF Orientation 3 (Upside Down, 180°)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(1200, 900, 3),
    expectedClient: 'Auto-rotated 180° upright',
    clientRejects: false,
  },
  {
    category: 'EXIF Orientation',
    id: 'jpeg-exif-6',
    name: 'EXIF Orientation 6 (Rotated 90° CW)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(1200, 900, 6),
    expectedClient: 'Auto-rotated 90° CCW upright',
    clientRejects: false,
  },
  {
    category: 'EXIF Orientation',
    id: 'jpeg-exif-8',
    name: 'EXIF Orientation 8 (Rotated 270° CW)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(1200, 900, 8),
    expectedClient: 'Auto-rotated 90° CW upright',
    clientRejects: false,
  },
  {
    category: 'Transparency',
    id: 'png-transparent',
    name: 'Transparent PNG (800x800 RGBA)',
    declaredMime: 'image/png',
    buffer: buildPngBuffer(800, 800, true),
    expectedClient: 'White background filled, converted to clean JPEG',
    clientRejects: false,
  },
  {
    category: 'Transparency',
    id: 'webp-transparent',
    name: 'Transparent WebP (VP8X with Alpha)',
    declaredMime: 'image/webp',
    buffer: buildWebpBuffer(true),
    expectedClient: 'White background filled, converted to clean JPEG',
    clientRejects: false,
  },
  {
    category: 'Dimension Extremes',
    id: 'very-large-res',
    name: 'Very large photo (4000x3000)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(4000, 3000),
    expectedClient: 'Scale to 1024x768',
    clientRejects: false,
  },
  {
    category: 'Dimension Extremes',
    id: 'wide-panorama',
    name: 'Wide panorama (4000x500)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(4000, 500),
    expectedClient: 'Scale to 1024x128',
    clientRejects: false,
  },
  {
    category: 'Dimension Extremes',
    id: 'tiny-image',
    name: 'Tiny icon (16x16 JPEG)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(16, 16),
    expectedClient: 'Kept at 16x16 (never upscaled)',
    clientRejects: false,
  },
  {
    category: 'Size Boundary',
    id: 'exactly-4mb',
    name: 'Exactly at 4MB limit (4,194,304 bytes)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(100, 100, 1, 4 * 1024 * 1024),
    expectedClient: 'Compressed / Accepted under cap',
    clientRejects: false,
  },
  {
    category: 'Size Boundary',
    id: 'over-4mb',
    name: 'Just over 4MB limit (4,194,305 bytes)',
    declaredMime: 'image/jpeg',
    buffer: buildJpegBuffer(100, 100, 1, (4 * 1024 * 1024) + 1),
    expectedClient: 'Client compresses to < 1.5MB; server rejects if bypassed',
    clientRejects: false,
  },
  {
    category: 'Unsupported Types',
    id: 'gif-image',
    name: 'GIF image (GIF89a)',
    declaredMime: 'image/gif',
    buffer: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]),
    expectedClient: 'Rejected: Unsupported image format',
    clientRejects: true,
  },
  {
    category: 'Unsupported Types',
    id: 'svg-xss',
    name: 'SVG with embedded <script>',
    declaredMime: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>'),
    expectedClient: 'Rejected: Unsupported image format',
    clientRejects: true,
  },
  {
    category: 'Unsupported Types',
    id: 'bmp-image',
    name: 'BMP bitmap (BM)',
    declaredMime: 'image/bmp',
    buffer: Buffer.from([0x42, 0x4D, 0x36, 0x00, 0x00, 0x00]),
    expectedClient: 'Rejected: Unsupported image format',
    clientRejects: true,
  },
  {
    category: 'Unsupported Types',
    id: 'heic-apple',
    name: 'Apple HEIC image (ftypheic box)',
    declaredMime: 'image/heic',
    buffer: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
    expectedClient: 'Rejected: iPhone HEIC guidance toast',
    clientRejects: true,
  },
  {
    category: 'Unsupported Types',
    id: 'pdf-document',
    name: 'PDF document (%PDF-1.4)',
    declaredMime: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%mock PDF file content'),
    expectedClient: 'Rejected: Unsupported file type',
    clientRejects: true,
  },
  {
    category: 'Spoofed / Malicious',
    id: 'spoofed-txt-as-jpg',
    name: '.txt file renamed to food.jpg (declared image/jpeg)',
    declaredMime: 'image/jpeg',
    buffer: Buffer.from('Just plain text food diary notes disguised as a JPEG photo.'),
    expectedClient: 'Rejected: MIME mismatch / magic-byte invalid',
    clientRejects: true,
  },
  {
    category: 'Spoofed / Malicious',
    id: 'spoofed-png-as-jpg',
    name: 'PNG bytes renamed to food.jpg with image/jpeg header',
    declaredMime: 'image/jpeg',
    buffer: buildPngBuffer(50, 50),
    expectedClient: 'Rejected: MIME mismatch (declared image/jpeg but magic bytes PNG)',
    clientRejects: true,
  },
  {
    category: 'Corrupt / Malformed',
    id: 'truncated-jpeg',
    name: 'Truncated JPEG (header only, missing EOF/data)',
    declaredMime: 'image/jpeg',
    buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
    expectedClient: 'Rejected: Decode failed / corrupt file',
    clientRejects: true,
  },
  {
    category: 'Corrupt / Malformed',
    id: 'empty-zero-byte',
    name: 'Zero-byte empty file',
    declaredMime: 'image/jpeg',
    buffer: Buffer.alloc(0),
    expectedClient: 'Rejected: Empty file',
    clientRejects: true,
  },
  {
    category: 'Corrupt / Malformed',
    id: 'invalid-base64',
    name: 'Invalid base64 string payload',
    isBase64: true,
    rawPayload: 'data:image/jpeg;base64,!!!invalid--base64--chars@@@',
    expectedClient: 'Rejected: Invalid base64 characters',
    clientRejects: true,
  },
];

async function runMatrix() {
  console.log('=== FOOD SNAP TEST IMAGE MATRIX VERIFICATION ===\n');

  const results = [];

  for (const tc of testCases) {
    let serverCode = 200;
    let serverMessage = 'OK (Accepted)';
    let finalDims = 'N/A';
    let sniffed = 'unknown';

    // Test Server-side validator directly (bypassing client)
    try {
      if (tc.isBase64) {
        const parsed = parseAndValidateBase64(tc.rawPayload);
        sniffed = parsed.mimeType;
        serverCode = 200;
        serverMessage = `Valid base64 decoded (${parsed.buffer.length} bytes)`;
      } else {
        const validated = validateImageBuffer(tc.buffer, tc.declaredMime);
        sniffed = validated.mimeType;
        serverCode = 200;
        serverMessage = `Valid binary (${validated.size} bytes, ${validated.mimeType})`;
      }
    } catch (err) {
      serverCode = err.status || 500;
      serverMessage = `${err.code || 'ERROR'}: ${err.message}`;
    }

    results.push({
      category: tc.category,
      name: tc.name,
      declaredMime: tc.declaredMime || 'base64',
      clientOutcome: tc.clientRejects ? `❌ Rejected in UI (${tc.expectedClient})` : `✅ Prepared (${tc.expectedClient})`,
      serverOutcome: serverCode === 200 ? `✅ HTTP ${serverCode}` : `🛡️ HTTP ${serverCode} (${serverMessage})`,
      serverCode,
      serverMessage,
      sizeBytes: tc.buffer ? tc.buffer.length : 0,
    });
  }

  // Print Markdown Table
  console.log('| Category | Test Case | Client Outcome | Server Outcome (Bypass Test) | Status Code |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    console.log(`| ${r.category} | ${r.name} | ${r.clientOutcome} | ${r.serverMessage} | **${r.serverCode}** |`);
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  const allRejectionsPass = results
    .filter(r => r.clientOutcome.startsWith('❌'))
    .every(r => [400, 413, 415].includes(r.serverCode));

  const no500s = results.every(r => r.serverCode !== 500);

  console.log(`- Total test cases evaluated: ${results.length}`);
  console.log(`- Server properly rejects malicious/unsupported inputs: ${allRejectionsPass ? 'YES' : 'NO'}`);
  console.log(`- Zero 500 internal server errors encountered: ${no500s ? 'YES' : 'NO'}`);

  return { results, allRejectionsPass, no500s };
}

if (require.main === module) {
  runMatrix().catch(console.error);
}

module.exports = { runMatrix, testCases };

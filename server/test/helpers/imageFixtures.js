'use strict';

/**
 * Tiny, structurally valid image fixtures for upload-validation tests.
 * Built from bytes (no image library, no binary files in git). They carry real
 * markers and header dimensions, so the validator's magic-byte, integrity and
 * dimension checks all run against realistic input.
 */

const u16 = (n) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};

/** Appends COM segments before the frame header so total length hits `padTo` exactly. */
function comPadding(bytesNeeded) {
  const parts = [];
  let remaining = bytesNeeded;
  while (remaining > 0) {
    let total = Math.min(remaining, 65537); // marker(2) + length(2) + up to 65533 data bytes
    if (remaining - total > 0 && remaining - total < 4) total -= 4;
    if (total < 4) throw new Error(`cannot pad ${remaining} bytes with COM segments`);
    const data = Buffer.alloc(total - 4, 0x20);
    parts.push(Buffer.from([0xff, 0xfe]), u16(total - 2), data);
    remaining -= total;
  }
  return Buffer.concat(parts);
}

function buildJpeg({ width = 64, height = 48, padTo = 0 } = {}) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0]),
    u16(17),
    Buffer.from([0x08]),
    u16(height),
    u16(width),
    Buffer.from([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
  ]);
  const sos = Buffer.concat([
    Buffer.from([0xff, 0xda]),
    u16(12),
    Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]),
    Buffer.alloc(24, 0x55), // fake entropy-coded data
  ]);
  const eoi = Buffer.from([0xff, 0xd9]);
  const core = Buffer.concat([soi, app0, sof0, sos, eoi]);
  if (!padTo) return core;
  const pad = comPadding(padTo - core.length);
  return Buffer.concat([soi, app0, pad, sof0, sos, eoi]);
}

function buildPng({ width = 64, height = 48 } = {}) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => Buffer.concat([u32(data.length), Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  const ihdr = Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', Buffer.alloc(16, 1)), chunk('IEND', Buffer.alloc(0))]);
}

/** WebP with a VP8X (extended) header, as produced for images with alpha. */
function buildWebp({ width = 64, height = 48 } = {}) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x10; // alpha flag
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from('VP8X'), Buffer.from([10, 0, 0, 0]), vp8x]);
  const riff = Buffer.alloc(4);
  riff.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from('RIFF'), riff, body]);
}

/** WebP with a VP8L (lossless) header. */
function buildWebpLossless({ width = 64, height = 48 } = {}) {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const payload = Buffer.alloc(10);
  payload[0] = 0x2f;
  payload.writeUInt32LE(bits >>> 0, 1);
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from('VP8L'), Buffer.from([10, 0, 0, 0]), payload]);
  const riff = Buffer.alloc(4);
  riff.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from('RIFF'), riff, body]);
}

const pad = (head, total = 64) => Buffer.concat([head, Buffer.alloc(Math.max(0, total - head.length))]);

const unsupported = {
  gif: pad(Buffer.from('GIF89a')),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  bmp: pad(Buffer.from('BM')),
  pdf: pad(Buffer.from('%PDF-1.4')),
  heic: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(32)]),
  text: Buffer.from('just some text, definitely not an image'),
};

module.exports = { buildJpeg, buildPng, buildWebp, buildWebpLossless, unsupported };

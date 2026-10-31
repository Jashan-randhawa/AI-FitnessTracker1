'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const upload = require('../src/middleware/upload');
const { validateFoodSnapUpload } = require('../src/middleware/aiValidation');
const { errorHandler } = require('../src/middleware/errorHandler');
const {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  sniffMimeType,
  getImageDimensions,
  validateImageBuffer,
  parseAndValidateBase64,
} = require('../src/utils/imageValidation');
const fx = require('./helpers/imageFixtures');

const rejects = (fn, status, code) =>
  assert.throws(fn, (err) => {
    assert.equal(err.status, status, `status for ${code}`);
    assert.equal(err.code, code);
    return true;
  });

test('fixtures are sniffed as the right type', () => {
  assert.equal(sniffMimeType(fx.buildJpeg()), 'image/jpeg');
  assert.equal(sniffMimeType(fx.buildPng()), 'image/png');
  assert.equal(sniffMimeType(fx.buildWebp()), 'image/webp');
  assert.equal(sniffMimeType(fx.unsupported.gif), 'image/gif');
  assert.equal(sniffMimeType(fx.unsupported.svg), 'image/svg+xml');
  assert.equal(sniffMimeType(fx.unsupported.heic), 'image/heic');
  assert.equal(sniffMimeType(fx.unsupported.text), 'unknown');
});

test('header dimensions are read for jpeg, png and both webp variants', () => {
  assert.deepEqual(getImageDimensions(fx.buildJpeg({ width: 4000, height: 3000 }), 'image/jpeg'), { width: 4000, height: 3000 });
  assert.deepEqual(getImageDimensions(fx.buildPng({ width: 800, height: 600 }), 'image/png'), { width: 800, height: 600 });
  assert.deepEqual(getImageDimensions(fx.buildWebp({ width: 1024, height: 768 }), 'image/webp'), { width: 1024, height: 768 });
  assert.deepEqual(getImageDimensions(fx.buildWebpLossless({ width: 500, height: 400 }), 'image/webp'), { width: 500, height: 400 });
  assert.equal(getImageDimensions(Buffer.alloc(5), 'image/jpeg'), null);
});

test('valid jpeg, png and webp are accepted and report their dimensions', () => {
  const j = validateImageBuffer(fx.buildJpeg({ width: 1024, height: 768 }), 'image/jpeg');
  assert.deepEqual([j.mimeType, j.width, j.height], ['image/jpeg', 1024, 768]);
  assert.equal(validateImageBuffer(fx.buildPng(), 'image/png').mimeType, 'image/png');
  assert.equal(validateImageBuffer(fx.buildWebp(), 'image/webp').mimeType, 'image/webp');
});

test('exactly MAX_IMAGE_BYTES is accepted and one byte over is 413', () => {
  const exact = fx.buildJpeg({ padTo: MAX_IMAGE_BYTES });
  assert.equal(exact.length, MAX_IMAGE_BYTES);
  assert.equal(validateImageBuffer(exact, 'image/jpeg').size, MAX_IMAGE_BYTES);
  rejects(() => validateImageBuffer(fx.buildJpeg({ padTo: MAX_IMAGE_BYTES + 1 }), 'image/jpeg'), 413, 'LIMIT_FILE_SIZE');
});

test('unsupported formats are rejected with 415', () => {
  for (const [name, buf] of Object.entries({ gif: fx.unsupported.gif, svg: fx.unsupported.svg, bmp: fx.unsupported.bmp, pdf: fx.unsupported.pdf })) {
    rejects(() => validateImageBuffer(buf, 'image/jpeg'), 415, 'UNSUPPORTED_MEDIA_TYPE');
    assert.ok(name);
  }
  rejects(() => validateImageBuffer(fx.unsupported.heic), 415, 'HEIC_NOT_SUPPORTED');
  rejects(() => validateImageBuffer(fx.unsupported.text, 'image/jpeg'), 415, 'UNSUPPORTED_MEDIA_TYPE');
});

test('declared MIME that disagrees with the real bytes is rejected', () => {
  rejects(() => validateImageBuffer(fx.buildPng(), 'image/jpeg'), 415, 'MIME_MISMATCH');
  rejects(() => validateImageBuffer(fx.buildJpeg(), 'image/webp'), 415, 'MIME_MISMATCH');
});

test('empty, truncated and zero-dimension images are 400', () => {
  rejects(() => validateImageBuffer(Buffer.alloc(0)), 400, 'EMPTY_FILE');
  const jpeg = fx.buildJpeg({ padTo: 4096 });
  rejects(() => validateImageBuffer(jpeg.subarray(0, jpeg.length - 2000), 'image/jpeg'), 400, 'CORRUPT_IMAGE');
  const png = fx.buildPng();
  rejects(() => validateImageBuffer(png.subarray(0, png.length - 12), 'image/png'), 400, 'CORRUPT_IMAGE');
  rejects(() => validateImageBuffer(fx.buildJpeg({ width: 0, height: 10 }), 'image/jpeg'), 400, 'CORRUPT_IMAGE');
});

test('tiny file claiming a huge resolution is rejected before it can reach the AI provider', () => {
  const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 1;
  rejects(() => validateImageBuffer(fx.buildPng({ width: side, height: side }), 'image/png'), 400, 'IMAGE_DIMENSIONS_TOO_LARGE');
  rejects(() => validateImageBuffer(fx.buildJpeg({ width: 20000, height: 20000 }), 'image/jpeg'), 400, 'IMAGE_DIMENSIONS_TOO_LARGE');
  rejects(() => validateImageBuffer(fx.buildWebp({ width: 16000, height: 16000 }), 'image/webp'), 400, 'IMAGE_DIMENSIONS_TOO_LARGE');
  // a legitimate 12 MP phone photo is fine
  assert.equal(validateImageBuffer(fx.buildJpeg({ width: 4000, height: 3000 }), 'image/jpeg').width, 4000);
});

test('base64 input: data URL ok, bad characters 400, oversize rejected before decoding', () => {
  const png = fx.buildPng();
  const ok = parseAndValidateBase64(`data:image/png;base64,${png.toString('base64')}`);
  assert.equal(ok.mimeType, 'image/png');
  assert.ok(ok.buffer.equals(png));
  rejects(() => parseAndValidateBase64('not base64 !!!'), 400, 'INVALID_BASE64');
  rejects(() => parseAndValidateBase64(''), 400, 'INVALID_BASE64');
  rejects(() => parseAndValidateBase64('A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8)), 413, 'LIMIT_FILE_SIZE');
  rejects(() => parseAndValidateBase64(`data:image/jpeg;base64,${png.toString('base64')}`), 415, 'MIME_MISMATCH');
});

// ---- HTTP: real multer + validateFoodSnapUpload + errorHandler chain -------------------

let server;
let base;

test.before(async () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.post('/snap', upload.single('image'), validateFoodSnapUpload, (req, res) => {
    res.json({ ok: true, mime: req.file.mimetype, size: req.file.size });
  });
  app.use(errorHandler);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const sendMultipart = async (buf, type, name = 'food.jpg') => {
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type }), name);
  const res = await fetch(`${base}/snap`, { method: 'POST', body: fd });
  return { status: res.status, body: await res.json() };
};

test('HTTP multipart: valid images pass, with the real type reported', async () => {
  for (const [buf, type] of [[fx.buildJpeg(), 'image/jpeg'], [fx.buildPng(), 'image/png'], [fx.buildWebp(), 'image/webp']]) {
    const r = await sendMultipart(buf, type);
    assert.equal(r.status, 200, type);
    assert.equal(r.body.mime, type);
  }
});

test('HTTP multipart: exactly 4 MB passes, over 4 MB is a JSON 413 (multer limit)', async () => {
  assert.equal((await sendMultipart(fx.buildJpeg({ padTo: MAX_IMAGE_BYTES }), 'image/jpeg')).status, 200);
  const over = await sendMultipart(fx.buildJpeg({ padTo: MAX_IMAGE_BYTES + 1 }), 'image/jpeg');
  assert.equal(over.status, 413);
  assert.match(over.body.error?.message ?? over.body.message, /4MB/);
});

test('HTTP multipart: spoofed, unsupported and corrupt uploads get typed errors, never a 500', async () => {
  const cases = [
    [fx.unsupported.text, 'image/jpeg', 'a.jpg', 415],
    [fx.unsupported.svg, 'image/png', 'a.png', 415],
    [fx.unsupported.gif, 'image/gif', 'a.gif', 415],
    [fx.unsupported.heic, 'image/heic', 'a.heic', 415],
    [fx.unsupported.pdf, 'application/pdf', 'a.pdf', 415],
    [fx.buildPng(), 'image/jpeg', 'a.jpg', 415], // PNG bytes labelled JPEG
    [fx.buildJpeg().subarray(0, 40), 'image/jpeg', 'cut.jpg', 400],
    [Buffer.alloc(0), 'image/jpeg', 'empty.jpg', 400],
    [fx.buildJpeg({ width: 20000, height: 20000 }), 'image/jpeg', 'huge.jpg', 400],
  ];
  for (const [buf, type, name, expected] of cases) {
    const r = await sendMultipart(buf, type, name);
    assert.equal(r.status, expected, `${name} (${type})`);
    assert.ok(r.body.error || r.body.message, 'JSON error body');
    assert.ok(!JSON.stringify(r.body).includes('node_modules'), 'no stack/path leakage');
  }
});

test('HTTP JSON base64 fallback is validated by the same rules', async () => {
  const post = (image) =>
    fetch(`${base}/snap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
  assert.equal((await post(`data:image/png;base64,${fx.buildPng().toString('base64')}`)).status, 200);
  assert.equal((await post(fx.unsupported.svg.toString('base64'))).status, 415);
  assert.equal((await post('***')).status, 400);
});

test('HTTP: a request with no image is a 400', async () => {
  const res = await fetch(`${base}/snap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 400);
});

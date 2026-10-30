const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { search } = require('../src/controllers/youtube.controller');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('YouTube Controller Unit Tests', () => {
  const originalKey = process.env.RAPIDAPI_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.RAPIDAPI_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.RAPIDAPI_KEY = originalKey;
    else delete process.env.RAPIDAPI_KEY;
    global.fetch = originalFetch;
  });

  it('rejects requests with missing or empty q query with 400', async () => {
    const req = { query: { q: '   ' } };
    const res = createMockRes();

    await search(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('Missing query parameter: q'));
  });

  it('returns 500 when RAPIDAPI_KEY is unset on cache miss', async () => {
    const req = { query: { q: 'unique-query-uncached-123' } };
    const res = createMockRes();

    await search(req, res);

    assert.equal(res.statusCode, 500);
    assert.ok(res.body.error.includes('RapidAPI key not configured'));
  });

  it('fetches from API on MISS, caches data, and serves HIT on subsequent calls', async () => {
    process.env.RAPIDAPI_KEY = 'test_rapidapi_key_456';

    let fetchCount = 0;
    global.fetch = async (url, options) => {
      fetchCount++;
      assert.ok(url.includes('youtube138.p.rapidapi.com'));
      assert.equal(options.headers['x-rapidapi-key'], 'test_rapidapi_key_456');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contents: [{ type: 'video', video: { title: 'HIIT Cardio Workout' } }],
        }),
      };
    };

    const q = 'hiit cardio test ' + Date.now();
    const req1 = { query: { q } };
    const res1 = createMockRes();

    await search(req1, res1);

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.headers['X-Cache'], 'MISS');
    assert.equal(fetchCount, 1);
    assert.equal(res1.body.contents[0].video.title, 'HIIT Cardio Workout');

    // Second call with same query should hit cache without calling fetch
    const req2 = { query: { q } };
    const res2 = createMockRes();

    await search(req2, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.headers['X-Cache'], 'HIT');
    assert.equal(fetchCount, 1); // No new fetch
    assert.equal(res2.body.contents[0].video.title, 'HIIT Cardio Workout');
  });
});

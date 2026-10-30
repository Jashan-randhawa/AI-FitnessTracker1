const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { getHeadlines } = require('../src/controllers/news.controller');

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

describe('News Controller Unit Tests', () => {
  const originalKey = process.env.NEWS_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.NEWS_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.NEWS_API_KEY = originalKey;
    else delete process.env.NEWS_API_KEY;
    global.fetch = originalFetch;
  });

  it('returns 503 error when NEWS_API_KEY is not configured', async () => {
    const req = { query: { category: 'fitness' } };
    const res = createMockRes();

    await getHeadlines(req, res);

    assert.equal(res.statusCode, 503);
    assert.ok(res.body.error.includes('News API key is not configured'));
  });

  it('fetches headlines, filters invalid entries, and generates deterministic MD5 IDs', async () => {
    process.env.NEWS_API_KEY = 'test_news_api_key_123';

    const mockArticles = [
      {
        source: { id: 'wired', name: 'Wired' },
        author: 'Jane Doe',
        title: 'The Best Workout Tech for 2026',
        description: 'New sensors and wearables.',
        url: 'https://example.com/wired/workout-tech',
        urlToImage: 'https://example.com/img.jpg',
        publishedAt: '2026-10-30T10:00:00Z',
      },
      {
        source: { name: 'Spam' },
        title: '[Removed]',
        url: 'https://example.com/removed',
      },
      {
        source: { name: 'Incomplete' },
        title: 'No URL article',
        url: '',
      },
    ];

    global.fetch = async (url) => {
      assert.ok(url.includes('newsapi.org/v2/everything'));
      assert.ok(url.includes('apiKey=test_news_api_key_123'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          totalResults: 1,
          articles: mockArticles,
        }),
      };
    };

    const req = { query: { category: 'fitness' } };
    const res = createMockRes();

    await getHeadlines(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.articles.length, 1);

    const article = res.body.articles[0];
    assert.equal(article.title, 'The Best Workout Tech for 2026');
    assert.equal(article.author, 'Jane Doe');
    assert.equal(article.source, 'Wired');

    const expectedId = crypto.createHash('md5').update('https://example.com/wired/workout-tech').digest('hex');
    assert.equal(article.id, expectedId);
  });
});

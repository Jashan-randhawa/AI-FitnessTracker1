const asyncHandler = require('express-async-handler');

const NEWS_API_BASE = 'https://newsapi.org/v2';

const TOPIC_QUERIES = {
  fitness: 'fitness workout exercise gym',
  nutrition: 'nutrition diet healthy eating food',
  health: 'health medical wellness',
  wellness: 'mental health wellbeing mindfulness stress',
  all: 'fitness health nutrition wellness exercise',
};

// GET /api/news/headlines?category=&q=&page=&pageSize=
const getHeadlines = asyncHandler(async (req, res) => {
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) {
    return res
      .status(503)
      .json({ error: 'News API key is not configured. Please set the NEWS_API_KEY environment variable.' });
  }

  const { category = 'all', q = '', page = '1', pageSize = '20' } = req.query;

  const baseQuery = TOPIC_QUERIES[category] ?? TOPIC_QUERIES.all;
  const searchQuery = q ? `${q} AND (${baseQuery})` : baseQuery;

  const params = new URLSearchParams({
    q: searchQuery,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: String(Math.min(Number(pageSize), 40)),
    page: String(page),
    apiKey: NEWS_API_KEY,
  });

  try {
    const response = await fetch(`${NEWS_API_BASE}/everything?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message ?? 'News API error' });
    }

    const articles = (data.articles ?? [])
      .filter((a) => a.title && a.title !== '[Removed]' && a.url)
      .map((a, idx) => ({
        id: `${a.source?.id ?? 'src'}-${idx}-${Date.now()}`,
        title: a.title,
        excerpt: a.description ?? '',
        content: a.content ?? a.description ?? '',
        author: a.author ?? a.source?.name ?? 'Unknown',
        source: a.source?.name ?? '',
        url: a.url,
        urlToImage: a.urlToImage ?? null,
        publishedAt: a.publishedAt,
        category,
      }));

    res.json({ articles, totalResults: data.totalResults ?? 0, status: data.status });
  } catch (err) {
    console.error('News API fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch news articles.' });
  }
});

module.exports = { getHeadlines };

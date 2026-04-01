import { Context } from 'koa';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = 'https://newsapi.org/v2';

const TOPIC_QUERIES: Record<string, string> = {
  fitness: 'fitness workout exercise gym',
  nutrition: 'nutrition diet healthy eating food',
  health: 'health medical wellness',
  wellness: 'mental health wellbeing mindfulness stress',
  all: 'fitness health nutrition wellness exercise',
};

export default {
  async getHeadlines(ctx: Context) {
    if (!NEWS_API_KEY) {
      ctx.status = 503;
      ctx.body = { error: 'News API key is not configured. Please set the NEWS_API_KEY environment variable.' };
      return;
    }

    const { category = 'all', q = '', page = '1', pageSize = '20' } = ctx.query as Record<string, string>;

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
      const data = await response.json() as any;

      if (!response.ok) {
        ctx.status = response.status;
        ctx.body = { error: data.message ?? 'News API error' };
        return;
      }

      const articles = (data.articles ?? [])
        .filter((a: any) => a.title && a.title !== '[Removed]' && a.url)
        .map((a: any, idx: number) => ({
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

      ctx.body = {
        articles,
        totalResults: data.totalResults ?? 0,
        status: data.status,
      };
    } catch (err: any) {
      strapi.log.error('News API fetch error:', err);
      ctx.status = 500;
      ctx.body = { error: 'Failed to fetch news articles.' };
    }
  },
};

export default {
  async search(ctx) {
    const query = ctx.query.q as string;

    if (!query) {
      return ctx.badRequest('Missing query parameter: q');
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return ctx.internalServerError('RapidAPI key not configured on server');
    }

    try {
      const response = await fetch(
        `https://youtube138.p.rapidapi.com/search/?q=${encodeURIComponent(query)}&hl=en&gl=US`,
        {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'youtube138.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        return ctx.internalServerError(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      ctx.body = data;
    } catch (err) {
      return ctx.internalServerError('Failed to fetch from YouTube API');
    }
  },
};

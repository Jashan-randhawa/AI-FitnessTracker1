const asyncHandler = require('express-async-handler');

// GET /api/youtube/search?q=
const search = asyncHandler(async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RapidAPI key not configured on server' });
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
      return res.status(500).json({ error: `YouTube API error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from YouTube API' });
  }
});

module.exports = { search };

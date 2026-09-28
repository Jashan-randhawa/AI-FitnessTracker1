const asyncHandler = require('express-async-handler');
const { analyzeImage } = require('../services/imageAnalysis.service');

// POST /api/image-analysis — multipart/form-data, field name "image"
const analyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No image file provided' } });
  }

  try {
    const result = await analyzeImage(req.file.buffer, req.file.mimetype);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: { message: error.message || 'Error analyzing image' } });
  }
});

module.exports = { analyze };

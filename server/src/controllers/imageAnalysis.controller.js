const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const imageAnalysisService = require('../services/imageAnalysis.service');
const { buildFitnessContext } = require('../services/fitnessContext.service');
const { computeEstimateFit } = require('../utils/estimateFit');

// POST /api/image-analysis — multipart/form-data, field name "image"
const analyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No image file provided' } });
  }

  try {
    const result = await imageAnalysisService.analyzeImage(req.file.buffer, req.file.mimetype);

    let fit = null;
    if (req.user && mongoose.connection.readyState === 1) {
      try {
        const timeZone = req.headers['x-timezone'];
        const context = await buildFitnessContext({ user: req.user, timeZone });
        fit = computeEstimateFit(result, context);
      } catch {
        fit = null;
      }
    }

    res.json({ success: true, result, fit });
  } catch (error) {
    res.status(500).json({ error: { message: error.message || 'Error analyzing image' } });
  }
});

module.exports = { analyze };

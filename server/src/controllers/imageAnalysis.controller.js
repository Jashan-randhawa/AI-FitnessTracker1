const fs = require('fs');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const imageAnalysisService = require('../services/imageAnalysis.service');
const { buildFitnessContext } = require('../services/fitnessContext.service');
const { computeEstimateFit } = require('../utils/estimateFit');
const FoodLog = require('../models/FoodLog');
const { publishChange } = require('../services/eventBus');
const { isValidTimeZone } = require('../utils/localDay');
const sendError = require('../utils/sendError');
const { MAX_IMAGE_BYTES } = require('../utils/imageValidation'); // single source of truth for the 4 MB cap

// POST /api/image-analysis — multipart/form-data, field name "image", optional query ?autoSave=true
const analyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'No image file provided', { code: 'FILE_MISSING' });
  }

  const tempPath = req.file.path || null;

  try {
    const fileSize = req.file.size || (req.file.buffer ? req.file.buffer.length : 0);
    if (fileSize > MAX_IMAGE_BYTES) {
      return sendError(
        res,
        413,
        `Image exceeds the 4MB limit (${(fileSize / (1024 * 1024)).toFixed(1)}MB)`,
        { code: 'LIMIT_FILE_SIZE' }
      );
    }

    // Process uploaded image directly from memory buffer, with disk fallback if path present
    let buffer = req.file.buffer;
    if (!buffer && tempPath) {
      buffer = await fs.promises.readFile(tempPath);
    }

    if (!buffer) {
      return sendError(res, 400, 'Could not read image buffer', { code: 'CORRUPT_IMAGE' });
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    const analysis = await imageAnalysisService.analyzeImage(buffer, mimeType);

    let fit = null;
    if (req.user && mongoose.connection.readyState === 1 && !req._skipFitnessContext) {
      try {
        const timeZone = req.headers ? req.headers['x-timezone'] : null;
        const context = await buildFitnessContext({ user: req.user, timeZone });
        fit = computeEstimateFit(analysis, context);
      } catch {
        fit = null;
      }
    }

    const autoSaveRequested = String(req.query?.autoSave).toLowerCase() === 'true';
    const confidence =
      typeof analysis.overallConfidence === 'number'
        ? analysis.overallConfidence
        : 0.8;
    const isHighConfidence = confidence >= 0.75;

    let savedRecord = null;
    let autoSaved = false;

    // Single-Roundtrip Persistence: persist directly to FoodLog collection if autoSave=true and overallConfidence >= 0.75
    if (autoSaveRequested && isHighConfidence && req.user) {
      const tzHeader = req.headers ? req.headers['x-timezone'] : null;
      const tz = isValidTimeZone(tzHeader) ? tzHeader : null;
      let hour = new Date().getHours();
      if (tz) {
        try {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
          const hPart = parts.find((p) => p.type === 'hour');
          if (hPart) hour = parseInt(hPart.value, 10);
        } catch {
          hour = new Date().getHours();
        }
      }

      let defaultMealType = 'snack';
      if (hour >= 0 && hour < 12) defaultMealType = 'breakfast';
      else if (hour >= 12 && hour < 16) defaultMealType = 'lunch';
      else if (hour >= 16 && hour < 21) defaultMealType = 'dinner';

      const mealType = String(
        req.query.mealType || req.body?.mealType || req.body?.mealtype || defaultMealType
      ).toLowerCase().trim();

      const created = await FoodLog.create({
        name: analysis.dishTitle || analysis.name || 'Food Snap Meal',
        calories: analysis.totalCalories ?? analysis.calories ?? 0,
        protein: analysis.totalProtein ?? analysis.protein ?? 0,
        carbs: analysis.totalCarbs ?? analysis.carbs ?? 0,
        fat: analysis.totalFats ?? analysis.fat ?? 0,
        mealtype: mealType,
        mealType: mealType,
        date: new Date(),
        user: req.user._id,
        aiGenerated: true,
      });

      publishChange(String(req.user._id), 'food', created.date);
      savedRecord = typeof created.toJSON === 'function' ? created.toJSON() : created;
      autoSaved = true;
    }

    return res.json({
      success: true,
      result: analysis, // backward compatibility
      analysis,
      savedRecord,
      savedLog: savedRecord,
      autoSaved,
      fit,
    });
  } catch (error) {
    const isTimeout =
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.name === 'TimeoutError' ||
      /timeout/i.test(error.message);
    const isUpstreamUnavailable =
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504 ||
      /bad gateway|service unavailable|gateway timeout/i.test(error.message);

    if (isTimeout) {
      return sendError(res, 504, 'AI vision service timed out. Please try again.', {
        code: 'GATEWAY_TIMEOUT',
      });
    }
    if (isUpstreamUnavailable) {
      return sendError(res, 502, 'AI vision service is temporarily unavailable. Please try again later.', {
        code: 'BAD_GATEWAY',
      });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const message = isProd
      ? 'Error analyzing image. Please try again later.'
      : error.message || 'Error analyzing image';

    return sendError(res, 500, message, { code: 'AI_ANALYSIS_FAILED' });
  } finally {
    if (tempPath) {
      await fs.promises.unlink(tempPath).catch(() => {});
    }
  }
});

module.exports = { analyze };

const asyncHandler = require('express-async-handler');
const { publishChange } = require('../services/eventBus');
const FoodLog = require('../models/FoodLog');
const sendError = require('../utils/sendError');
const { parsePageParams, findPage, sendPage } = require('../utils/pagination');
const { validateLogDate } = require('../utils/localDay');
const idempotency = require('../middleware/idempotency');

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const normalizeFoodPayload = (raw) => {
  const body = { ...raw };
  const rawMealType = body.mealtype || body.mealType || 'snack';
  const normMealType = String(rawMealType).toLowerCase().trim();
  body.mealtype = normMealType;
  body.mealType = normMealType;

  if (body.calories !== undefined) {
    body.calories = Number(body.calories) || 0;
  }
  if (body.protein !== undefined && body.protein !== null) {
    body.protein = Number(body.protein) || 0;
  }
  if (body.carbs !== undefined && body.carbs !== null) {
    body.carbs = Number(body.carbs) || 0;
  }
  if (body.fat !== undefined && body.fat !== null) {
    body.fat = Number(body.fat) || 0;
  }
  return body;
};

// POST /api/foodlogs — body: { data: { name, calories, protein, carbs, fat, mealtype, mealType, date, aiGenerated } }
const create = asyncHandler(async (req, res) => {
  if (!req._idempotencyHandled) {
    let proceeded = false;
    await new Promise((resolve, reject) => {
      Promise.resolve(
        idempotency(req, res, (err) => {
          proceeded = true;
          if (err) return reject(err);
          resolve();
        })
      )
        .then(() => {
          if (!proceeded) resolve();
        })
        .catch(reject);
    });
    if (!proceeded) return;
  }

  const raw = req.body?.data || req.body || {};

  // Name validation: non-empty string up to 100 chars
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name || name.length > 100) {
    return sendError(res, 400, 'name must be a non-empty string up to 100 characters');
  }

  // Calories validation: 0-20000
  if (raw.calories === undefined || raw.calories === null || raw.calories === '') {
    return sendError(res, 400, 'calories is required and must be between 0 and 20000');
  }
  const calories = Number(raw.calories);
  if (!Number.isFinite(calories) || calories < 0 || calories > 20000) {
    return sendError(res, 400, 'calories must be between 0 and 20000');
  }

  // Macros validation: 0-2000
  let protein = 0;
  if (raw.protein !== undefined && raw.protein !== null && raw.protein !== '') {
    protein = Number(raw.protein);
    if (!Number.isFinite(protein) || protein < 0 || protein > 2000) {
      return sendError(res, 400, 'protein must be between 0 and 2000');
    }
  }

  let carbs = 0;
  if (raw.carbs !== undefined && raw.carbs !== null && raw.carbs !== '') {
    carbs = Number(raw.carbs);
    if (!Number.isFinite(carbs) || carbs < 0 || carbs > 2000) {
      return sendError(res, 400, 'carbs must be between 0 and 2000');
    }
  }

  let fat = 0;
  const rawFat = raw.fat !== undefined ? raw.fat : raw.fats;
  if (rawFat !== undefined && rawFat !== null && rawFat !== '') {
    fat = Number(rawFat);
    if (!Number.isFinite(fat) || fat < 0 || fat > 2000) {
      return sendError(res, 400, 'fat must be between 0 and 2000');
    }
  }

  // Meal type validation: breakfast, lunch, dinner, snack
  const rawMealType = raw.mealtype || raw.mealType;
  let mealType = 'snack';
  if (rawMealType !== undefined && rawMealType !== null && rawMealType !== '') {
    const normMealType = String(rawMealType).toLowerCase().trim();
    if (!VALID_MEAL_TYPES.includes(normMealType)) {
      return sendError(
        res,
        400,
        `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}`
      );
    }
    mealType = normMealType;
  }

  // Date validation: max 5 min future, max OFFLINE_MAX_AGE_DAYS past
  const dateValidation = validateLogDate(raw.date);
  if (!dateValidation.valid) {
    return sendError(res, 400, dateValidation.error, dateValidation.code ? { code: dateValidation.code } : {});
  }
  const logDate = dateValidation.date;

  const aiGenerated = Boolean(raw.aiGenerated);

  // Whitelisted fields persistence
  const entry = await FoodLog.create({
    name,
    calories,
    protein,
    carbs,
    fat,
    mealtype: mealType,
    mealType,
    date: logDate,
    user: req.user._id,
    aiGenerated,
  });

  publishChange(String(req.user._id), 'food', entry.date);
  res.status(200).json(entry.toJSON());
});

// GET /api/foodlogs
const find = asyncHandler(async (req, res) => {
  const page = parsePageParams(req.query);
  if (page.error) return sendError(res, 400, page.error);
  const { docs, nextCursor } = await findPage(FoodLog, { user: req.user._id }, { field: 'createdAt', ...page });
  sendPage(res, docs.map((r) => r.toJSON()), nextCursor);
});

// GET /api/foodlogs/:id
const findOne = asyncHandler(async (req, res) => {
  const entry = await FoodLog.findOne({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Food log entry not found');
  res.json(entry.toJSON());
});

// PUT /api/foodlogs/:id
const update = asyncHandler(async (req, res) => {
  const body = normalizeFoodPayload(req.body.data || req.body || {});
  delete body.user;
  delete body._id;
  delete body.id;
  delete body.createdAt;
  delete body.updatedAt;
  delete body.__v;

  const entry = await FoodLog.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, body, {
    new: true,
    runValidators: true,
  });
  if (!entry) return sendError(res, 404, 'Food log entry not found');
  publishChange(String(req.user._id), 'food', entry.date);
  res.json(entry.toJSON());
});

// DELETE /api/foodlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await FoodLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Food log entry not found');
  publishChange(String(req.user._id), 'food', entry.date);
  res.json(entry.toJSON());
});

module.exports = { create, find, findOne, update, remove };

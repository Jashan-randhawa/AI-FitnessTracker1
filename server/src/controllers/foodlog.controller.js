const asyncHandler = require('express-async-handler');
const FoodLog = require('../models/FoodLog');
const sendError = require('../utils/sendError');

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

// POST /api/foodlogs — body: { data: { name, calories, protein, carbs, fat, mealtype, mealType, date } }
const create = asyncHandler(async (req, res) => {
  const raw = req.body.data || req.body || {};
  const body = normalizeFoodPayload(raw);

  const entry = await FoodLog.create({
    ...body,
    date: body.date || new Date(),
    user: req.user._id,
  });
  res.json(entry.toJSON());
});

// GET /api/foodlogs
const find = asyncHandler(async (req, res) => {
  const result = await FoodLog.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(result.map((r) => r.toJSON()));
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
  const entry = await FoodLog.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, body, {
    new: true,
    runValidators: true,
  });
  if (!entry) return sendError(res, 404, 'Food log entry not found');
  res.json(entry.toJSON());
});

// DELETE /api/foodlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await FoodLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Food log entry not found');
  res.json(entry.toJSON());
});

module.exports = { create, find, findOne, update, remove };

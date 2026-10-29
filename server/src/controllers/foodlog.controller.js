const asyncHandler = require('express-async-handler');
const { publishChange } = require('../services/eventBus');
const FoodLog = require('../models/FoodLog');
const sendError = require('../utils/sendError');
const { parsePageParams, findPage, sendPage } = require('../utils/pagination');

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
  publishChange(String(req.user._id), 'food', entry.date);
  res.json(entry.toJSON());
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

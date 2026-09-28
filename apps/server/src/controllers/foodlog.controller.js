const asyncHandler = require('express-async-handler');
const FoodLog = require('../models/FoodLog');
const sendError = require('../utils/sendError');

// POST /api/foodlogs — body: { data: { name, calories, protein, carbs, fat, mealtype, date } }
const create = asyncHandler(async (req, res) => {
  const body = req.body.data || {};
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
  const body = req.body.data || req.body || {};
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

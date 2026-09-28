const asyncHandler = require('express-async-handler');
const ChatHistory = require('../models/ChatHistory');

// GET /api/chathistories — latest 5 sessions, used for FitBot memory context
const find = asyncHandler(async (req, res) => {
  const result = await ChatHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5);
  res.json(result.map((r) => r.toJSON()));
});

// POST /api/chathistories — body: { data: { summary, messages } }
const create = asyncHandler(async (req, res) => {
  const { summary, messages } = req.body.data || {};
  const entry = await ChatHistory.create({ summary, messages, user: req.user._id });
  res.json(entry.toJSON());
});

// DELETE /api/chathistories/all
const deleteAll = asyncHandler(async (req, res) => {
  const result = await ChatHistory.deleteMany({ user: req.user._id });
  res.json({ deleted: result.deletedCount });
});

module.exports = { find, create, deleteAll };

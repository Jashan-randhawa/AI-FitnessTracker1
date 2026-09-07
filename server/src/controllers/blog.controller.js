const asyncHandler = require('express-async-handler');
const Blog = require('../models/Blog');
const sendError = require('../utils/sendError');

// GET /api/blogs — public
const find = asyncHandler(async (req, res) => {
  const posts = await Blog.find({ publishedAt: { $ne: null } }).sort({ createdAt: -1 });
  res.json(posts.map((p) => p.toJSON()));
});

// GET /api/blogs/:id — public
const findOne = asyncHandler(async (req, res) => {
  const post = await Blog.findOne({ _id: req.params.id, publishedAt: { $ne: null } });
  if (!post) return sendError(res, 404, 'Blog post not found');
  res.json(post.toJSON());
});

// POST /api/blogs — authenticated
// The original app only exposed writes through Strapi's separate Admin
// panel (a different auth system entirely). There's no MERN equivalent of
// that panel here, so these are gated behind a normal logged-in user
// instead of left open — swap in an isAdmin check later if you add roles.
const create = asyncHandler(async (req, res) => {
  const body = req.body.data || req.body || {};
  const post = await Blog.create({ ...body, publishedAt: body.publishedAt || new Date() });
  res.json(post.toJSON());
});

// PUT /api/blogs/:id — authenticated
const update = asyncHandler(async (req, res) => {
  const body = req.body.data || req.body || {};
  const post = await Blog.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!post) return sendError(res, 404, 'Blog post not found');
  res.json(post.toJSON());
});

// DELETE /api/blogs/:id — authenticated
const remove = asyncHandler(async (req, res) => {
  const post = await Blog.findByIdAndDelete(req.params.id);
  if (!post) return sendError(res, 404, 'Blog post not found');
  res.json(post.toJSON());
});

module.exports = { find, findOne, create, update, remove };

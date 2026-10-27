const asyncHandler = require('express-async-handler');
const Blog = require('../models/Blog');
const sendError = require('../utils/sendError');

// Only these fields may be written by admin requests. Anything else in the
// body (including _id, createdAt, __v) is ignored instead of being passed
// straight into Mongoose.
const WRITABLE_FIELDS = [
  'title',
  'excerpt',
  'content',
  'category',
  'coverEmoji',
  'author',
  'readTime',
  'tags',
  'publishedAt',
];

const pickWritableFields = (source) => {
  const picked = {};
  for (const field of WRITABLE_FIELDS) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked;
};

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

// POST /api/blogs — admin only (enforced by requireAdmin in blog.routes.js)
const create = asyncHandler(async (req, res) => {
  const body = pickWritableFields(req.body.data || req.body || {});
  const post = await Blog.create({ ...body, publishedAt: body.publishedAt || new Date() });
  res.json(post.toJSON());
});

// PUT /api/blogs/:id — admin only
const update = asyncHandler(async (req, res) => {
  const body = pickWritableFields(req.body.data || req.body || {});
  const post = await Blog.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!post) return sendError(res, 404, 'Blog post not found');
  res.json(post.toJSON());
});

// DELETE /api/blogs/:id — admin only
const remove = asyncHandler(async (req, res) => {
  const post = await Blog.findByIdAndDelete(req.params.id);
  if (!post) return sendError(res, 404, 'Blog post not found');
  res.json(post.toJSON());
});

module.exports = { find, findOne, create, update, remove };

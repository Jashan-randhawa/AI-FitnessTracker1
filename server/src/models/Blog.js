const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['fitness', 'nutrition', 'health', 'wellness'],
      required: true,
      default: 'fitness',
    },
    coverEmoji: String,
    author: {
      type: String,
      default: 'FitTrack Team',
    },
    readTime: {
      type: Number,
      default: 5,
    },
    tags: String,
    // Strapi's draftAndPublish flag — every post the app creates is
    // published immediately, but the field is kept so unpublished drafts
    // (publishedAt: null) can be filtered out of the public listing.
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

toJSONPlugin(blogSchema);

module.exports = mongoose.model('Blog', blogSchema);

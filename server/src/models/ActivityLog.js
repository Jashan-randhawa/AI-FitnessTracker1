const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const activityLogSchema = new mongoose.Schema(
  {
    name: String,
    duration: Number,
    calories: Number,
    // The original Strapi schema never declared this field, even though its
    // controller tried to set it — Strapi silently dropped it on save, so
    // logs only ever had `createdAt` to sort/filter by. Declaring it here
    // for real fixes that silent data loss with zero behavior change for
    // the client (it already falls back to `createdAt` when absent).
    date: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

toJSONPlugin(activityLogSchema);

module.exports = mongoose.model('ActivityLog', activityLogSchema);

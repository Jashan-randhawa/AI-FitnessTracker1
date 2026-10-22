const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const chatHistorySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      trim: true,
    },
    revision: {
      type: Number,
      default: 1,
    },
    summary: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    // Mixed to maintain backward compatibility with legacy entries,
    // validated at the controller level with Zod.
    messages: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
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

// Compound unique index on user and sessionId, with partialFilterExpression so that
// legacy documents without a string sessionId never trigger unique constraint collisions.
chatHistorySchema.index(
  { user: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: 'string' } },
  }
);

// Compound index to optimize sorted pagination by latest update and creation time
chatHistorySchema.index({ user: 1, updatedAt: -1 });
chatHistorySchema.index({ user: 1, createdAt: -1 });

toJSONPlugin(chatHistorySchema);

module.exports = mongoose.model('ChatHistory', chatHistorySchema);

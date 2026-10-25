const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'idempotency key is required'],
      index: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user reference is required'],
      index: true,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'cached response is required'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // 5 minutes TTL in MongoDB (300 seconds)
    },
  },
  { timestamps: false }
);

idempotencyKeySchema.index({ user: 1, key: 1 }, { unique: true });

toJSONPlugin(idempotencyKeySchema);

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);

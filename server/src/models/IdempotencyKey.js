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
    requestHash: {
      type: String,
      trim: true,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    statusCode: {
      type: Number,
      default: 200,
    },
    route: {
      type: String,
      trim: true,
    },
    response: {
      type: mongoose.Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      default: function () {
        const hours = parseInt(process.env.IDEMPOTENCY_TTL_HOURS, 10) || 336;
        return new Date(Date.now() + hours * 3600 * 1000);
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

idempotencyKeySchema.index({ user: 1, key: 1 }, { unique: true });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

toJSONPlugin(idempotencyKeySchema);

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);

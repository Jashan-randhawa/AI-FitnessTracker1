const mongoose = require('mongoose');

const emailEventSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
      index: true, // e.g. delivered, soft_bounce, hard_bounce, spam, opened, click
    },
    ip: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailEvent', emailEventSchema);

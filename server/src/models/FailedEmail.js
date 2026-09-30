const mongoose = require('mongoose');

const failedEmailSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FailedEmail', failedEmailSchema);

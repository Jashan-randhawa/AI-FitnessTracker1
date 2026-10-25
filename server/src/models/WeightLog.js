const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const weightLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user reference is required'],
      index: true,
    },
    weightKg: {
      type: Number,
      required: [true, 'weightKg is required'],
      min: [20, 'weightKg must be at least 20 kg'],
      max: [400, 'weightKg cannot exceed 400 kg'],
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      maxlength: [100, 'notes cannot exceed 100 characters'],
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['profile', 'quick-log', 'onboarding'],
      default: 'quick-log',
    },
  },
  { timestamps: true }
);

weightLogSchema.index({ user: 1, date: -1 });

toJSONPlugin(weightLogSchema);

module.exports = mongoose.model('WeightLog', weightLogSchema);

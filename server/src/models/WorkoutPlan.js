const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const workoutPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'My Workout Plan',
    },
    goal: {
      type: String,
      default: '',
    },
    level: {
      type: String,
      default: 'all levels',
    },
    daysPerWeek: {
      type: Number,
      default: 4,
    },
    split: {
      type: String,
      default: '',
    },
    days: [
      {
        day: { type: String, required: true },
        focus: { type: String, default: '' },
        duration: { type: String, default: '' },
        exercises: [mongoose.Schema.Types.Mixed],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

toJSONPlugin(workoutPlanSchema);

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);

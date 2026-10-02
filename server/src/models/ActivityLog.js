const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const exerciseSetSchema = new mongoose.Schema(
  {
    setNumber: Number,
    weight: Number,
    reps: Number,
    completed: { type: Boolean, default: false },
    rpe: Number,
  },
  { _id: false }
);

const loggedExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sets: [exerciseSetSchema],
  },
  { _id: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    name: String,
    duration: Number,
    calories: Number,
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
    // Additive extensions for workout session and planner tracking
    type: {
      type: String,
      enum: ['cardio', 'strength', 'hiit', 'yoga', 'mobility', 'general'],
      default: 'general',
    },
    intensity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    source: {
      type: String,
      enum: ['manual', 'planner', 'live-session', 'quick-log'],
      default: 'manual',
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkoutPlan',
      default: null,
    },
    planDay: {
      type: String,
      default: null,
    },
    exercises: [loggedExerciseSchema],
  },
  { timestamps: true }
);

toJSONPlugin(activityLogSchema);

module.exports = mongoose.model('ActivityLog', activityLogSchema);

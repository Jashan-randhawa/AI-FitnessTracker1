const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const foodLogSchema = new mongoose.Schema(
  {
    name: String,
    // Support both `mealtype` (legacy format) and `mealType` (camelCase)
    mealtype: String,
    mealType: String,
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
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

toJSONPlugin(foodLogSchema);

module.exports = mongoose.model('FoodLog', foodLogSchema);

const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const foodLogSchema = new mongoose.Schema(
  {
    name: String,
    // Lowercase field name kept as-is — the client sends `mealtype` (lowercase)
    // in the create payload to match the original Strapi attribute name.
    mealtype: String,
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

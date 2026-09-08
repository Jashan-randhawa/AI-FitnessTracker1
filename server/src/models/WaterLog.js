const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const waterLogSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
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

toJSONPlugin(waterLogSchema);

module.exports = mongoose.model('WaterLog', waterLogSchema);

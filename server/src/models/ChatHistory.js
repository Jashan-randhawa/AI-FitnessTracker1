const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

const chatHistorySchema = new mongoose.Schema(
  {
    summary: String,
    // Mixed to match Strapi's generic `json` field — the client stores an
    // array of { role, text } objects here, but nothing on the server
    // needs to validate that shape.
    messages: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
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

toJSONPlugin(chatHistorySchema);

module.exports = mongoose.model('ChatHistory', chatHistorySchema);

const mongoose = require('mongoose');
const toJSONPlugin = require('../utils/toJSONPlugin');

/**
 * Standard AI feature identifiers tracked for per-user daily budgets.
 */
const VALID_AI_FEATURES = Object.freeze([
  'fitbot_chat',
  'planner_meal',
  'planner_activity',
  'food_snap',
  'food_estimate',
  'calorie_estimate',
  'voice_set',
]);

/**
 * Calculate document expiration timestamp ~35 days after the UTC day ends.
 *
 * @param {string} [dayStr] "YYYY-MM-DD" in UTC
 * @returns {Date}
 */
const calculateDayExpiry = (dayStr) => {
  const targetDay = dayStr || new Date().toISOString().slice(0, 10);
  const [year, month, day] = targetDay.split('-').map(Number);
  // UTC midnight following the target day + 35 full days
  const endOfDayUtc = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0);
  return new Date(endOfDayUtc + 35 * 24 * 60 * 60 * 1000);
};

const counterSchemaDefinition = {
  calls: { type: Number, default: 0, min: 0 },
  tokens: { type: Number, default: 0, min: 0 },
  promptTokens: { type: Number, default: 0, min: 0 },
  completionTokens: { type: Number, default: 0, min: 0 },
  estimatedCalls: { type: Number, default: 0, min: 0 },
  unknownUsageCalls: { type: Number, default: 0, min: 0 },
  timeouts: { type: Number, default: 0, min: 0 },
  failures: { type: Number, default: 0, min: 0 },
};

const featureCounterSchema = new mongoose.Schema(counterSchemaDefinition, { _id: false });

const featuresSubSchema = new mongoose.Schema(
  VALID_AI_FEATURES.reduce((acc, feat) => {
    acc[feat] = { type: featureCounterSchema, default: () => ({}) };
    return acc;
  }, {}),
  { _id: false, strict: false }
);

const aiUsageDailySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    day: {
      type: String,
      required: [true, 'UTC calendar day (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Day must be in YYYY-MM-DD format'],
      index: true,
    },
    ...counterSchemaDefinition,
    features: {
      type: featuresSubSchema,
      default: () => ({}),
    },
    expiresAt: {
      type: Date,
      default: function () {
        return calculateDayExpiry(this.day);
      },
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring only one record per user per UTC day
aiUsageDailySchema.index({ user: 1, day: 1 }, { unique: true });

// Alias virtual for byFeature access
aiUsageDailySchema.virtual('byFeature').get(function () {
  return this.features;
});

// Flat entity transform convention ({ id, ... })
toJSONPlugin(aiUsageDailySchema);

const AiUsageDaily = mongoose.model('AiUsageDaily', aiUsageDailySchema);

AiUsageDaily.VALID_AI_FEATURES = VALID_AI_FEATURES;
AiUsageDaily.calculateDayExpiry = calculateDayExpiry;

module.exports = AiUsageDaily;

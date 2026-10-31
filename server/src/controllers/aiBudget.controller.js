const AiUsageDaily = require('../models/AiUsageDaily');
const {
  getUtcDay,
  getNextUtcMidnight,
  getBudgetForUser,
  getUsageModel,
  VALID_AI_FEATURES,
} = require('../services/aiBudget.service');
const { parsePageParams, findPage, sendPage } = require('../utils/pagination');
const sendError = require('../utils/sendError');

/**
 * GET /api/ai/usage
 * Returns authenticated user's daily AI budget status (used/remaining tokens, calls, per-feature breakdown).
 * Contains no raw database internals (_id, __v, expiresAt).
 */
const getAiUsage = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return sendError(res, 401, 'Authentication required');
  }

  const day = getUtcDay();
  const resetAt = getNextUtcMidnight().toISOString();
  const budget = getBudgetForUser(req.user);
  const store = getUsageModel();

  let usageDoc;
  try {
    const query = store.findOne({ user: userId, day });
    usageDoc = query && typeof query.lean === 'function' ? await query.lean() : await query;
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch AI usage');
  }

  const tokensUsed = usageDoc?.tokens || 0;
  const callsUsed = usageDoc?.calls || 0;
  const remainingTokens = Math.max(0, budget.tokenBudget - tokensUsed);
  const remainingCalls = Math.max(0, budget.callBudget - callsUsed);

  const percentTokensUsed = Math.min(100, Math.round((tokensUsed / budget.tokenBudget) * 100));
  const percentCallsUsed = Math.min(100, Math.round((callsUsed / budget.callBudget) * 100));
  const percentUsed = Math.max(percentTokensUsed, percentCallsUsed);
  const isExhausted = remainingTokens <= 0 || remainingCalls <= 0;

  const features = {};
  for (const feat of VALID_AI_FEATURES) {
    const featDoc = usageDoc?.features?.[feat] ||
      (typeof usageDoc?.features?.get === 'function' ? usageDoc.features.get(feat) : null);
    const featTokens = featDoc?.tokens || 0;
    const featCalls = featDoc?.calls || 0;
    const featLimit = budget.featureBudgets?.[feat] ?? null;

    features[feat] = {
      tokensUsed: featTokens,
      callsUsed: featCalls,
      remainingTokens: featLimit !== null ? Math.max(0, featLimit - featTokens) : null,
      tokenLimit: featLimit,
    };
  }

  return res.status(200).json({
    day,
    resetAt,
    tokenBudget: budget.tokenBudget,
    callBudget: budget.callBudget,
    tokensUsed,
    callsUsed,
    remainingTokens,
    remainingCalls,
    percentUsed,
    isExhausted,
    features,
  });
};

/**
 * GET /api/ai/admin/top-consumers
 * (Also aliased as GET /api/admin/ai-usage/top-consumers)
 * Admin-only endpoint listing top token consumers for a given UTC day with keyset pagination.
 */
const getTopAiConsumers = async (req, res) => {
  const targetDay = req.query.day || getUtcDay();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDay)) {
    return sendError(res, 400, 'day must be in YYYY-MM-DD format');
  }

  const page = parsePageParams(req.query);
  if (page.error) {
    return sendError(res, 400, page.error);
  }

  const store = getUsageModel();
  try {
    const { docs, nextCursor } = await findPage(
      store,
      { day: targetDay },
      {
        field: 'tokens',
        ...page,
        populate: { path: 'user', select: 'name email role isAdmin' },
      }
    );

    return sendPage(res, docs, nextCursor);
  } catch (err) {
    return sendError(res, 500, 'Failed to fetch top AI consumers: ' + err.message);
  }
};

module.exports = {
  getAiUsage,
  getTopAiConsumers,
};

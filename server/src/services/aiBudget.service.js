/**
 * Per-User Daily AI Budget & Cost Quota Service
 *
 * Enforces daily token and call ceilings across all AI capabilities:
 * - fitbot_chat: FitBot assistant streaming and tool invocations
 * - planner_meal: AI 7-day meal plan generator
 * - planner_activity: AI workout and routine planner
 * - food_snap: Gemini Vision multimodal meal analysis
 * - food_estimate: Quick food nutrition lookup
 * - calorie_estimate: OpenRouter calorie and macro estimation
 * - voice_set: Hands-free voice gym set logger
 *
 * ARCHITECTURAL DESIGN & COST SAFEGUARDS:
 * 1. Pre-Execution Gate:
 *    Budget checks (`checkBudget`) are strictly read-only and execute BEFORE
 *    any provider (OpenRouter, Gemini) call is initiated. This prevents
 *    wasted network overhead and stops runaway costs before spending API credits.
 *
 * 2. Unaltered Non-AI & Cache Availability:
 *    When a user's daily budget is reached, they receive HTTP 429 with
 *    code 'AI_DAILY_BUDGET_EXCEEDED'. Non-AI features (browsing logs, viewing
 *    existing workout plans, profile management) and cached AI responses (FitBot
 *    in-memory cache hits) remain fully functional.
 *
 * 3. UTC Midnight Calendar Anchor:
 *    Quota days (`YYYY-MM-DD`) and resets are anchored strictly to UTC midnight.
 *    Client-supplied timezone headers (e.g., X-Timezone) are untrusted and
 *    ignored for budget reset calculation to prevent timezone manipulation attacks.
 *
 * 4. Database Failure Policy (Fail-Closed vs Fail-Open):
 *    When the usage database (MongoDB) is unavailable or unresponsive:
 *    - Production default: FAIL-CLOSED (`AI_BUDGET_FAIL_MODE=closed`). AI requests
 *      are blocked with HTTP 429/503 to prevent unmetered usage from draining
 *      company API keys or credit cards during outages.
 *    - Development / Overridden: FAIL-OPEN (`AI_BUDGET_FAIL_MODE=open`).
 *      Requests are allowed through with a logged warning to preserve service continuity.
 *
 * 5. Data Privacy & Zero-PII Ledger:
 *    The usage store records only numerical counters, provider, and model IDs.
 *    Raw user prompts, AI responses, photos, and personal data are NEVER stored
 *    in the daily budget ledger.
 */

const AiUsageDaily = require('../models/AiUsageDaily');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Standard AI feature keys
const VALID_AI_FEATURES = AiUsageDaily.VALID_AI_FEATURES || [
  'fitbot_chat',
  'planner_meal',
  'planner_activity',
  'food_snap',
  'food_estimate',
  'calorie_estimate',
  'voice_set',
];

// Configuration Defaults
const DEFAULT_TOKEN_BUDGET = 50000;
const DEFAULT_CALL_BUDGET = 100;
const DEFAULT_ADMIN_MULTIPLIER = 10;
const BUDGET_EXCEEDED_CODE = 'AI_DAILY_BUDGET_EXCEEDED';

// Conservative per-feature fallback floors (tokens) when upstream provider omits usage
const DEFAULT_FALLBACK_FLOORS = Object.freeze({
  fitbot_chat: 800,
  planner_meal: 1200,
  planner_activity: 1200,
  food_snap: 1500,
  food_estimate: 600,
  calorie_estimate: 500,
  voice_set: 400,
  default: 500,
});

// In-memory tracking of budget thresholds and audit logs per UTC day
let trackingDay = new Date().toISOString().slice(0, 10);
const usersAt80Percent = new Set();
const usersAt100Percent = new Set();
const usersLogged80 = new Set();
const usersLogged100 = new Set();
const usersAuditBlocked = new Set();

const resetDailyBudgetMetricsTracker = (todayStr = new Date().toISOString().slice(0, 10)) => {
  trackingDay = todayStr;
  usersAt80Percent.clear();
  usersAt100Percent.clear();
  usersLogged80.clear();
  usersLogged100.clear();
  usersAuditBlocked.clear();
  metrics.set('ai_budget_users_status', { state: 'near' }, 0);
  metrics.set('ai_budget_users_status', { state: 'exhausted' }, 0);
  metrics.set('ai_users_near_budget', {}, 0);
  metrics.set('ai_users_over_budget', {}, 0);
};

const evaluateBudgetThresholds = async ({
  userId,
  day,
  budget,
  callsUsed = 0,
  tokensUsed = 0,
  feature,
  isBlocked = false,
}) => {
  if (day !== trackingDay) {
    resetDailyBudgetMetricsTracker(day);
  }

  const uId = String(userId);
  const userKey = `${day}:${uId}`;

  const tokenRatio = budget.tokenBudget > 0 ? tokensUsed / budget.tokenBudget : 0;
  const callRatio = budget.callBudget > 0 ? callsUsed / budget.callBudget : 0;
  const maxRatio = Math.max(tokenRatio, callRatio);

  if (maxRatio >= 1.0 || isBlocked) {
    usersAt100Percent.add(uId);
    usersAt80Percent.delete(uId);

    // Requirement 2: Log once per user per day at 100%
    if (!usersLogged100.has(userKey)) {
      usersLogged100.add(userKey);
      logger.warn('ai_budget_event', {
        type: 'ai_budget_event',
        threshold: '100%',
        userId: uId,
        tokensUsed,
        tokenBudget: budget.tokenBudget,
        callsUsed,
        callBudget: budget.callBudget,
        day,
      });
    }

    // Requirement 5: Write an AuditLog entry when a user is first blocked by budget
    if (isBlocked && !usersAuditBlocked.has(userKey)) {
      usersAuditBlocked.add(userKey);
      try {
        const payload = {
          event: 'ai_budget_exceeded',
          userId: userId || undefined,
          status: 'blocked',
          details: {
            feature: feature || 'unknown',
            counts: {
              tokensUsed,
              tokenBudget: budget.tokenBudget,
              callsUsed,
              callBudget: budget.callBudget,
            },
          },
        };

        if (customAuditLogger) {
          await customAuditLogger(payload);
        } else {
          const mongoose = require('mongoose');
          if (mongoose.connection && mongoose.connection.readyState === 1) {
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create(payload);
          }
        }
      } catch (auditErr) {
        logger.warn('Failed to persist ai_budget_exceeded audit log', { error: auditErr.message });
      }
    }
  } else if (maxRatio >= 0.8) {
    if (!usersAt100Percent.has(uId)) {
      usersAt80Percent.add(uId);
    }

    // Requirement 2: Log once per user per day at 80%
    if (!usersLogged80.has(userKey)) {
      usersLogged80.add(userKey);
      logger.info('ai_budget_event', {
        type: 'ai_budget_event',
        threshold: '80%',
        userId: uId,
        tokensUsed,
        tokenBudget: budget.tokenBudget,
        callsUsed,
        callBudget: budget.callBudget,
        day,
      });
    }
  }

  // Update gauges cheaply without per-user labels
  metrics.set('ai_budget_users_status', { state: 'near' }, usersAt80Percent.size);
  metrics.set('ai_budget_users_status', { state: 'exhausted' }, usersAt100Percent.size);
  metrics.set('ai_users_near_budget', {}, usersAt80Percent.size);
  metrics.set('ai_users_over_budget', {}, usersAt100Percent.size);
};

// Pluggable model store for test isolation
let customUsageModel = null;
let customAuditLogger = null;

const setUsageModel = (model) => {
  customUsageModel = model;
};

const getUsageModel = () => customUsageModel || AiUsageDaily;

const setAuditLogger = (handler) => {
  customAuditLogger = handler;
};

/**
 * Returns the current calendar day in UTC format "YYYY-MM-DD".
 *
 * @param {Date|number|string} [dateInput=new Date()]
 * @returns {string}
 */
const getUtcDay = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return d.toISOString().slice(0, 10);
};

/**
 * Calculates the next UTC midnight Date object.
 *
 * @param {Date|number|string} [dateInput=new Date()]
 * @returns {Date}
 */
const getNextUtcMidnight = (dateInput = new Date()) => {
  const current = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  const next = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return next;
};

/**
 * Calculates remaining seconds until next UTC midnight.
 *
 * @param {Date|number|string} [dateInput=new Date()]
 * @returns {number}
 */
const getRetryAfterSeconds = (dateInput = new Date()) => {
  const now = dateInput instanceof Date ? dateInput.getTime() : new Date(dateInput).getTime();
  const nextMidnight = getNextUtcMidnight(dateInput).getTime();
  return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
};

/**
 * Resolves the failure handling mode when the usage store is unreachable.
 * Configured via AI_BUDGET_FAIL_MODE (open | closed).
 * Default is closed in production, open in other environments.
 *
 * @returns {'open'|'closed'}
 */
const getFailMode = () => {
  const configured = process.env.AI_BUDGET_FAIL_MODE?.toLowerCase();
  if (configured === 'open' || configured === 'closed') {
    return configured;
  }
  return process.env.NODE_ENV === 'production' ? 'closed' : 'open';
};

/**
 * Normalizes raw usage metadata from various upstream LLM providers.
 *
 * Supported formats:
 * 1. OpenRouter / OpenAI: { prompt_tokens, completion_tokens, total_tokens }
 * 2. Gemini usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount }
 * 3. App camelCase: { promptTokens, completionTokens, tokens / totalTokens }
 *
 * @param {Object|null|undefined} raw
 * @returns {{ promptTokens: number, completionTokens: number, tokens: number } | null}
 */
const normalizeUsage = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw.usageMetadata || raw.usage || raw;

  const promptVal = data.promptTokens ?? data.prompt_tokens ?? data.promptTokenCount;
  const completionVal = data.completionTokens ?? data.completion_tokens ?? data.candidatesTokenCount;
  const totalVal = data.totalTokens ?? data.tokens ?? data.total_tokens ?? data.totalTokenCount;

  const promptTokens =
    typeof promptVal === 'number' && Number.isFinite(promptVal) && promptVal >= 0 ? promptVal : 0;
  const completionTokens =
    typeof completionVal === 'number' && Number.isFinite(completionVal) && completionVal >= 0
      ? completionVal
      : 0;

  let tokens =
    typeof totalVal === 'number' && Number.isFinite(totalVal) && totalVal > 0 ? totalVal : 0;

  // If total tokens not explicitly provided, calculate sum if positive components exist
  if (!tokens && (promptTokens > 0 || completionTokens > 0)) {
    tokens = promptTokens + completionTokens;
  }

  // Returns null when no numeric totals exist
  if (!tokens || tokens <= 0) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    tokens,
  };
};

/**
 * Conservative cost fallback estimation when upstream provider omits usage.
 * Input tokens: estimated at ~chars / 4.
 * Output tokens: capped output estimate.
 * Guaranteed minimum: per-feature floor configurable via AI_FALLBACK_COST_TOKENS.
 * Never returns 0 tokens.
 *
 * @param {Object} params
 * @param {string} params.feature AI feature identifier
 * @param {number} [params.inputChars=0] Total characters in prompt/context
 * @param {number} [params.maxTokens] Upper bound for completion tokens
 * @returns {{ promptTokens: number, completionTokens: number, tokens: number, estimated: true }}
 */
const estimateCost = ({ feature, inputChars = 0, maxTokens }) => {
  const chars = Math.max(0, Number(inputChars) || 0);
  const promptTokens = Math.max(1, Math.ceil(chars / 4));

  // Output estimate: use maxTokens if provided, capped between 50 and 2500
  let completionTokens = 200;
  if (maxTokens !== undefined && maxTokens !== null) {
    const parsedMax = Number(maxTokens);
    if (Number.isFinite(parsedMax) && parsedMax > 0) {
      completionTokens = Math.min(Math.max(50, Math.round(parsedMax * 0.75)), 2500);
    }
  }

  // Resolve floor configuration
  let floor = DEFAULT_FALLBACK_FLOORS[feature] || DEFAULT_FALLBACK_FLOORS.default;
  if (process.env.AI_FALLBACK_COST_TOKENS) {
    const envVal = process.env.AI_FALLBACK_COST_TOKENS.trim();
    if (envVal.startsWith('{')) {
      try {
        const parsedMap = JSON.parse(envVal);
        if (parsedMap[feature] && Number.isFinite(Number(parsedMap[feature]))) {
          floor = Math.max(1, Number(parsedMap[feature]));
        } else if (parsedMap.default && Number.isFinite(Number(parsedMap.default))) {
          floor = Math.max(1, Number(parsedMap.default));
        }
      } catch (_err) {
        // Fall back to default floor
      }
    } else {
      const parsedNum = Number(envVal);
      if (Number.isFinite(parsedNum) && parsedNum > 0) {
        floor = Math.floor(parsedNum);
      }
    }
  }

  const rawTotal = promptTokens + completionTokens;
  const totalTokens = Math.max(floor, rawTotal, 1);

  // If floor forced total higher, proportionally distribute to completionTokens
  const finalCompletion = completionTokens + Math.max(0, totalTokens - rawTotal);

  return {
    promptTokens,
    completionTokens: finalCompletion,
    tokens: totalTokens,
    estimated: true,
  };
};

/**
 * Reads and resolves budget configuration for a specific user.
 * Supports environment overrides and role/admin multipliers.
 *
 * @param {Object} [user] User document or object with { isAdmin, role }
 * @returns {{
 *   tokenBudget: number,
 *   callBudget: number,
 *   featureBudgets: Record<string, number>,
 *   isAdmin: boolean,
 *   multiplier: number
 * }}
 */
const getBudgetForUser = (user = {}) => {
  let tokenBudget = DEFAULT_TOKEN_BUDGET;
  if (process.env.AI_DAILY_TOKEN_BUDGET !== undefined) {
    const parsed = Number(process.env.AI_DAILY_TOKEN_BUDGET);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logger.warn(
        `Invalid AI_DAILY_TOKEN_BUDGET "${process.env.AI_DAILY_TOKEN_BUDGET}"; falling back to default ${DEFAULT_TOKEN_BUDGET}`
      );
    } else {
      tokenBudget = Math.floor(parsed);
    }
  }

  let callBudget = DEFAULT_CALL_BUDGET;
  if (process.env.AI_DAILY_CALL_BUDGET !== undefined) {
    const parsed = Number(process.env.AI_DAILY_CALL_BUDGET);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logger.warn(
        `Invalid AI_DAILY_CALL_BUDGET "${process.env.AI_DAILY_CALL_BUDGET}"; falling back to default ${DEFAULT_CALL_BUDGET}`
      );
    } else {
      callBudget = Math.floor(parsed);
    }
  }

  const featureBudgets = {};
  if (process.env.AI_FEATURE_BUDGETS) {
    try {
      const parsed =
        typeof process.env.AI_FEATURE_BUDGETS === 'string'
          ? JSON.parse(process.env.AI_FEATURE_BUDGETS)
          : process.env.AI_FEATURE_BUDGETS;

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, val] of Object.entries(parsed)) {
          const num = Number(val);
          if (Number.isFinite(num) && num > 0) {
            featureBudgets[key] = Math.floor(num);
          } else {
            logger.warn(`Invalid per-feature budget for "${key}": ${val}, ignoring`);
          }
        }
      } else {
        logger.warn('Invalid AI_FEATURE_BUDGETS format, expected JSON object string');
      }
    } catch (err) {
      logger.warn(`Failed to parse AI_FEATURE_BUDGETS: ${err.message}`);
    }
  }

  let adminMultiplier = DEFAULT_ADMIN_MULTIPLIER;
  if (process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER !== undefined) {
    const parsed = Number(process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logger.warn(
        `Invalid AI_DAILY_BUDGET_ADMIN_MULTIPLIER "${process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER}"; falling back to default ${DEFAULT_ADMIN_MULTIPLIER}`
      );
    } else {
      adminMultiplier = parsed;
    }
  }

  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const multiplier = isAdmin ? adminMultiplier : 1;

  const resolvedFeatureBudgets = {};
  for (const [feat, limit] of Object.entries(featureBudgets)) {
    resolvedFeatureBudgets[feat] = Math.floor(limit * multiplier);
  }

  return {
    tokenBudget: Math.floor(tokenBudget * multiplier),
    callBudget: Math.floor(callBudget * multiplier),
    featureBudgets: resolvedFeatureBudgets,
    isAdmin,
    multiplier,
  };
};

/**
 * Checks remaining daily AI quota for a user and feature (READ ONLY).
 * Executed before making any external AI API calls.
 *
 * @param {Object} params
 * @param {string|Object} params.userId
 * @param {string} [params.feature]
 * @param {Object} [params.user] User object for role-based multipliers
 * @param {Object} [params.usageStore] Optional injected model/store for unit tests
 * @param {Date|string|number} [params.now] Optional timestamp override
 * @returns {Promise<{
 *   allowed: boolean,
 *   remainingTokens: number,
 *   remainingCalls: number,
 *   resetAt: string,
 *   retryAfterSeconds: number,
 *   reason: string|null
 * }>}
 */
const checkBudget = async ({ userId, feature, user, usageStore, now }) => {
  const currentTimestamp = now ? new Date(now) : new Date();
  const day = getUtcDay(currentTimestamp);
  const resetAtDate = getNextUtcMidnight(currentTimestamp);
  const resetAt = resetAtDate.toISOString();
  const retryAfterSeconds = getRetryAfterSeconds(currentTimestamp);

  const resolvedUser = user || { _id: userId };
  const budget = getBudgetForUser(resolvedUser);
  const store = usageStore || getUsageModel();

  let usageDoc;
  try {
    const query = store.findOne({ user: userId, day });
    usageDoc = query && typeof query.lean === 'function' ? await query.lean() : await query;
  } catch (err) {
    metrics.increment('ai_budget_store_errors_total');
    logger.error('Failed to query daily AI usage store', {
      userId: String(userId),
      day,
      error: err.message,
    });

    const failMode = getFailMode();
    if (failMode === 'open') {
      logger.warn('AI budget store unavailable: failing OPEN per configuration');
      return {
        allowed: true,
        remainingTokens: budget.tokenBudget,
        remainingCalls: budget.callBudget,
        resetAt,
        retryAfterSeconds,
        reason: 'STORE_UNAVAILABLE_FAIL_OPEN',
      };
    }

    logger.warn('AI budget store unavailable: failing CLOSED');
    return {
      allowed: false,
      remainingTokens: 0,
      remainingCalls: 0,
      resetAt,
      retryAfterSeconds,
      reason: 'STORE_UNAVAILABLE_FAIL_CLOSED',
    };
  }

  const callsUsed = usageDoc?.calls || 0;
  const tokensUsed = usageDoc?.tokens || 0;

  const remainingCalls = Math.max(0, budget.callBudget - callsUsed);
  const remainingTokens = Math.max(0, budget.tokenBudget - tokensUsed);

  // 1. Check global call budget
  if (callsUsed >= budget.callBudget) {
    metrics.increment('ai_budget_exhausted_total', { feature: feature || 'all' });
    metrics.increment('ai_budget_limit_hit_total', { feature: feature || 'all', reason: 'call_budget' }, 1);
    await evaluateBudgetThresholds({ userId, day, budget, callsUsed, tokensUsed, feature, isBlocked: true });
    return {
      allowed: false,
      remainingTokens,
      remainingCalls: 0,
      resetAt,
      retryAfterSeconds,
      reason: 'CALL_BUDGET_EXCEEDED',
    };
  }

  // 2. Check global token budget
  if (tokensUsed >= budget.tokenBudget) {
    metrics.increment('ai_budget_exhausted_total', { feature: feature || 'all' });
    metrics.increment('ai_budget_limit_hit_total', { feature: feature || 'all', reason: 'token_budget' }, 1);
    await evaluateBudgetThresholds({ userId, day, budget, callsUsed, tokensUsed, feature, isBlocked: true });
    return {
      allowed: false,
      remainingTokens: 0,
      remainingCalls,
      resetAt,
      retryAfterSeconds,
      reason: 'TOKEN_BUDGET_EXCEEDED',
    };
  }

  // 3. Check per-feature token budget if configured
  if (feature && budget.featureBudgets[feature] !== undefined) {
    const featureLimit = budget.featureBudgets[feature];
    const featureDoc = usageDoc?.features?.[feature] ||
      (typeof usageDoc?.features?.get === 'function' ? usageDoc.features.get(feature) : null);
    const featureTokensUsed = featureDoc?.tokens || 0;
    const remainingFeatureTokens = Math.max(0, featureLimit - featureTokensUsed);

    if (featureTokensUsed >= featureLimit) {
      metrics.increment('ai_budget_exhausted_total', { feature });
      metrics.increment('ai_budget_limit_hit_total', { feature, reason: 'feature_budget' }, 1);
      await evaluateBudgetThresholds({ userId, day, budget, callsUsed, tokensUsed, feature, isBlocked: true });
      return {
        allowed: false,
        remainingTokens: Math.min(remainingTokens, 0),
        remainingCalls,
        resetAt,
        retryAfterSeconds,
        reason: 'FEATURE_BUDGET_EXCEEDED',
      };
    }

    await evaluateBudgetThresholds({ userId, day, budget, callsUsed, tokensUsed, feature, isBlocked: false });
    return {
      allowed: true,
      remainingTokens: Math.min(remainingTokens, remainingFeatureTokens),
      remainingCalls,
      resetAt,
      retryAfterSeconds,
      reason: null,
    };
  }

  await evaluateBudgetThresholds({ userId, day, budget, callsUsed, tokensUsed, feature, isBlocked: false });
  return {
    allowed: true,
    remainingTokens,
    remainingCalls,
    resetAt,
    retryAfterSeconds,
    reason: null,
  };
};

/**
 * Records AI usage atomically into the daily ledger using $inc and upsert.
 * Race-safe under concurrent requests: catches duplicate key error (code 11000)
 * on simultaneous insert and retries the atomic update once.
 *
 * @param {Object} params
 * @param {string|Object} params.userId
 * @param {string} params.feature AI feature identifier
 * @param {string} [params.provider='unknown']
 * @param {string} [params.model='unknown']
 * @param {Object} [params.usage] Raw or normalized usage metadata
 * @param {string|number} [params.status='success'] Request outcome ('success', 'failure', 'timeout', HTTP code)
 * @param {number} [params.latencyMs=0] Response latency
 * @param {number} [params.inputChars=0] Fallback input characters for estimation
 * @param {number} [params.maxTokens] Fallback max tokens for estimation
 * @param {Object} [params.usageStore] Injected model/store
 * @param {Date|string|number} [params.now] Timestamp override
 * @returns {Promise<Object>}
 */
const recordUsage = async ({
  userId,
  feature,
  provider = 'unknown',
  model = 'unknown',
  usage,
  status = 'success',
  latencyMs = 0,
  inputChars = 0,
  maxTokens,
  usageStore,
  now,
}) => {
  const currentTimestamp = now ? new Date(now) : new Date();
  const day = getUtcDay(currentTimestamp);
  const store = usageStore || getUsageModel();

  // Normalize usage or conservatively estimate if missing
  let normalized = normalizeUsage(usage);
  let isEstimated = false;

  if (!normalized) {
    normalized = estimateCost({ feature, inputChars, maxTokens });
    isEstimated = true;
  }

  const isTimeout = status === 'timeout' || status === 408 || status === 504;
  const isFailure =
    status === 'failure' ||
    status === 'error' ||
    (typeof status === 'number' && status >= 400 && status !== 429);

  const callsCount =
    typeof usage?.callsCount === 'number' && usage.callsCount > 0 ? usage.callsCount : 1;
  const incTimeouts = usage?.timeouts ?? (isTimeout ? 1 : 0);
  const incFailures = usage?.failures ?? (isFailure ? 1 : 0);
  const incEstimated = usage?.estimatedCalls ?? (isEstimated ? 1 : 0);
  const incUnknown = usage?.unknownUsageCalls ?? (isEstimated ? 1 : 0);

  // Build atomic increment updates
  const inc = {
    calls: callsCount,
    tokens: normalized.tokens,
    promptTokens: normalized.promptTokens,
    completionTokens: normalized.completionTokens,
    estimatedCalls: incEstimated,
    unknownUsageCalls: incUnknown,
    timeouts: incTimeouts,
    failures: incFailures,
  };

  if (feature) {
    inc[`features.${feature}.calls`] = callsCount;
    inc[`features.${feature}.tokens`] = normalized.tokens;
    inc[`features.${feature}.promptTokens`] = normalized.promptTokens;
    inc[`features.${feature}.completionTokens`] = normalized.completionTokens;
    inc[`features.${feature}.estimatedCalls`] = incEstimated;
    inc[`features.${feature}.unknownUsageCalls`] = incUnknown;
    inc[`features.${feature}.timeouts`] = incTimeouts;
    inc[`features.${feature}.failures`] = incFailures;
  }

  const expiresAt = AiUsageDaily.calculateDayExpiry
    ? AiUsageDaily.calculateDayExpiry(day)
    : new Date(Date.now() + 35 * 86400 * 1000);

  const executeAtomicUpdate = async () => {
    return await store.findOneAndUpdate(
      { user: userId, day },
      {
        $setOnInsert: { user: userId, day, expiresAt },
        $inc: inc,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  };

  let record;
  try {
    record = await executeAtomicUpdate();
  } catch (err) {
    // Handle concurrent upsert duplicate-key race (E11000) by retrying once
    if (err.code === 11000 || String(err.message).includes('E11000')) {
      record = await executeAtomicUpdate();
    } else {
      metrics.increment('ai_budget_store_errors_total');
      logger.error('Failed to record AI daily usage', {
        userId: String(userId),
        feature,
        error: err.message,
      });
      throw err;
    }
  }

  // Record Prometheus metrics
  try {
    metrics.increment('ai_tokens_total', {
      feature: feature || 'unknown',
      provider: provider || 'unknown',
      type: 'prompt',
      estimated: String(isEstimated),
    }, normalized.promptTokens);

    metrics.increment('ai_tokens_total', {
      feature: feature || 'unknown',
      provider: provider || 'unknown',
      type: 'completion',
      estimated: String(isEstimated),
    }, normalized.completionTokens);

    metrics.increment('ai_budget_usage_recorded_total', {
      feature: feature || 'unknown',
      provider: provider || 'unknown',
      estimated: String(isEstimated),
    });
    metrics.increment('ai_tokens_consumed_total', {
      feature: feature || 'unknown',
      provider: provider || 'unknown',
    }, normalized.tokens);
  } catch (_e) {
    // Non-blocking metrics
  }

  if (record) {
    try {
      const budget = getBudgetForUser({ _id: userId });
      await evaluateBudgetThresholds({
        userId,
        day,
        budget,
        callsUsed: record.calls || 0,
        tokensUsed: record.tokens || 0,
        feature,
        isBlocked: (record.calls || 0) >= budget.callBudget || (record.tokens || 0) >= budget.tokenBudget,
      });
    } catch (_e) {}
  }

  return record;
};

/**
 * Builds the standard HTTP 429 error response payload for budget exhaustion.
 * Adheres strictly to the repo's sendError shape with extra retryAfterSeconds.
 *
 * @param {Object} checkResult Result from checkBudget
 * @param {string} [customMessage]
 * @returns {{ status: number, headers: Record<string, string>, body: Object }}
 */
const buildBudgetExceededResponse = (checkResult, customMessage) => {
  const retryAfterSeconds = checkResult?.retryAfterSeconds ?? 86400;
  const remainingTokens = checkResult?.remainingTokens ?? 0;
  const remainingCalls = checkResult?.remainingCalls ?? 0;
  const resetAt = checkResult?.resetAt || getNextUtcMidnight().toISOString();
  const message =
    customMessage ||
    `Daily AI budget exceeded (${checkResult?.reason || 'LIMIT_REACHED'}). Your budget will reset at midnight UTC.`;

  return {
    status: 429,
    headers: {
      'Retry-After': String(retryAfterSeconds),
      'X-RateLimit-Reset': resetAt,
      'X-AI-Budget-Remaining-Tokens': String(remainingTokens),
      'X-AI-Budget-Remaining-Calls': String(remainingCalls),
    },
    body: {
      message,
      retryAfterSeconds,
      remainingTokens,
      remainingCalls,
      resetAt,
      error: {
        message,
        code: BUDGET_EXCEEDED_CODE,
        retryAfterSeconds,
        remainingTokens,
        remainingCalls,
        reason: checkResult?.reason || 'BUDGET_EXCEEDED',
        resetAt,
      },
    },
  };
};

/**
 * Express-compatible decision response helper that sends the HTTP 429 budget error.
 *
 * @param {import('express').Response} res
 * @param {Object} checkResult
 * @param {string} [customMessage]
 */
const sendBudgetExceeded = (res, checkResult, customMessage) => {
  const { status, headers, body } = buildBudgetExceededResponse(checkResult, customMessage);
  for (const [key, val] of Object.entries(headers)) {
    res.set(key, val);
  }
  return res.status(status).json(body);
};

module.exports = {
  VALID_AI_FEATURES,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_CALL_BUDGET,
  DEFAULT_ADMIN_MULTIPLIER,
  BUDGET_EXCEEDED_CODE,
  DEFAULT_FALLBACK_FLOORS,
  setUsageModel,
  getUsageModel,
  getUtcDay,
  getNextUtcMidnight,
  getRetryAfterSeconds,
  getFailMode,
  normalizeUsage,
  estimateCost,
  getBudgetForUser,
  checkBudget,
  recordUsage,
  buildBudgetExceededResponse,
  sendBudgetExceeded,
  resetDailyBudgetMetricsTracker,
  setAuditLogger,
};

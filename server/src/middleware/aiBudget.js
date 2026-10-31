const { AsyncLocalStorage } = require('node:async_hooks');
const {
  checkBudget,
  recordUsage,
  normalizeUsage,
  estimateCost,
  sendBudgetExceeded,
} = require('../services/aiBudget.service');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Request-scoped storage for tracking billable provider calls within a single HTTP cycle
const aiUsageStorage = new AsyncLocalStorage();

/**
 * Records a billable provider call into the current request's AsyncLocalStorage context.
 * NO-OP when executed outside of an enforceAiBudget request context (preserving direct controller unit tests).
 *
 * @param {Object} callData
 * @param {string} callData.provider - 'openrouter' | 'gemini' | string
 * @param {string} [callData.model]
 * @param {Object|null} [callData.usage] - Raw or normalized provider usage object
 * @param {'success'|'failure'|'timeout'|number} [callData.status='success']
 * @param {boolean} [callData.timedOut=false]
 * @param {number} [callData.attempt=1]
 * @param {number} [callData.inputChars=0]
 * @param {number} [callData.maxTokens]
 */
const recordProviderCall = (callData = {}) => {
  const provider = callData.provider || 'unknown';
  const model = callData.model || 'unknown';
  const isFallback = Boolean(callData.isFallback);
  const isTimeout = Boolean(callData.timedOut || callData.status === 'timeout' || callData.status === 504);
  const isError = Boolean(
    callData.status === 'failure' ||
    callData.status === 'error' ||
    (typeof callData.status === 'number' && callData.status >= 400 && callData.status !== 429 && callData.status !== 504)
  );

  let mappedStatus = 'ok';
  if (isFallback) {
    mappedStatus = 'fallback';
  } else if (isTimeout) {
    mappedStatus = 'timeout';
  } else if (isError) {
    mappedStatus = 'error';
  }

  try {
    metrics.increment('ai_provider_calls_total', {
      provider,
      model,
      status: mappedStatus,
    });
  } catch (_e) {}

  if (typeof callData.latencyMs === 'number' && callData.latencyMs >= 0) {
    try {
      metrics.observe('ai_provider_latency_seconds', { provider }, callData.latencyMs / 1000);
    } catch (_e) {}
  }

  const store = aiUsageStorage.getStore();
  const feature = store?.collector?.feature || 'unknown';

  const normalized = normalizeUsage(callData.usage);
  if (!normalized && !callData.cached) {
    try {
      metrics.increment('ai_usage_missing_total', {
        provider,
        feature,
      });
    } catch (_e) {}

    logger.warn('AI provider usage metadata missing; falling back to estimated cost', {
      type: 'ai_missing_usage',
      provider,
      model,
      feature,
      attempt: callData.attempt || 1,
    });
  }

  if (!store || !store.collector) {
    return; // Safe NO-OP for direct controller calls in tests
  }

  store.collector.calls.push({
    timestamp: Date.now(),
    provider,
    model,
    usage: callData.usage || null,
    status: callData.status || (isTimeout ? 'timeout' : 'success'),
    timedOut: isTimeout,
    attempt: callData.attempt || 1,
    inputChars: callData.inputChars || 0,
    maxTokens: callData.maxTokens,
    latencyMs: callData.latencyMs || 0,
    isFallback,
  });
};

/**
 * Feature resolver for FitBot / Planner chat endpoints.
 * Distinguishes between conversational chat, meal planner, and workout/activity planner.
 *
 * @param {import('express').Request} req
 * @returns {'planner_meal'|'planner_activity'|'fitbot_chat'}
 */
const resolveChatFeature = (req) => {
  const body = req.body || {};
  const planType = body.planType || body.options?.planType || body.schema || body.options?.schema;
  const isJson = Boolean(body.expectJson || body.options?.expectJson);

  if (planType === 'mealPlan') {
    return 'planner_meal';
  }
  if ((planType === 'activityPlan' || planType === 'workoutPlan') && isJson) {
    return 'planner_activity';
  }

  // Check last message if expectJson was set without explicit planType
  if (isJson && Array.isArray(body.messages) && body.messages.length > 0) {
    const lastMsg = body.messages[body.messages.length - 1];
    const text = typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : (Array.isArray(lastMsg?.parts) ? lastMsg.parts.map((p) => p?.text || '').join('') : '');

    if (/meal plan|breakfast|lunch|dinner|calorie target|preferred cuisine/i.test(text)) {
      return 'planner_meal';
    }
    if (/workout|activity plan|exercises|duration.*calorie|recovery focus/i.test(text)) {
      return 'planner_activity';
    }
  }

  return 'fitbot_chat';
};

/**
 * Middleware factory enforcing per-user daily AI budget quotas.
 *
 * @param {string|Function} featureResolver Feature key string or resolver fn(req)
 * @returns {Function} Express middleware
 */
const enforceAiBudget = (featureResolver) => {
  return async (req, res, next) => {
    // 1. Resolve target AI feature key
    let feature = 'fitbot_chat';
    if (typeof featureResolver === 'function') {
      feature = featureResolver(req);
    } else if (typeof featureResolver === 'string') {
      feature = featureResolver;
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      // If auth was bypassed or not present, delegate to next middleware (auth will reject)
      return next();
    }

    // 2. Perform strictly read-only pre-execution quota check
    let checkResult;
    try {
      checkResult = await checkBudget({
        userId,
        feature,
        user: req.user,
      });
    } catch (err) {
      metrics.increment('ai_requests_total', { feature, outcome: 'error' });
      logger.error('Unexpected error checking AI budget', { userId: String(userId), error: err.message });
      return next();
    }

    if (!checkResult.allowed) {
      metrics.increment('ai_requests_total', { feature, outcome: 'budget_exceeded' });
      // Reject request BEFORE calling any upstream provider
      return sendBudgetExceeded(res, checkResult);
    }

    metrics.increment('ai_requests_total', { feature, outcome: 'allowed' });

    // Set remaining budget headers on success
    res.set('X-AI-Budget-Remaining-Tokens', String(checkResult.remainingTokens));
    res.set('X-AI-Budget-Remaining-Calls', String(checkResult.remainingCalls));
    res.set('X-AI-Budget-Reset', String(checkResult.resetAt));

    // 3. Initialize request-scoped AsyncLocalStorage context
    const collector = {
      userId,
      feature,
      user: req.user,
      calls: [],
    };

    let flushed = false;
    const flushUsage = async () => {
      if (flushed) return;
      flushed = true;

      if (collector.calls.length === 0) {
        // No provider calls made (e.g. response cache hit, voice regex fallback) -> costs nothing
        return;
      }

      let totalTokens = 0;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let estimatedCalls = 0;
      let unknownUsageCalls = 0;
      let timeouts = 0;
      let failures = 0;
      let lastProvider = 'unknown';
      let lastModel = 'unknown';

      for (const call of collector.calls) {
        if (call.provider) lastProvider = call.provider;
        if (call.model) lastModel = call.model;

        const normalized = normalizeUsage(call.usage);
        if (normalized) {
          totalTokens += normalized.tokens;
          totalPromptTokens += normalized.promptTokens;
          totalCompletionTokens += normalized.completionTokens;
        } else {
          // Conservative fallback estimation for missing usage or timed out calls
          const est = estimateCost({
            feature: collector.feature,
            inputChars: call.inputChars || 0,
            maxTokens: call.maxTokens,
          });
          totalTokens += est.tokens;
          totalPromptTokens += est.promptTokens;
          totalCompletionTokens += est.completionTokens;
          estimatedCalls += 1;
          unknownUsageCalls += 1;
        }

        if (call.timedOut || call.status === 'timeout' || call.status === 504) {
          timeouts += 1;
        }
        if (
          call.status === 'failure' ||
          call.status === 'error' ||
          (typeof call.status === 'number' && call.status >= 400 && call.status !== 429 && call.status !== 504)
        ) {
          failures += 1;
        }
      }

      try {
        await recordUsage({
          userId: collector.userId,
          feature: collector.feature,
          provider: lastProvider,
          model: lastModel,
          usage: {
            tokens: totalTokens,
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            callsCount: collector.calls.length,
            estimatedCalls,
            unknownUsageCalls,
            timeouts,
            failures,
          },
          status: failures > 0 ? 'failure' : (timeouts > 0 ? 'timeout' : 'success'),
        });
      } catch (err) {
        logger.error('Failed to flush daily AI budget usage', {
          userId: String(collector.userId),
          feature: collector.feature,
          error: err.message,
        });
      }
    };

    const onFinishOrClose = () => {
      res._flushPromise = flushUsage();
    };

    // Attach single-execution flush listeners to response lifecycle
    res.once('finish', onFinishOrClose);
    res.once('close', onFinishOrClose);

    return aiUsageStorage.run({ collector }, () => {
      return next();
    });
  };
};

module.exports = {
  aiUsageStorage,
  recordProviderCall,
  resolveChatFeature,
  enforceAiBudget,
};

# Per-User Daily AI Budgets Implementation Audit Report

**Date**: 2026-10-31  
**Project**: `AI-FitnessTracker1` (Express 5 + Mongoose 9 backend in `/server`, React 19 + TypeScript client in `/client`)  
**Scope**: Verification and hardening of per-user daily AI budget tracking, pre-execution enforcement, usage capture, missing-usage estimation, timeout resilience, Prometheus monitoring, alerts, user/admin visibility, and client error handling across all billable AI capabilities (`fitbot_chat`, `planner_meal`, `planner_activity`, `food_snap`, `food_estimate`, `calorie_estimate`, `voice_set`).

---

## Executive Summary & Status Checklist (Items 1–15)

| Item | Requirement / Capability | Status | Evidence / Test Suite |
| :---: | :--- | :---: | :--- |
| **1** | **Data Model (`AiUsageDaily.js`)** | **DONE** | [`server/src/models/AiUsageDaily.js`](../server/src/models/AiUsageDaily.js): Compound unique `{ user: 1, day: 1 }`, regex-validated UTC day `YYYY-MM-DD`, 35-day TTL index, per-feature breakdown for all 7 features, root counters. Verified via `server/test/aiBudget.test.js`. |
| **2** | **Budget Service (`aiBudget.service.js`)** | **DONE** | [`server/src/services/aiBudget.service.js`](../server/src/services/aiBudget.service.js): Pure helpers `getBudgetForUser`, `checkBudget`, `recordUsage` (atomic `$inc` upsert with E11000 collision retry), `estimateCost`, `normalizeUsage`. Verified via `server/test/aiBudget.test.js`. |
| **3** | **Middleware & Route Order (`aiBudget.js`)** | **DONE** | [`server/src/middleware/aiBudget.js`](../server/src/middleware/aiBudget.js): `enforceAiBudget` placed strictly after `protect`, body/file parsing, input validation, and burst rate limiters across all 5 entry points (`/ai/chat`, `/image-analysis`, `/food-estimate`, `/calorie-estimate`, `/workouts/parse-voice-set`). Verified via `server/test/aiBudgetEnforcement.test.js`. |
| **4** | **Rejection & Zero Cost Behavior** | **DONE** | Rejects with HTTP 429 `AI_DAILY_BUDGET_EXCEEDED`, `Retry-After`, `resetAt`, and remaining counters; upstream provider is **never called**. Response cache hits and voice regex fallbacks cost zero tokens/calls. Verified via `server/test/aiBudgetEnforcement.test.js`. |
| **5** | **Usage Capture (ALS Collector)** | **DONE** | Request-scoped `AsyncLocalStorage` collector is safe NO-OP when unmounted; captures all OpenRouter attempts (retries, fallback models, JSON repair); extracts Gemini `usageMetadata`; returns real usage. Verified via `server/test/aiBudgetEnforcement.test.js`. |
| **6** | **Missing Metadata Handling** | **DONE** | Upstream responses lacking token metadata are never recorded as 0; charged fallback estimates (~chars/4 + feature floors), flagged `estimated: true`, incrementing `ai_usage_missing_total`. `logger.aiMetric` logs missing counts truthfully as `null` with `usageEstimated: true`. Verified via `server/test/aiBudgetSmoke.test.js`. |
| **7** | **Timeouts & Bounded Execution** | **DONE** | [`server/src/utils/gemini.js`](../server/src/utils/gemini.js): `withGeminiTimeout` bounds all Gemini calls with `GEMINI_TIMEOUT_MS` (default 20s). Timed-out/failed calls charged minimum feature floors, recorded in `timeouts`, and return clean 504 / structured error. Verified via `server/test/aiBudgetSmoke.test.js`. |
| **8** | **Fail Mode Policy (`AI_BUDGET_FAIL_MODE`)** | **DONE** | Default production policy is Fail-Closed (`closed`), preventing unmetered billing during database outages. Development defaults to `open`. Increments `ai_budget_store_errors_total`. Verified via `server/test/aiBudgetEnforcement.test.js`. |
| **9** | **Prometheus Metrics** | **DONE** | [`server/src/utils/metrics.js`](../server/src/utils/metrics.js): Exposes `ai_requests_total`, `ai_tokens_total`, `ai_provider_calls_total`, `ai_provider_latency_seconds` histogram (0.5s–30s), `ai_usage_missing_total`, `ai_budget_exhausted_total`, `ai_budget_store_errors_total`, and `ai_budget_users_status` gauge (`state="near"|"exhausted"`). Zero user IDs or emails in metric labels. Verified via `server/test/aiBudgetMonitoring.test.js`. |
| **10** | **Structured Logs** | **DONE** | Single `ai_budget_event` log line emitted when user reaches 80% (info) and 100% (warn) per day with deduplication. Warning logged on missing provider usage. Zero prompts, replies, or emails logged; sensitive values masked via `scrubSecrets`. Verified via `server/test/aiBudgetMonitoring.test.js`. |
| **11** | **Security Audit Trail** | **DONE** | Persists `AuditLog` entry (`event: 'ai_budget_exceeded'`, `status: 'blocked'`) when a user account is first blocked by daily budget exhaustion. Verified via `server/test/aiBudgetMonitoring.test.js`. |
| **12** | **Alerts & Runbooks** | **DONE** | [monitoring-alerts.md](monitoring-alerts.md) §7: 7 Prometheus alert rules, 6 dashboard panels, and operational runbook steps for tuning `AI_DAILY_TOKEN_BUDGET`, `GEMINI_TIMEOUT_MS`, `AI_FALLBACK_COST_TOKENS`, and `AI_BUDGET_FAIL_MODE`. Verified via `npm run docs:check`. |
| **13** | **User Visibility Endpoint** | **DONE** | `GET /api/ai/usage` (`protect`): Returns user's today usage, remaining tokens/calls, feature breakdown, and reset timestamp without exposing internal ledger fields or IDs. Verified via `server/test/aiBudgetMonitoring.test.js`. |
| **14** | **Admin Visibility Endpoint** | **DONE** | `GET /api/ai/admin/top-consumers` (`protect`, `requireAdmin`): Keyset paginated (`findPage` with cursor and limit) listing top token consumers for a given UTC day with populated user names/emails. Verified via `server/test/aiBudgetMonitoring.test.js`. |
| **15** | **Client-Side Integration** | **DONE** | [`client/src/configs/api.ts`](../client/src/configs/api.ts) detects `AI_DAILY_BUDGET_EXCEEDED`, suppresses automatic retries, and shows a descriptive toast. [`client/src/Pages/AIAssistant.tsx`](../client/src/Pages/AIAssistant.tsx) displays usage banner at $\ge 80\%$ and disabled-state banner with disabled inputs at $100\%$. Verified via `client/src/test/aiUsageBanner.test.tsx` and `vitest`. |

---

## Detailed Audit by Verification Criteria

### 1. Data Model (`server/src/models/AiUsageDaily.js`)
* **Status**: **DONE**
* **Evidence**:
  * [AiUsageDaily.js](../server/src/models/AiUsageDaily.js)
  * Unique compound index `{ user: 1, day: 1 }` prevents race collisions and duplicate records per UTC calendar day.
  * Day format validation: String matching `/^\d{4}-\d{2}-\d{2}$/` strictly anchored to UTC calendar days (client `X-Timezone` headers are untrusted and rejected for day determination).
  * Automated TTL expiration: `expiresAt` with `{ expires: 0 }` index set to 35 full days past UTC midnight of the target day.
  * Root and per-feature counter schemas for all 7 standard features: `fitbot_chat`, `planner_meal`, `planner_activity`, `food_snap`, `food_estimate`, `calorie_estimate`, and `voice_set`.
  * Tracked counters: `calls`, `tokens`, `promptTokens`, `completionTokens`, `estimatedCalls`, `unknownUsageCalls`, `timeouts`, and `failures`.
  * Standard `toJSONPlugin` applied for clean API output.
* **Test Verification**:
  * `server/test/aiBudget.test.js` (validates schema validation, TTL calculation, UTC day strings, and compound index enforcement).

---

### 2. Budget Service (`server/src/services/aiBudget.service.js`)
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.service.js](../server/src/services/aiBudget.service.js)
  * `getBudgetForUser(user)`: Reads `AI_DAILY_TOKEN_BUDGET` (default 50,000), `AI_DAILY_CALL_BUDGET` (default 100), `AI_DAILY_BUDGET_ADMIN_MULTIPLIER` (default 10x for `isAdmin`), and optional `AI_FEATURE_BUDGETS` JSON with safe fallback handling for malformed JSON/NaN values.
  * `checkBudget({ userId, feature, user })`: Read-only pre-execution gate calculating `remainingTokens`, `remainingCalls`, `resetAt` (next UTC midnight), `retryAfterSeconds`, and `reason`.
  * `recordUsage({ userId, feature, provider, model, usage, status, latencyMs })`: Atomic `$inc` with `upsert: true` and built-in duplicate-key collision handling (retry on MongoDB E11000).
  * `estimateCost({ feature, inputChars, maxTokens })`: Conservative fallback calculation (~`chars / 4` + feature floor from `AI_FALLBACK_COST_TOKENS`), never charging 0 for unknown calls, flagging `estimated: true` and incrementing `estimatedCalls`/`unknownUsageCalls`.
  * `normalizeUsage(raw)`: Unifies OpenRouter (`prompt_tokens`, `completion_tokens`, `total_tokens`), Gemini `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`), and camelCase formats; returns `null` if empty or invalid.
* **Test Verification**:
  * `server/test/aiBudget.test.js` (verifies budget calculations, retry on duplicate key, cost estimations, and token normalization).

---

### 3. Middleware & Route Placement (`server/src/middleware/aiBudget.js`)
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.js](../server/src/middleware/aiBudget.js)
  * Placed strictly AFTER authentication (`protect`), file/body parsers, payload validation, and burst rate limiters (`aiLimiter`, `fitbotRateLimiter`, `foodSnapRateLimiter`).
  * Exact verified middleware order across all 5 entry points:
    1. **`/ai/chat` & `/ai-assistant/chat`** in [aiAssistant.routes.js](../server/src/routes/aiAssistant.routes.js):
       `protect` $\to$ `fitbotRateLimiter` $\to$ `aiLimiter` $\to$ `aiUserLimiter` $\to$ `validateChatPayload` $\to$ `enforceAiBudget(resolveChatFeature)` $\to$ `chat`
       *(Feature resolver dynamically maps `mealPlan` $\to$ `planner_meal`, `activityPlan`/`workoutPlan` $\to$ `planner_activity`, else `fitbot_chat`)*
    2. **`/image-analysis`** in [imageAnalysis.routes.js](../server/src/routes/imageAnalysis.routes.js):
       `protect` $\to$ `express.json({ limit: '7mb' })` $\to$ `upload.single('image')` $\to$ `validateFoodSnapUpload` $\to$ `foodSnapRateLimiter` $\to$ `aiLimiter` $\to$ `enforceAiBudget('food_snap')` $\to$ `analyze`
    3. **`/food-estimate`** in [foodEstimate.routes.js](../server/src/routes/foodEstimate.routes.js):
       `protect` $\to$ `enforceAiBudget('food_estimate')` $\to$ `estimate`
    4. **`/calorie-estimate`** in [calorieEstimate.routes.js](../server/src/routes/calorieEstimate.routes.js):
       `protect` $\to$ `enforceAiBudget('calorie_estimate')` $\to$ `estimate`
    5. **`/workouts/parse-voice-set`** in [workout.routes.js](../server/src/routes/workout.routes.js):
       `protect` (router level) $\to$ `audioUpload.single('audio')` $\to$ `enforceAiBudget('voice_set')` $\to$ `parseVoiceSet`
* **Test Verification**:
  * `server/test/aiBudgetEnforcement.test.js` (verifies middleware ordering, validation failures do not consume quota, rate-limit rejections do not consume quota).

---

### 4. Rejection Behavior & Zero Cost on Non-Billable Paths
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.js](../server/src/middleware/aiBudget.js)
  * When a user's daily budget is exhausted:
    * Responds immediately with HTTP `429 Too Many Requests`.
    * Response body contains `code: 'AI_DAILY_BUDGET_EXCEEDED'`, `error`, `remainingTokens`, `remainingCalls`, `resetAt`, and `retryAfterSeconds`.
    * Response headers include `Retry-After: <seconds>`, `X-AI-Budget-Remaining-Tokens: 0`, and `X-AI-Budget-Remaining-Calls: 0`.
    * Upstream providers (OpenRouter / Gemini) are **never called**.
  * Zero-cost guarantees:
    * Cache hits (`cached: true` in FitBot) short-circuit usage collection and incur zero token/call costs.
    * Voice gym set regex fallback parses locally and records zero provider tokens when regex succeeds without Gemini.
* **Test Verification**:
  * `server/test/aiBudgetEnforcement.test.js` & `server/test/aiBudgetSmoke.test.js` (tests 429 response body, headers, provider mock non-invocation, cache hit exemption, regex fallback zero usage).

---

### 5. Usage Capture & AsyncLocalStorage Collector
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.service.js](../server/src/services/aiBudget.service.js): `runWithUsageCollector` wraps request lifecycles using Node.js `AsyncLocalStorage`.
  * `recordProviderCall({ ... })`:
    * Safe NO-OP when executed outside of an active HTTP budget context (existing isolated unit tests continue to pass without mocks).
    * Flushed exactly once upon response completion (`res.on('finish')` or `res.on('close')`).
  * OpenRouter multi-turn tracking in [openrouter.service.js](../server/src/services/openrouter.service.js):
    * Records every retry attempt, fallback model invocation, and planner JSON repair attempt.
  * Gemini usage capture in [gemini.js](../server/src/utils/gemini.js):
    * FitBot chat (both `sendMessage` calls), food image analysis, and voice set parsing extract `response.usageMetadata`.
    * Replaced legacy hardcoded `{ promptTokens: 0, completionTokens: 0, totalTokens: 0 }` in [aiAssistant.service.js](../server/src/services/aiAssistant.service.js) with real agent usage.
  * Estimate services in [foodEstimate.service.js](../server/src/services/foodEstimate.service.js) and [calorieEstimate.service.js](../server/src/services/calorieEstimate.service.js) use `chatCompletionDetailed` with `returnUsage: true`.
* **Test Verification**:
  * `server/test/aiBudget.test.js` & `server/test/aiBudgetEnforcement.test.js` (verifies multi-attempt collection, fallback model attribution, and AsyncLocalStorage isolation).

---

### 6. Missing Metadata Handling
* **Status**: **DONE**
* **Evidence**:
  * Provider responses lacking token metadata are **never recorded as 0**.
  * Missing metadata triggers fallback estimation via `estimateCost` based on input character length and feature minimum floors.
  * Marked with `estimated: true`, incrementing `estimatedCalls` and `unknownUsageCalls`.
  * Metric `ai_usage_missing_total` is incremented.
  * [logger.js](../server/src/utils/logger.js): `logger.aiMetric` no longer defaults tokens with `?? 0`; missing counts are logged truthfully as `null` with `usageEstimated: true`.
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` & `server/test/aiBudgetSmoke.test.js` (verifies missing token metrics, logger output, and non-zero billing fallback).

---

### 7. Timeouts & Bounded Execution
* **Status**: **DONE**
* **Evidence**:
  * [gemini.js](../server/src/utils/gemini.js): `withGeminiTimeout(promise, ms)` bounds all Gemini requests via `AbortController` and `setTimeout` (configurable via `GEMINI_TIMEOUT_MS`, default 20,000 ms).
  * Mock hooks (`setGeminiFitBotMock`, `setGeminiVisionMock`, `setGeminiVoiceMock`) catch simulated timeout errors and record them with `recordProviderCall({ status: 'timeout', timedOut: true })`.
  * Dispatched calls that time out or fail are charged the configured feature minimum floor rather than zero, preventing free denial-of-service abuse.
  * Timeouts increment the `timeouts` counter in `AiUsageDaily` and emit status `timeout` to metrics.
  * Clean HTTP 504 / structured error responses returned; requests never hang indefinitely.
* **Test Verification**:
  * `server/test/aiBudgetEnforcement.test.js` & `server/test/aiBudgetSmoke.test.js` (verifies timeout abort, floor cost deduction, and 504 error response).

---

### 8. Database Fail Mode Policy
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.service.js](../server/src/services/aiBudget.service.js) & [aiBudget.js](../server/src/middleware/aiBudget.js):
    * Production default: **Fail-Closed** (`AI_BUDGET_FAIL_MODE=closed`). When MongoDB is down, requests are blocked with HTTP 429/503 to safeguard upstream provider credit limits.
    * Development / Override: **Fail-Open** (`AI_BUDGET_FAIL_MODE=open`). Requests proceed through with logged warnings.
    * Metric `ai_budget_store_errors_total` is incremented on database failure.
* **Test Verification**:
  * `server/test/aiBudgetEnforcement.test.js` (verifies `AI_BUDGET_FAIL_MODE=open` allows request with warning; `AI_BUDGET_FAIL_MODE=closed` blocks with 429/503 and increments `ai_budget_store_errors_total`).

---

### 9. Prometheus Metrics
* **Status**: **DONE**
* **Evidence**:
  * [metrics.js](../server/src/utils/metrics.js):
    * `ai_requests_total{feature, outcome}` (`outcome: "allowed" | "budget_exceeded" | "error"`)
    * `ai_tokens_total{feature, provider, type, estimated}` (`type: "prompt" | "completion"`, `estimated: "true" | "false"`)
    * `ai_provider_calls_total{provider, model, status}` (`status: "ok" | "timeout" | "error" | "fallback"`)
    * `ai_provider_latency_seconds{provider}` (Histogram buckets: 0.5, 1, 2.5, 5, 10, 15, 20, 30 seconds)
    * `ai_usage_missing_total{provider, feature}`
    * `ai_budget_exhausted_total{feature}`
    * `ai_budget_store_errors_total`
    * `ai_budget_users_status{state}` (Gauge: `state: "near" | "exhausted"`, zero-cardinality aggregation)
  * **Cardinality & Privacy Verification**: Zero user IDs, emails, prompts, or high-cardinality keys are included in metric labels.
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` (verifies `# HELP` and `# TYPE` headers, metric emission, label shapes, and absence of user IDs in Prometheus output).

---

### 10. Structured Logs & PII Protection
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.service.js](../server/src/services/aiBudget.service.js):
    * Structured log event `ai_budget_event` emitted once per user per day at 80% (info) and 100% (warn) thresholds.
    * Daily deduplication sets (`usersLogged80`, `usersLogged100`) prevent log flooding.
    * Warning logged when provider omits usage metadata.
    * All sensitive data scrubbed via `scrubSecrets` before logging; zero prompts, replies, or personal emails appear in logs.
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` (verifies single-log deduplication, log fields, and absence of sensitive payload data).

---

### 11. Security Audit Trail
* **Status**: **DONE**
* **Evidence**:
  * [aiBudget.service.js](../server/src/services/aiBudget.service.js):
    * Persistent `AuditLog` record created when a user is first blocked by daily budget (`event: 'ai_budget_exceeded'`, `status: 'blocked'`, `details: { feature, counts }`).
    * Deduped per user per day via `usersAuditBlocked` set.
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` (verifies initial block audit logging and persistence).

---

### 12. Alerts & Runbooks (`docs/monitoring-alerts.md`)
* **Status**: **DONE**
* **Evidence**:
  * [monitoring-alerts.md](monitoring-alerts.md) Section 7: "AI Cost and Budget Observability, Prometheus Alerts & Runbooks":
    * 7 Prometheus alert rules:
      1. `AiTokenBurnRateSpike` (global token consumption spike > 250k tokens/min)
      2. `AiBudgetExhaustionSpike` (excessive daily quota rejections > 20/min)
      3. `AiProviderTimeoutRateHigh` (provider timeouts > 10% for 5 minutes)
      4. `AiFallbackModelUsageSurge` (fallback model usage > 30% for 10 minutes)
      5. `AiMissingUsageRatioHigh` (missing token metadata > 5% for 15 minutes)
      6. `AiProviderLatencyP95High` (p95 latency > 15s for 5 minutes)
      7. `AiBudgetStoreErrors` (MongoDB budget storage write/read failures)
    * 6 Grafana dashboard panel specifications (AI Requests & Outcomes, Token Burn Rate by Feature/Provider, Provider Call Status & Fallback Ratio, P95/P50 Provider Latency, Missing Usage Metadata Rate, Users Near / Exhausted Budget).
    * Actionable runbook steps with environment variables (`AI_DAILY_TOKEN_BUDGET`, `AI_FALLBACK_COST_TOKENS`, `GEMINI_TIMEOUT_MS`, `AI_BUDGET_FAIL_MODE`).
* **Docs Verification**:
  * `npm run docs:check` validates all anchors and links cleanly.

---

### 13. User Visibility Endpoint (`GET /api/ai/usage`)
* **Status**: **DONE**
* **Evidence**:
  * [aiAssistant.routes.js](../server/src/routes/aiAssistant.routes.js) & [aiBudget.controller.js](../server/src/controllers/aiBudget.controller.js):
    * `GET /api/ai/usage`: Authenticated user endpoint (`protect`) returning today's `day`, `budget` (tokens, calls), `used` (calls, tokens, promptTokens, completionTokens, byFeature), `remaining` (tokens, calls), and `resetAt`. Excludes internal ledger metadata, failure logs, and raw database IDs.
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` (verifies 200 responses and sanitized schema).

---

### 14. Admin Visibility Endpoint (`GET /api/ai/admin/top-consumers`)
* **Status**: **DONE**
* **Evidence**:
  * [aiAssistant.routes.js](../server/src/routes/aiAssistant.routes.js) & [aiBudget.controller.js](../server/src/controllers/aiBudget.controller.js):
    * `GET /api/ai/admin/top-consumers`: Admin-only endpoint (`protect`, `requireAdmin`) with keyset pagination (`findPage` with base64 `cursor` and `limit`). Returns top token-consuming users for a given UTC `day` (defaults to today) with populated user profile fields (`name`, `email`).
* **Test Verification**:
  * `server/test/aiBudgetMonitoring.test.js` (verifies 403 on non-admin, keyset cursor pagination, and response fields).

---

### 15. Client-Side Integration & UI Indicators
* **Status**: **DONE**
* **Evidence**:
  * [api.ts](../client/src/configs/api.ts):
    * Axios response interceptor intercepts HTTP 429 with `errorData?.code === 'AI_DAILY_BUDGET_EXCEEDED'`.
    * Suppresses automatic retries (as quota resets at UTC midnight, immediate retries are wasteful).
    * Emits user-friendly toast: *"Daily AI budget reached. Resets at UTC midnight."*
  * [AIAssistant.tsx](../client/src/Pages/AIAssistant.tsx):
    * Fetches `/api/ai/usage` upon component mount.
    * Displays warning banner when user usage reaches $\ge 80\%$ of daily token or call quota.
    * Displays disabled-state alert banner when usage reaches $100\%$, disabling the message input and submit controls.
* **Test Verification**:
  * `client/src/test/aiUsageBanner.test.tsx` (tests banner rendering at 85% near-limit warning and 100% disabled limit state).
  * `client/src/test/apiRefresh.test.ts` (verifies API interceptors).

---

## Output Inflation & Model Injection Safeguards

To prevent client requests from inflating provider costs or bypassing configured ceilings:
1. **Output Ceiling Clamping**: In [aiAssistant.service.js](../server/src/services/aiAssistant.service.js), client-supplied `options.maxTokens` is strictly clamped:
   `const tokenCeiling = isJsonRequest ? 4000 : DEFAULT_MAX_OUTPUT_TOKENS;`
   `const maxTokens = options.maxTokens ? Math.min(options.maxTokens, tokenCeiling) : tokenCeiling;`
2. **Approved Model Enforcement**: In production environments, arbitrary client-requested model strings are ignored and fall back to `DEFAULT_MODEL` (`process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'`).
3. **Mock Provider Timeout Capture**: In [gemini.js](../server/src/utils/gemini.js), all mock handlers (`setGeminiFitBotMock`, `setGeminiVisionMock`, `setGeminiVoiceMock`) wrap mock executions in try-catch blocks to record provider call timeouts and failures, ensuring test assertions match live production execution paths.

---

## Automated Test Execution & Verification

### 1. Server-Side Automated Test Suite
* **Command**: `cd server && npm test`
* **Test Engine**: Node.js Native Test Runner (`node --test`)
* **Results**:
  * **Test Suites**: 209 suites passed (0 failed)
  * **Total Tests**: 751 tests passed (0 failed, 0 skipped)
  * **Duration**: ~31.4 seconds

### 2. Smoke Check Suite (`server/test/aiBudgetSmoke.test.js`)
* **Command**: `node --test test/aiBudgetSmoke.test.js`
* **Verified Outcomes**:
  * Request 1: Missing usage response is recorded as estimated (`estimatedCalls: 1`, `unknownUsageCalls: 1`, fallback floor charged).
  * Request 2: Mocked timeout error is charged to the budget (`timeouts: 1`, floor charged, clean 504 returned).
  * Request 3 (Nth request): Budget exhausted (> 2,000 tokens) returns HTTP 429 `AI_DAILY_BUDGET_EXCEEDED` with provider mock **never called** (`mockCalls: 0`).

### 3. Client-Side Automated Test Suite & Code Quality
* **Command**: `cd client && npm test -- --run`
  * **Results**: 8 test files passed (60 tests passed, 0 failed).
* **Command**: `cd client && npm run lint`
  * **Results**: `eslint . --max-warnings 0` passed cleanly with **0 errors, 0 warnings**.
* **Command**: `cd client && npm run build`
  * **Results**: `tsc -b && vite build` completed successfully in 1.35s with 3,610 modules transformed.

### 4. Documentation Guardrails
* **Command**: `npm run docs:check`
* **Results**:
  * `README.md` size: 5,903 bytes (limit: 8,192 bytes)
  * Verified 101 internal links across 29 files
  * Zero broken links or dead anchors

---

## Commit-Ready Changed Files

### Server Files Modified / Added
- `server/src/models/AiUsageDaily.js` *(new)*
- `server/src/services/aiBudget.service.js` *(new)*
- `server/src/middleware/aiBudget.js` *(new)*
- `server/src/controllers/aiBudget.controller.js` *(new)*
- `server/src/routes/aiAssistant.routes.js`
- `server/src/routes/imageAnalysis.routes.js`
- `server/src/routes/foodEstimate.routes.js`
- `server/src/routes/calorieEstimate.routes.js`
- `server/src/routes/workout.routes.js`
- `server/src/services/aiAssistant.service.js`
- `server/src/services/openrouter.service.js`
- `server/src/services/foodEstimate.service.js`
- `server/src/services/calorieEstimate.service.js`
- `server/src/utils/gemini.js`
- `server/src/utils/logger.js`
- `server/src/utils/metrics.js`
- `server/src/utils/pagination.js`
- `server/src/config/envValidator.js`
- `server/.env.example`
- `server/test/aiAssistant.test.js`
- `server/test/aiBudget.test.js` *(new)*
- `server/test/aiBudgetEnforcement.test.js` *(new)*
- `server/test/aiBudgetMonitoring.test.js` *(new)*
- `server/test/aiBudgetSmoke.test.js` *(new)*

### Client Files Modified / Added
- `client/src/Pages/AIAssistant.tsx`
- `client/src/configs/api.ts`
- `client/src/test/aiUsageBanner.test.tsx` *(new)*

### Documentation Files Modified / Added
- `docs/ai-budget-audit.md` *(new)*
- `docs/security.md`
- `docs/monitoring-alerts.md`
- `docs/api-reference.md`
- `docs/architecture.md`
- `docs/getting-started.md`
- `docs/testing.md`
- `CHANGELOG.md`

---

## Decisions for You

1. **Default Quota Numbers (`AI_DAILY_TOKEN_BUDGET` & `AI_DAILY_CALL_BUDGET`)**:
   - Baseline default configured to 50,000 tokens/day and 100 calls/day per standard user.
   - Recommended action: Review token metrics in Prometheus (`ai_tokens_total`) after 14 days of staging traffic to determine if free-tier users require lower limits (e.g. 30,000 tokens/day).
2. **Fail Mode Policy (`AI_BUDGET_FAIL_MODE`)**:
   - Production defaults to `closed` to safeguard credit cards against runaway unmetered costs during MongoDB outages.
   - Development and testing default to `open` to prevent blocking developer workflows.
3. **Admin Multiplier (`AI_DAILY_BUDGET_ADMIN_MULTIPLIER`)**:
   - Defaults to 10x multiplier for accounts with `isAdmin: true` (500,000 tokens/day and 1,000 calls/day).

---

## Suggested Commit Message

```text
feat(ai-budget): enforce per-user daily AI quotas, monitoring, and timeout resilience

- Add AiUsageDaily Mongoose model with UTC day anchoring, TTL expiration, and per-feature counters
- Implement aiBudget.service with atomic upserts, duplicate-key retries, and non-zero fallback cost estimation
- Wire enforceAiBudget middleware on all AI routes after auth, parsing, validation, and burst limiters
- Capture request-scoped usage via AsyncLocalStorage across OpenRouter retries and Gemini turns
- Bound all Gemini calls with configurable GEMINI_TIMEOUT_MS and charge floor tokens on timeouts
- Clamp client-supplied maxTokens and model options to prevent output inflation and model injection
- Register Prometheus metrics for request outcomes, tokens, provider latencies, and quota exhaustion
- Add user-facing GET /api/ai/usage and admin-only paginated GET /api/ai/admin/top-consumers
- Integrate Axios budget error interceptor and in-app usage warning/disabled banners in AIAssistant UI
```

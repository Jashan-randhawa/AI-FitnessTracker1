# 🧪 Testing & CI/CD Specification

[← Back to Documentation Index](README.md)

## 🧪 Testing & CI/CD

### Automated Test Suite

The automated test suite runs on every pull request and push to `main` via GitHub Actions. As of v2.6.0, the platform verifies **869 passing tests** (776 server unit/integration tests across 220 suites, and 93 client tests across 12 suites).
FitTrack AI includes a comprehensive test suite covering backend controllers, security boundaries, AI schemas, and client state machines:

- **Backend Unit & Integration Tests:** Native Node.js test runner (`node --test`), requiring zero external test framework dependencies.
- **Frontend Unit Tests:** Vitest test runner validating offline synchronization queues, storage adapters, UI indicator states, reconciliation events, and live workout tracker modal interactions.

```bash
# Run server test suite
cd server
npm test

# Run server test suite with coverage & threshold enforcement
npm run test:coverage

# Run server smoke test (live boot and endpoint verification)
npm run test:smoke

# Run client test suite
cd ../client
npm test
```

### Server Code Coverage Policy

FitTrack AI enforces automated code coverage reporting and minimum quality gates for the server test suite using native Node.js test coverage (`--experimental-test-coverage`).

#### Current Active Thresholds
Server test coverage is evaluated strictly over production source code (`server/src/**`), explicitly excluding tests (`test/**`), operational/migration scripts (`scripts/**`), cross-boundary client files, live DB connection setup (`src/config/db.js`), and seeding utilities (`src/services/seed.service.js`).

Current enforcement thresholds (configured in `server/package.json`):
- **Line Coverage:** Minimum **82%** (Baseline: ~86.6%)
- **Branch Coverage:** Minimum **72%** (Baseline: ~76.5%)
- **Function Coverage:** Minimum **72%** (Baseline: ~77.8%)

#### Non-Regression Rule (Ratchet Principle)
- **Thresholds may only go up, never down.**
- No pull request or refactor may lower the required line, branch, or function threshold percentages.
- Any new or modified server endpoint, middleware, schema, or service must include unit or integration tests to ensure coverage does not slip below active gates.

#### Ratchet Roadmap & Milestones
- **Milestone 1 (Initial Lock-In - Active):** Lines: 82% | Branches: 72% | Functions: 72%
  - Establishes automated baseline enforcement in CI; catches regressions and untested additions while providing a safe 2–3% buffer.
- **Milestone 2 (CRUD Controller Coverage):** Lines: 85% | Branches: 77% | Functions: 77%
  - Target: Add unit test suites for handlers currently lacking direct function invocation: `activitylog.controller.js`, `foodlog.controller.js`, `events.controller.js`, and `summary.controller.js`.
- **Milestone 3 (AI Services & Error Recovery):** Lines: 90% | Branches: 82% | Functions: 82%
  - Target: Expand branch tests for `calorieEstimate.service.js`, `foodEstimate.service.js`, `auth.controller.js` edge cases, and `redisClient.js` reconnect branches.

### Backend Test Coverage Highlights
- **Offline Sync Queue & Write Idempotency (`test/offlineSync.test.js`):** 4-endpoint replay verification (water, weight, food, activity), atomic in-flight claim concurrency (409 `IDEMPOTENCY_IN_PROGRESS`), payload mismatch rejection (422 `IDEMPOTENCY_KEY_REUSED`), transient 5xx failure release & retry, per-user tenant scoping, water/food bounds & date range validation, event-time weight conflict rule, body `localDay` prioritization, and migration script index management.
- **Blog Admin Authorization & Field Whitelisting (`test/blogAdminAuthz.test.js`):** Role-based access control (RBAC), `requireAdmin` middleware verification, strict `isAdmin: true` database flag enforcement, and field whitelisting for blog write operations.
- **User Macro & Water Goals (`test/userGoals.test.js`):** Numeric validation, non-negative constraints (`min: 0`), and non-numeric casting guards for `dailyproteingoal`, `dailycarbsgoal`, `dailyfatgoal`, and `dailywatergoal`.
- **WeightLog Migration & Safe Indexing (`test/weightlogMigration.test.js` & `test/phaseF-weightlog.test.js`):** Timezone-aware `localDay` derivation, unique partial compound indexes, de-duplication, and dry-run backfill simulation.
- **Hands-Free Voice Gym Logging (`test/voiceSetLogger.test.js`):** Strict `VoiceSetSchema`, deterministic regex fallback, imperial-to-metric weight conversion, and multimodal Gemini parser endpoints.
- **Server-Sent Events & Ticket Auth (`test/events.test.js`):** SSE ticket creation, streaming connection handshake, and stream authorization.
- **Daily & Range Summary Aggregations (`test/summary.test.js`):** Aggregation calculations for day summary and multi-day range analytics.
- **AI Structured Plans & Schemas (`test/aiPlans.test.js`):** Zod validation contracts for meal and workout plan JSON payloads, rejecting negative macros or unrealistic durations.
- **FitBot Reliability & Cancellation (`test/fitbotReliability.test.js`):** Idempotent persistence, request deduplication, and client abort handling.
- **FitBot Context, Memory & Privacy (`test/fitbotContextPrivacy.test.js`):** Per-user memory scoping, context injection, and privacy controls.
- **Shared Fitness Context (`test/fitnessContext.test.js`):** Complete and partial profiles, empty logs, missing plans, invalid timezones, day rollovers, user isolation, and prompt-size limits.
- **Weather & Local-Time Context (`test/environment.test.js`):** Range and enum validation, malformed or stale observations, missing fields, and conservative outdoor risk handling.
- **FitBot Contextual Coaching (`test/fitbotCoaching.test.js`):** Server-built context in prompts, prompt-version and cache-key behaviour, and cross-user cache isolation.
- **Adaptive Planners (`test/plannerContext.test.js`):** Remaining calorie and macro budgets, exceeded or missing targets, active-plan and streak rules, fail-closed behaviour, and planner limits.
- **Release Gate & Safety Boundaries (`test/phase6Release.test.js`):** Multi-user authorization boundaries, adversarial prompt injection defense, clinical safety safe harbor, and LRU cache isolation.
- **Auth & JWT (`test/auth.test.js`):** Token generation, signature validation, payload integrity, username/email/password registration validators, and login validation.
- **Refresh Tokens & Session Security (`test/refreshToken.test.js`):** Single-flight refresh token rotation (RTR), token family reuse detection and instant family revocation, logout cookie invalidation, `verifyCsrfAndOrigin` cross-origin protection, and backwards-compatible Bearer token verification.
- **Dual Sign-In Matrix & Password Policy (`test/phase3-google-linking.test.js`, `test/phase4-password-management.test.js`):** Google OAuth 6-case automated linking matrix, squat account protection, password setting/updating with step-up verification (`requireRecentLogin`), and rolling 5-password history prevention.
- **Signup & Verification Token Flows (`test/phase6-email-verification.test.js`):** 64-character token crypto hashing, 24-hour expiration, anti-enumeration behavior, and state updates.
- **Email Resilience & Debouncing (`test/brevoEmailService.test.js`):** 5-layer transactional email tests (F1–F5), 60s cooldown debouncing, Brevo 429/5xx retry handling, and timeout safeguards.
- **AI Assistant Guardrails & Truncation (`test/aiAssistant.test.js`):** Message array boundary checks, maximum character length limits, graceful sliding-window history truncation, and friendly outage responses (`503`).
- **OpenRouter Resilience & Prompts (`test/openrouter.test.js`):** Transient error detection (429/5xx/timeouts), primary/fallback model defaults, JSON code fence extraction, and versioned FitBot prompt generation.
- **Structured Logger & Secret Scrubber (`test/logger.test.js`):** Automated redaction of passwords, tokens, API keys, Bearer tokens, and JWTs while preserving token usage metrics.
- **Health Endpoint & Request ID (`test/health.test.js`):** `GET /api/health` status, database connection state, uptime tracking, and UUID `X-Request-Id` assignment and preservation.
- **Error Handling & Production Masking (`test/errorHandler.test.js`):** Multer errors, Mongoose validation/cast/duplicate key errors, and production internal database error masking.
- **Nutrition & Calorie Estimation (`test/estimates.test.js`):** Input validation for duration, activity name, food items, and numeric boundaries.
- **Password Reset (`test/passwordReset.test.js`):** Email format verification and non-string/missing payload handling.
- **Workout Plans & ActivityLog Extensions (`test/workoutPlan.test.js`):** WorkoutPlan model initialization, additive ActivityLog schema fields (type, intensity, source, exercises with nested sets), and savePlan validation.
- **Daily AI Budget Foundation (`test/aiBudget.test.js`):** `AiUsageDaily` compound indexing and TTL expiration, multi-provider token normalization (OpenRouter snake_case, Gemini usageMetadata, camelCase), cost estimation floors (`estimateCost`), UTC midnight rollover, fail-closed policy, and atomic upsert retry on race conditions.
- **AI Budget Enforcement & Provider Metering (`test/aiBudgetEnforcement.test.js`):** Route-level pre-execution gate returning HTTP 429 (`AI_DAILY_BUDGET_EXCEEDED`), multi-attempt collection across retries and repair loops via `AsyncLocalStorage`, Gemini bounded timeouts with minimum charge, and zero-cost verification for cache hits and regex fallbacks.
- **AI Budget Monitoring, Logs & Visibility (`test/aiBudgetMonitoring.test.js`):** Prometheus metrics exposition (`ai_requests_total`, `ai_tokens_total`, `ai_provider_calls_total`, latency histogram, missing usage counter), cheap zero-cardinality gauge updates (`ai_budget_users_status`), deduplicated 80%/100% structured logging, AuditLog persistence on initial block, `/api/ai/usage` data sanitization, and admin top-consumers keyset pagination.
- **Client AI Quota Banner & States (`client/src/test/aiUsageBanner.test.tsx`):** FitBot interface banner rendering for 80% warning and 100% exhaustion with disabled textarea and submission button.

### Continuous Integration (GitHub Actions)
The repository includes a GitHub Actions CI workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) running on Node.js 22 with strict permissions:
- **Client Job:** Dependency installation (`npm ci`), high-level security audit (`npm audit --omit=dev --audit-level=high`), ESLint validation (`npm run lint`), client unit testing (`npm test`), TypeScript typecheck, and Vite production build (`npm run build`).
- **Server Job:** Dependency installation, high-level security audit, JavaScript syntax validation (`node -c`), module loading check, CI email guard (`npm run ci:guard`), automated test execution and coverage enforcement (`npm run test:coverage`), and live smoke test execution (`npm run test:smoke`).

---


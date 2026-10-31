# Phase 4 Implementation Report — AI Service Reliability, Cache Bounds, Fallbacks, and Cost Controls

[← Back to Documentation Index](README.md)

**Date:** 2026-10-22  
**Status:** Completed & Verified  
**Branch:** `feat/fitbot-phase-4-ai-reliability`  
**Reference Task:** FitBot AI Chatbot Master Plan — Phase 4  

---

## 1. Executive Summary

Phase 4 hardens the core AI execution pipeline against upstream provider instabilities, latency spikes, rate limits, resource leaks, and cost overruns. Prior to this phase, provider timeouts were not differentiated from user client cancellations, transient 429/503 errors did not honor `Retry-After` headers, cache memory was unbounded, and concurrency could overwhelm the server during traffic bursts.

All Phase 4 deliverables have been implemented, tested, and validated with **zero backward-incompatibility** and **zero external paid dependencies**:
1. **Explicit Cancellation & Timeout Distinction**: Timeout aborts trigger retries/fallbacks; user cancellations (`isClientAbort`) cleanly terminate immediately without redundant model switching.
2. **Bounded Exponential Backoff with Jitter**: Transient failures (408, 429, 500, 502, 503, 504, `ECONNRESET`, `ETIMEDOUT`) back off exponentially with randomization and `Retry-After` compliance up to a 10s ceiling.
3. **Upstream Envelope Validation**: Responses are checked for valid choices arrays, non-empty content strings, and provider-level `{ error: ... }` bodies even on HTTP 200.
4. **Fast-Failure on Auth Errors**: 401/403 errors halt immediately with actionable alerts rather than exhausting fallback retries against an unauthenticated endpoint.
5. **Bounded LRU Cache with Statistics**: In-memory response cache capped at 200 entries with a 5-minute TTL, LRU eviction, and operational telemetry (`getCacheStats`).
6. **Model- & Token-Aware Cache Keys**: Cache keys now bind the target model and `maxTokens` ceiling, eliminating cross-model cache pollution.
7. **In-Flight Concurrency Throttling**: Process-wide (25) and per-user (2) concurrency barriers reject excessive simultaneous requests with HTTP 429 before upstream invocations occur.
8. **Truthful Token Accounting**: Absence of upstream token usage data reports `usage: null` rather than fabricated `0` counts.

---

## 2. Architecture & Implementation Details

### 2.1 Upstream Provider Reliability (`server/src/services/openrouter.service.js`)

- **Error Classification & Factory**:
  - `createTimeoutError(timeoutMs, model)`: Sets `name = 'TimeoutError'`, `code = 'ETIMEDOUT'`, `isTimeout = true`, and `status = 504`.
  - `createClientAbortError(model)`: Sets `name = 'AbortError'`, `code = 'ECONNABORTED'`, `isClientAbort = true`, and `status = 499`.
  - `createMalformedResponseError(reason, raw)`: Sets `isMalformed = true` and `status = 502`.
  - `createEmptyResponseError(model)`: Sets `isEmpty = true` and `status = 502`.
- **Transient vs Non-Transient Errors**:
  - HTTP 408, 429, 500, 502, 503, 504 and network errors (`ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`) are classified as transient and eligible for backoff retries.
  - Client aborts (`isClientAbort === true`) and authentication errors (401, 403) abort the retry loop immediately.
- **Model Fallback Cascade**:
  - Primary Model: `openai/gpt-4o-mini` (up to 2 attempts).
  - Fallback Model: `deepseek/deepseek-chat` (up to 2 attempts).
  - Client cancellations cleanly exit without fallback invocations.

### 2.2 Response Cache Bounds & LRU Eviction (`server/src/services/aiAssistant.service.js`)

- **Bounded LRU Store**:
  - `MAX_CACHE_ENTRIES = 200` (configurable via `AI_CACHE_MAX_ENTRIES`).
  - `CACHE_TTL_MS = 5 * 60 * 1000` (5 minutes, configurable via `AI_CACHE_TTL_MS`).
  - Map iteration order maintains LRU order; on hit, keys are refreshed to the tail. When capacity is exceeded, the oldest entry (`keys().next().value`) is evicted.
- **Cache Key Differentiation**:
  - `computeCacheKey(prompt, messages, { model, maxTokens })`: SHA-256 hash digests messages along with model identifier and token ceilings, preventing cache collisions between text and JSON requests.
- **Telemetry**:
  - `getCacheStats()` exposes `size`, `maxEntries`, `hits`, `misses`, `evictions`, and `hitRate`.
  - `resetCache()` provides testing isolation.

### 2.3 Process & Per-User Concurrency Barriers (`server/src/controllers/aiAssistant.controller.js`)

- **Configurable Limits**:
  - Global In-Flight Limit: 25 requests (`MAX_TOTAL_CONCURRENT_AI_REQUESTS`).
  - Per-User In-Flight Limit: 2 requests (`MAX_USER_CONCURRENT_AI_REQUESTS`).
- **Throttling Enforcement**:
  - Controller evaluates active count before reading request streams or dispatching to the AI service.
  - Exceeding limits returns HTTP 429 with `Retry-After: 2` and a clear descriptive message (`Too many concurrent AI requests. Please wait for in-flight requests to complete.`).
  - Guaranteed counter decrement in `finally` blocks prevents counter drift under error conditions.

---

## 3. Verification & Test Baseline

### 3.1 Server Test Suite
- Command: `node scripts/ci-guard-email.js && node --test test/*.test.js`
- **Result**: `tests 201 | suites 52 | pass 201 | fail 0`
- Key Test Coverage:
  - `test/openrouter.test.js`: 17 tests verifying transient retry recovery, envelope validation, fallback switching, 401 fast failure, and null usage accounting.
  - `test/aiAssistant.test.js`: 14 tests verifying LRU cache eviction, stats telemetry, cache-key differentiation, and user concurrency 429 throttling.

### 3.2 Client Lint & Production Build
- `npm run lint`: 0 errors, 139 warnings (non-blocking TypeScript `any` warnings).
- `npm run build`: `tsc -b && vite build` completed successfully with 0 errors.

---

## 4. Phase 5 Readiness

With Phase 4 completed, the system now provides an exceptionally reliable, bounded runtime for Phase 5:
- **Phase 5 Focus**: Structured AI Outputs, Zod Schema Validation for Meal/Workout Plans & Safety Guardrails.

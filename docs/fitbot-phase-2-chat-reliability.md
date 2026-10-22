# 🛡️ FitBot AI — Phase 2: Chat Reliability & Persistence Implementation Report

> **Repository**: [Jashan-randhawa/AI-FitnessTracker1](https://github.com/Jashan-randhawa/AI-FitnessTracker1)  
> **Phase**: 2 of 6 (Targeted Implementation)  
> **Branch**: `fix/fitbot-phase-2-reliability`  
> **Date**: October 22, 2026  
> **Environment**: Windows 11, Node.js `v24.11.1`, npm `11.6.2`  

---

## 1. Executive Summary

Phase 2 addressed critical persistence and concurrency defects identified during Phase 1:
1. **Chat Persistence Idempotency**: Eliminated the premature lockout bug where saving froze after the first turn. Implemented a persistent, client-generated `sessionId` with monotonic `revision` tracking and user-scoped server upsert (`POST /api/chathistories` and `PUT /api/chathistories/session/:sessionId`).
2. **Guaranteed Delivery on Exit**: Coupled in-memory queued saves with the browser `pagehide` beacon (`fetch(..., { keepalive: true })`) to prevent losing conversations during page refreshes or tab closures.
3. **Double-Submit Prevention**: Enforced a synchronous in-flight request lock (`isSendingRef`) to eliminate race conditions caused by rapid Enter or click submissions before React state updates.
4. **Pure History Reconstruction**: Extracted pure, unit-tested message reconstruction helpers (`getRetryContext`, `getRegenerateContext`) that strictly exclude error bubbles and preserve prior conversational turns.
5. **End-to-End Cancellation Pipeline**: Propagated client cancellations through Express connection close events and Node `AbortController` down to OpenRouter `fetch`, preventing wasted LLM tokens and suppressing stale completions from corrupting newer chat state.
6. **Backward-Compatible Database Indexing**: Added a compound unique index on `{ user, sessionId }` using a partial filter expression (`partialFilterExpression: { sessionId: { $type: 'string' } }`), guaranteeing zero conflicts with legacy Strapi/v1 sessions that lack a `sessionId`.

---

## 2. Baseline Verification Results (Post-Implementation)

All three quality gates were executed against the updated codebase:

| Check | Target Directory | Command | Exit Code | Verified Runtime Output | Status |
|---|---|---|---|---|---|
| **Server Tests** | `server/` | `npm test` | **0** | **161 passed, 0 failed across 43 suites** (36.63s). 19 new tests added for chat history and cancellation reliability. Brevo CI scan clean. | ✅ **PASS** |
| **Client Lint** | `client/` | `npm run lint` | **0** | **0 errors, 139 warnings** (no new warnings introduced; `AIAssistant.tsx` and `fitbotHistory.ts` are 100% warning-free). | ⚠️ **PASS** |
| **Client Build** | `client/` | `npm run build` | **0** | **TypeScript compile (`tsc -b`) & Vite production build clean** in 11.06s. Emitted `AIAssistant-sT2N8gcn.js` (39.22 kB). | ✅ **PASS** |

---

## 3. Detailed Implementations

### 3.1 Stable, Idempotent Session Persistence

- **Session Identifier**: The active chat session is assigned a client-generated UUID (`crypto.randomUUID()`) upon mount or "New Chat". The identifier persists across turns in React state and ref (`sessionIdRef`).
- **Server Upsert Contract**:
  - `POST /api/chathistories` accepts `{ data: { sessionId, revision, summary, messages } }` or top-level body.
  - If `sessionId` is present, the server performs a user-scoped lookup (`{ user: req.user._id, sessionId }`).
  - If found: checks `revision`. If incoming `revision < existing.revision`, the update is treated as a stale out-of-order write and ignored idempotently without mutating the document. Otherwise, `summary`, `messages`, and `revision` are updated.
  - If not found: creates a new document. If a concurrent creation race occurs (MongoDB error `11000`), it recovers by updating the existing record.
  - If `sessionId` is absent: creates a new legacy record (`revision: 1`).
- **Dedicated Session Endpoints**:
  - `GET /api/chathistories/session/:sessionId` (and `/:id`): Fetches session owned strictly by `req.user._id`.
  - `PUT /api/chathistories/session/:sessionId` (and `/:id`): Idempotent upsert route.
  - `DELETE /api/chathistories/session/:sessionId` (and `/:id`): Scoped single session deletion.
  - `DELETE /api/chathistories/all`: Scoped bulk deletion.
- **Partial Index Strategy**:
  ```javascript
  chatHistorySchema.index(
    { user: 1, sessionId: 1 },
    {
      unique: true,
      partialFilterExpression: { sessionId: { $type: 'string' } },
    }
  );
  ```
  Legacy documents in MongoDB Atlas that omit `sessionId` are completely exempt from uniqueness collisions.

### 3.2 Visible Save State & In-Memory Queueing

- **State Model**: Transitioned from a binary `sessionSaved` flag to four discrete states: `"idle" | "saving" | "saved" | "error"`.
- **UI Header Indicators**:
  - `saving`: Displays subtle pulsating `· Saving…` indicator.
  - `saved`: Displays `· Saved` confirmation.
  - `error`: Displays `· Save failed (Retry)` button allowing manual retry with a single click.
- **Immediate Local Memory Refresh**: When `saveSession` completes, `setPastSessions` updates locally immediately, ensuring the memory flyout reflects the latest session without requiring a page reload.
- **Save Queue**: If a save request arrives while `isSavingRef.current` is true, the snapshot is queued in `pendingSaveRef` and flushed automatically upon completion.
- **Unload Persistence**: A `pagehide` event listener dispatches the current snapshot via `fetch(..., { keepalive: true })`, ensuring data is saved even during abrupt browser tab closure.

### 3.3 Send, Retry, and Regenerate Hardening

- **Synchronous Guard**: Added `isSendingRef` check at the entrance of `sendMessage`, preventing double submissions in the same event-loop tick before React state updates.
- **Pure History Helper (`client/src/utils/fitbotHistory.ts`)**:
  - `getRetryContext(messages)`: Traverses backwards to find the failed user prompt. Preceding history includes only valid turns, strictly filtering out error bubbles (`isError: true`).
  - `getRegenerateContext(messages)`: Trims only the final assistant answer from UI state, locates the associated user prompt, and sends it with preceding history and `regenerate: true` to bypass the server response cache.
  - `buildGeminiPayload(messages)`: Formats turns into `{ role, parts: [{ text }] }`.
  - `buildSessionSummary(messages)`: Generates compact readable summaries for the memory drawer.

### 3.4 Cancellation & Stale-Response Suppression

- **Unique Request Identity**: Each dispatch generates a unique `requestId` (`req-<timestamp>-<hash>`) stored in `activeRequestIdRef`. When promises resolve or reject, if `activeRequestIdRef.current !== requestId`, the response is dropped.
- **Safe `finally` Blocks**: Loading state is only cleared if the resolving request matches `activeRequestIdRef.current`, preventing stale requests from clearing loading spinners for newer requests.
- **New Chat & Session Restore Invalidation**: Calling `startNewChat()` or `loadPastSessionIntoChat()` explicitly invokes `abortControllerRef.current?.abort()`, clears `activeRequestIdRef`, and resets `isSendingRef` before altering visible messages.
- **Express to OpenRouter Abort Propagation**:
  - In `aiAssistant.controller.js`: Listens to `req.on('close')`. If the client disconnects before `res.writableEnded`, aborts an `AbortController`.
  - In `openrouter.service.js`: Receives `signal`. If client aborts, halts immediately, sets `isClientAbort = true`, and skips exponential backoff retries and fallback models.
  - Closed Connection Guard: The controller checks `res.writableEnded || res.headersSent` before writing response headers or bodies.

---

## 4. Modified & Created Files

| File | Change Type | Summary of Changes |
|---|---|---|
| [`client/src/utils/fitbotHistory.ts`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/client/src/utils/fitbotHistory.ts) | **Created** | Pure helper module: `getRetryContext`, `getRegenerateContext`, `buildGeminiPayload`, `buildSessionSummary`, `getValidMessages`. |
| [`client/src/Pages/AIAssistant.tsx`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/client/src/Pages/AIAssistant.tsx) | **Modified** | Integrated stable `sessionId`, `saveStatus`, queueing, `pagehide` beacon, `isSendingRef`, `activeRequestIdRef`, and header status badge. |
| [`server/src/models/ChatHistory.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/models/ChatHistory.js) | **Modified** | Added `sessionId`, `revision`, `summary` limits, unique compound partial index `{ user: 1, sessionId: 1 }`, and sorting indexes. |
| [`server/src/controllers/chathistory.controller.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/controllers/chathistory.controller.js) | **Modified** | Zod payload validation, idempotent session upsert, revision checks, user scoping, and single session endpoints. |
| [`server/src/routes/chathistory.routes.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/routes/chathistory.routes.js) | **Modified** | Mounted `/session/:sessionId` and `/:id` routes with `protect` and `chatHistoryLimiter`. |
| [`server/src/middleware/rateLimiter.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/middleware/rateLimiter.js) | **Modified** | Added `chatHistoryLimiter` (60 req/min per user) to safeguard history endpoints. |
| [`server/src/controllers/aiAssistant.controller.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/controllers/aiAssistant.controller.js) | **Modified** | Client disconnect detection (`req.on('close')`), `AbortController` propagation, and closed connection response suppression. |
| [`server/src/services/aiAssistant.service.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/services/aiAssistant.service.js) | **Modified** | Forwarded `options.signal` into primary and repair `chatCompletionDetailed` calls. |
| [`server/src/services/openrouter.service.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/src/services/openrouter.service.js) | **Modified** | Signal abort handling, `isClientAbort` detection, non-retry of client cancellations, timeout reduction to 15s. |
| [`server/test/chatHistory.test.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/test/chatHistory.test.js) | **Created** | 13 integration and unit tests covering schema validation, partial indexes, idempotency, revisions, and scoping. |
| [`server/test/fitbotReliability.test.js`](file:///C:/Users/jasha/.gemini/antigravity/scratch/AI-FitnessTracker1/server/test/fitbotReliability.test.js) | **Created** | 6 unit tests covering pure history helpers, client cancellation rejection, and controller response suppression. |

---

## 5. Automated Test Matrix & Execution Details

### 5.1 `server/test/chatHistory.test.js` (13 tests — 100% Pass)
- ✔ initializes ChatHistory model with sessionId, revision, and defaults
- ✔ declares compound unique index on `{ user, sessionId }` with partialFilterExpression
- ✔ declares compound sorting indexes for pagination
- ✔ accepts valid session snapshot payload
- ✔ rejects invalid message role (only `user`, `assistant`, `model` allowed)
- ✔ rejects oversized single message text exceeding 8,000 characters
- ✔ rejects oversized summary exceeding 2,000 characters
- ✔ rejects session message arrays exceeding 100 turns
- ✔ POST `/api/chathistories` creates a new session document when not found
- ✔ POST `/api/chathistories` idempotently updates existing session instead of duplicating
- ✔ POST `/api/chathistories` ignores stale out-of-order writes with lower revision
- ✔ GET `/api/chathistories/session/:sessionId` enforces strict user ownership isolation
- ✔ DELETE `/api/chathistories/session/:sessionId` deletes session scoped to `req.user._id`

### 5.2 `server/test/fitbotReliability.test.js` (6 tests — 100% Pass)
- ✔ getRetryContext identifies the failed user turn and excludes error bubbles
- ✔ getRegenerateContext trims the last assistant answer and retrieves the associated prompt
- ✔ getRegenerateContext preserves earlier multi-turn history
- ✔ isTransient returns false when error has isClientAbort or non-timeout AbortError
- ✔ chatCompletionDetailed rejects immediately when signal is already aborted
- ✔ chat controller suppresses writing response when client disconnected (`res.writableEnded`)

---

## 6. Manual Browser Verification Guide

For live staging / local development testing, execute these manual scenarios:
1. **Multi-turn Autosave**: Send 5 consecutive messages. Open the Memory flyout and inspect MongoDB. Verify exactly one session document exists with all 5 user turns and assistant replies.
2. **Tab Refresh During Turn**: Send a message, wait for the response, and hit `F5`. Open the Memory drawer to confirm the conversation was preserved via `pagehide`.
3. **Stop Generation**: Ask FitBot a long question ("Write a complete 30-day marathon training program"). Click "Stop" at 2 seconds. Verify typing stops immediately, no error bubble appears, and clicking "New Chat" displays a clean conversation.
4. **Retry on Network Outage**: Simulate network disconnection (DevTools Offline). Send a message. Verify the rose error box appears with "Retry Request". Reconnect network, click "Retry Request", and verify only the failed prompt is resent without duplicating error text.
5. **Regenerate Answer**: Click "Regenerate" on the latest assistant answer. Verify the old response is replaced in-place and cache is bypassed.
6. **Double-Submit Resistance**: Rapidly spam the Enter key or Send button with text in the input. Verify only a single user bubble is created and only one request is dispatched to the server.

---

## 7. Phase 2 Handoff to Phase 3

### Items Confirmed and Resolved
- Fixed duplicate session creation on repeated saves.
- Fixed session save freezing beyond turn 1.
- Fixed un-awaited cleanup loss during browser navigation.
- Fixed request race conditions on rapid user submission.
- Fixed cancellation token leakage into OpenRouter.
- Guaranteed legacy chat record readability with partial index.

### Scope for Phase 3 (Structured AI Responses, Schema Validation & Privacy)
1. **Zod Validation on Structured Plans**: Implement strict schemas for `DayPlan` (Meal Planner) and `ActivityDayPlan` (Activity Planner) to eliminate unhandled `TypeError` crashes.
2. **Context Normalization & Delimiter Tagging**: Enclose user food and activity logs within `<user_context>` XML delimiters in `fitbot.prompt.js` to eliminate prompt injection risks.
3. **Session Retention Policy**: Implement automatic eviction / cleanup of sessions older than retention limits (e.g., max 30 sessions per user).
4. **Timezone Harmonization**: Replace UTC-midnight date string conversions in client logs with local calendar date components.

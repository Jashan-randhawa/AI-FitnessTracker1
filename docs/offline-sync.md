# 📶 Offline Logging Queue & Sync Architecture

## 1. Overview
FitTrack AI provides a resilient, privacy-preserving offline logging engine for health entries: water intake, weight weigh-ins, meals, and workout sessions. When connectivity is unavailable, entries are validated immediately on the client, saved to local IndexedDB storage, and rendered optimistically with pending badges. Once network connectivity is restored, the client replay engine drains queued mutations in FIFO order with durable server idempotency guarantees.

---

## 2. Architecture Decision Record (ADR): Service Worker & Sync Strategy

### Context
When designing offline mutation synchronization for single-page applications, two common architectural paradigms exist:
1. **Service Worker Background Sync:** Offloading replay to a Service Worker via the `SyncManager` API.
2. **Foreground Client Engine:** Replaying queued mutations from the application lifecycle (online listeners, tab focus, periodic heartbeat, and manual triggers).

### Decision
**We decided NOT to introduce a Service Worker for mutation sync in this release.**

### Key Rationale
- **Access Token Architecture:** FitTrack AI maintains short-lived JWT access tokens strictly in JavaScript memory (`client/src/configs/authToken.ts`) to eliminate persistent token theft (XSS/storage leakage). A Service Worker background process does not have access to memory state in the window and cannot obtain a valid `Authorization: Bearer <token>` header for replay.
- **Cookie Path-Scoping:** The refresh token cookie is configured as `HttpOnly` and scoped exclusively to the path `/api/auth` (`/api/auth/refresh-token`). A Service Worker cannot intercept or leverage this cookie to authenticate arbitrary mutations against `/api/waterlogs`, `/api/weightlogs`, `/api/foodlogs`, or `/api/activitylogs`.
- **Incomplete Platform Support (Safari iOS):** The Background Sync API (`PeriodicSyncManager` / `SyncManager`) is not supported on WebKit / iOS Safari. Relying on Service Worker background sync would leave iOS mobile web users without sync support.
- **Simpler Failure Recovery & Reconciliation:** Managing queue reconciliation (updating React UI state, merging server IDs, deduplicating with Server-Sent Events) within the window execution context avoids multi-threaded state synchronization complexities and cache invalidation races.

### Future Service Worker Guidelines
If a Service Worker, PWA plugin, or Web App Manifest is introduced in a future release:
- **Scope Restriction:** The Service Worker MUST be strictly limited to static asset caching (app shell: HTML, JS, CSS, fonts, and icons).
- **Zero Mutation Handling:** The Service Worker MUST NOT intercept, store, retry, or process health logging mutations or authentication tokens. All mutation lifecycles must remain under `client/src/offline/`.

---

## 3. Data Model & Supported Actions

The offline engine only permits an explicit allowlist of health logging mutations. AI prompts, profile updates, and authentication requests are never queued offline.

| Mutation Kind | Action / Description | Target Route & Method | Payload Bounds |
| :--- | :--- | :--- | :--- |
| `water_add` | Quick water log entry | `POST /api/waterlogs` | `amount`: 1 to 10,000 ml; ISO date |
| `weight_log` | Daily weight weigh-in | `POST /api/weightlogs` | `weightKg`: 20 to 400 kg; ISO date; `localDay` (YYYY-MM-DD); notes |
| `food_add` | Food item logging | `POST /api/foodlogs` | `name`: 1-120 chars; `calories`: 0-20,000 kcal; `protein`/`carbs`/`fat`: 0-1,000 g |
| `activity_add` | Workout session logging | `POST /api/activitylogs` | `activity`: 1-100 chars; `duration`: 1-1440 min; `caloriesBurned`: 0-10,000 |

### Queued Mutation Schema
```typescript
interface QueuedMutation {
  id: string;                    // Local UUID v4
  userId: string;                // Scoped user identifier
  kind: OfflineMutationKind;     // 'water_add' | 'weight_log' | 'food_add' | 'activity_add'
  payload: Record<string, unknown>; // Zod-validated payload
  idempotencyKey: string;        // 36-char RFC UUID sent in Idempotency-Key header
  createdAt: number;             // Timestamp in epoch ms
  eventDate: string;             // ISO 8601 string of actual user event time
  localDay?: string;             // YYYY-MM-DD captured at time of user interaction
  status: 'pending' | 'syncing' | 'failed' | 'needs_auth' | 'conflict' | 'expired';
  attempts: number;              // Retry counter
  nextAttemptAt?: number;        // Epoch ms timestamp for next backoff retry
  lastErrorCode?: string;        // HTTP error code or network error string
  localTempId?: string;          // Temporary optimistic row ID ('tmp-*')
}
```

---

## 4. Storage Layer & Privacy Safeguards

- **Primary Adapter:** IndexedDB (`fittrack_offline_v2` database, `mutations_v2` object store) indexed by `userId` and `createdAt`.
- **Fallback Adapter:** In-memory `MemoryStorageAdapter` when IndexedDB is blocked (e.g. private browsing restrictions). Plaintext `localStorage` is explicitly avoided for health metrics.
- **Privacy Assurance:** Zero passwords, tokens, email addresses, or user profiles are stored in the queue.
- **User Scoping:** Every storage query is filtered by the authenticated user's ID. Switching accounts prevents cross-contamination.
- **Explicit Logout Purge:** When a user initiates logout while items remain in the queue, a confirmation dialog appears:
  - **Sync First:** Replays all pending items immediately if online.
  - **Discard and Log Out:** Completely purges local offline items (`deleteQueue(userId)`) to prevent data leakage on shared devices.
- **Session Expiry:** If an access token expires while offline, mutations are marked `needs_auth` and preserved safely in IndexedDB until the user re-authenticates.

---

## 5. Replay Engine & Idempotency Guarantees

Mutations are replayed strictly in FIFO order (oldest `createdAt` first). Each request includes:
- `Idempotency-Key`: UUID v4 matching the mutation's key.
- `X-Timezone`: User's local timezone (e.g. `America/New_York`).

### Replay Outcomes & HTTP Handling

| Server Response | Queue Action | Status Transition | Explanation |
| :--- | :--- | :--- | :--- |
| `2xx Success` | Remove item | Reconciled | Server confirms mutation; local temporary entry replaced. |
| `401 / 403` | Pause replay | `needs_auth` | Session expired. Queue kept intact; UI prompts "Sign in to sync". |
| `400 / 422` | Retain item | `failed` | Schema or validation error. User can review or discard from sheet. |
| `409 IN_PROGRESS`| Delay retry | `pending` | Concurrent claim in flight. Retries after 1 second. |
| `429 / 5xx / Network` | Exponential backoff | `pending` | Base $2^n \times 1\text{s}$ (jittered, max 60s); respects `Retry-After` header. |
| Age > 14 Days | Retain item | `expired` | Out of retention window. Marked expired with user discard option. |

### Weight Conflict Resolution (Last-Writer-Wins)
When multiple weigh-ins occur for the same local day:
- The server evaluates the entry's `eventDate` against existing entries for that `localDay`.
- Newer weigh-ins update the day's record.
- Replaying an older weigh-in returns HTTP `200` with the response header `X-Conflict: stale-ignored`. The older record is safely acknowledged without overwriting the newer measurement.

### Retention & Abort Safeguards
- **Server TTL Alignment:** Completed server idempotency records are retained for `IDEMPOTENCY_TTL_HOURS = 336` (14 days) by default, strictly matching the client's 14-day offline retry retention window to prevent duplicate replays on long-disconnected clients.
- **Client Disconnect Cleanup:** If an HTTP connection closes or aborts prematurely while an operation is in-flight, the server immediately releases the `in_progress` claim via `res.on('close')`, allowing immediate retry upon reconnection without stranded 409 locks.

---

## 6. User Interface & Reconciliation

### Visual Indicators
The `SyncStatusIndicator` appears in the desktop sidebar and mobile navigation:
- **Synced:** Subtle checkmark when online and queue is empty.
- **Offline:** Warning pill indicating "will sync later".
- **Syncing N:** Animated spinner displaying active sync progress.
- **N Waiting:** Badge showing pending entries awaiting transmission.
- **Sign in to sync:** Warning badge when session authentication is required.
- **N need attention:** Alert indicator when an entry has failed or expired.

### Queue Management Sheet
Tapping any sync status indicator opens the `SyncQueueSheet`:
- Summarizes current connection status and queued entries.
- Displays human-readable descriptions (e.g., "500 ml Water", "75.5 kg Weight").
- Provides plain-language explanations for conflicts ("A newer weigh-in for that day was kept") and expiries.
- Offers per-item **Retry** and **Discard** (with inline confirmation) as well as **Retry All**.

### Optimistic UI & Reconciliation
- Optimistic entries receive a unique `tmp-*` identifier and a visible "Pending" badge.
- When an optimistic entry is deleted before sync, its queued mutation is cancelled via `discardItem()`.
- Deleting already-synced entries while offline is disabled with a helpful notification ("Needs an internet connection to delete synced entries").
- Upon sync completion, the `onReconcile` listener replaces optimistic rows with confirmed server records, avoiding duplicate entries even if SSE updates arrive concurrently.

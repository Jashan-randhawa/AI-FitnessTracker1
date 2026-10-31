# 📡 REST API Reference

[← Back to Documentation Index](README.md)

> ⏱️ **Last verified against code:** 2026-10-31 (commit 8a875d2)

## 📡 API Reference

All requests requiring authorization must include the header:  
`Authorization: Bearer <JWT_TOKEN>`

### Authentication & User Management
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/auth/local/register` | Register new user account with email verification | 5 req / 15m | Public |
| `POST` | `/api/auth/local` | Authenticate with email & password | 5 req / 15m | Public |
| `POST` | `/api/auth/google/callback` | Exchange Google OAuth access token for JWT session | — | Public |
| `POST` | `/api/email-verification/confirm` | Confirm account email verification token | 10 req / 15m | Public |
| `POST` | `/api/email-verification/request` | Request fresh email verification link | 3 req / 15m | Public |
| `GET` | `/api/users/me` | Fetch authenticated profile details | — | Private |
| `PUT` | `/api/users/:id` | Update profile biometrics, username, and custom macro/water goals | — | Private |
| `POST` | `/api/users/me/password` | Set password (OAuth) or update password (step-up required) | 5 req / 15m | Private |
| `GET` | `/api/connect/google` | Initiate Google OAuth sign-in | — | Public |
| `POST` | `/api/password-reset/request` | Request password reset email (Brevo HTTPS, 60s debounce) | 3 req / 1h | Public |
| `GET` | `/api/password-reset/validate` | Validate password reset token without consuming | 10 req / 15m | Public |
| `POST` | `/api/password-reset/reset` | Reset password using valid token (5-history protection) | 3 req / 1h | Public |
| `POST` | `/api/webhooks/email` | Brevo email delivery & bounce webhook receiver | 120 req / 1m | Webhook Key |

| `POST` | `/api/auth/refresh` | Single-flight refresh token rotation (RTR) via httpOnly cookie | 30 req / 15m | Public |
| `POST` | `/api/auth/logout` | Invalidate session family and clear httpOnly refresh token cookie | — | Private |
| `GET` | `/api/connect/google/callback` | Handle Google OAuth redirection and code exchange | — | Public |

### Nutrition & Food Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/foodlogs` | List all food entries for current user | — | Private |
| `POST` | `/api/foodlogs` | Create new food entry | — | Private |
| `DELETE` | `/api/foodlogs/:id` | Delete meal record | — | Private |

| `GET` | `/api/foodlogs/:id` | Fetch a single food log entry by ID | — | Private |
| `PUT` | `/api/foodlogs/:id` | Update an existing food log entry | — | Private |

### Exercise & Activity Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/activitylogs` | List all workout logs | — | Private |
| `POST` | `/api/activitylogs` | Log activity with optional structured exercises, sets, type, intensity & source | — | Private |
| `DELETE` | `/api/activitylogs/:id` | Delete activity record | — | Private |

| `GET` | `/api/activitylogs/:id` | Fetch a single activity log entry by ID | — | Private |
| `PUT` | `/api/activitylogs/:id` | Update an existing activity log entry | — | Private |

### Weight Tracking
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/weightlogs` | Fetch user weight records sorted chronologically | — | Private |
| `POST` | `/api/weightlogs` | Log weight entry (with automatic timezone-safe `localDay` derivation) | — | Private |
| `DELETE` | `/api/weightlogs/:id` | Delete weight measurement record | — | Private |

### Daily & Range Summary Aggregations
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/summary/day` | Get single-pass aggregated daily summary for a specific date (`?date=YYYY-MM-DD`) | — | Private |
| `GET` | `/api/summary/range` | Get multi-day aggregated analytics and trend summary (`?startDate=&endDate=`) | — | Private |

### Real-Time Server-Sent Events (SSE)
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/events/ticket` | Generate short-lived authentication ticket for SSE connection | — | Private |
| `GET` | `/api/events` | Stream live server events (`?ticket=<TICKET>`) for zero-reload reactive updates | — | Ticket Auth |

### Chat History & Conversations
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/chathistories` | Retrieve all chat sessions for the authenticated user | — | Private |
| `POST` | `/api/chathistories` | Save or create a chat session | 30 req / 1m | Private |
| `GET` | `/api/chathistories/session/:sessionId` | Retrieve messages for a specific chat session | — | Private |
| `PUT` | `/api/chathistories/session/:sessionId` | Upsert message history for a specific chat session | 30 req / 1m | Private |
| `DELETE` | `/api/chathistories/session/:sessionId` | Delete a single chat session | — | Private |
| `DELETE` | `/api/chathistories/all` | Purge all chat sessions and conversation memory | — | Private |

### Workout Plans & Voice Set Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/workout-plans` | List all saved workout plans for current user | — | Private |
| `GET` | `/api/workout-plans/active` | Fetch the currently active workout plan | — | Private |
| `POST` | `/api/workout-plans` | Save a new workout plan (auto-deactivates previous active plan) | — | Private |
| `PUT` | `/api/workout-plans/:id/active` | Set a specific plan as the active plan | — | Private |
| `DELETE` | `/api/workout-plans/:id` | Delete a workout plan | — | Private |
| `GET` | `/api/workouts/recommendations` | Get personalized workout recommendations | — | Private |
| `POST` | `/api/workouts/parse-voice-set` | Multimodal voice set parser (audio upload or spoken text) | — | Private |

### Water Intake
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/waterlogs` | Fetch user water intake records | — | Private |
| `POST` | `/api/waterlogs` | Log water consumption (amount in ml) | — | Private |
| `DELETE` | `/api/waterlogs/:id` | Delete water entry | — | Private |

| `PUT` | `/api/waterlogs/:id` | Update an existing water log entry | — | Private |

### Blog & Articles Management
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/blogs` | Retrieve paginated public fitness articles | — | Public |
| `GET` | `/api/blogs/:id` | Fetch full content of a specific article | — | Public |
| `POST` | `/api/blogs` | Create a new blog post (whitelisted fields only) | — | Admin Only (`isAdmin: true`) |
| `PUT` | `/api/blogs/:id` | Update an existing blog post | — | Admin Only (`isAdmin: true`) |
| `DELETE` | `/api/blogs/:id` | Delete a blog post | — | Admin Only (`isAdmin: true`) |

> 🔒 **Admin Access Note**: Blog creation, updates, and deletion are protected by `requireAdmin` middleware. To grant administrator privileges to an account, set `{ "isAdmin": true }` (type: Boolean) directly on the target user document in the MongoDB `users` collection via MongoDB Atlas or `mongosh`. No public API endpoint grants administrative access.

### System & Health Monitoring
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/health` | Uptime health check (MongoDB status, process uptime, timestamp) | — | Public |
| `GET` | `/api/metrics` | Prometheus-style application metrics endpoint | — | Token Auth |

### Generative AI & Media
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/ai/usage` | Fetch current user's daily AI budget status (tokens and calls used/remaining, per-feature breakdown, resetAt) | — | Private |
| `GET` | `/api/ai/admin/top-consumers` | List top token consumers for a given UTC day with keyset pagination (`?day=YYYY-MM-DD&limit=&cursor=`) | — | Admin Only (`isAdmin: true`) |
| `POST` | `/api/ai-assistant/chat` | Send message to FitBot Coach or run a planner (server-built context from `X-Timezone`; model fallback & retry) | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/ai/chat` | Playbook alias for `/api/ai-assistant/chat` | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/image-analysis` | Analyze meal photo for nutrition (multimodal Food Snap) | 10 req / 1h + 30 req / 1m | Private |
| `POST` | `/api/food-estimate` | Natural language text nutrition estimator | 30 req / 1m | Private |
| `POST` | `/api/calorie-estimate` | Estimate calories burned from exercise | 30 req / 1m | Private |
| `GET` | `/api/youtube/search` | Search workout videos via RapidAPI proxy (24h TTL cache) | 30 req / 1m | Private |

#### ⏱️ Per-User Daily AI Budgets & Rate Limit Response Contract
All AI endpoints enforce per-user daily token and call ceilings. Budget evaluation occurs **before** dispatching calls to external providers (Gemini or OpenRouter).

##### Successful Requests
Successful responses from any AI route return standard remaining quota headers:
- `X-AI-Budget-Remaining-Tokens`: Integer remaining tokens for the current UTC day.
- `X-AI-Budget-Remaining-Calls`: Integer remaining calls for the current UTC day.
- `X-AI-Budget-Reset`: ISO timestamp of next UTC midnight rollover (e.g. `2026-11-01T00:00:00.000Z`).

##### Quota Rejection (`HTTP 429 Too Many Requests`)
When a user's daily token, call, or feature quota is exhausted:
- **Status**: `429 Too Many Requests`
- **Headers**:
  - `Retry-After`: Integer seconds until next UTC midnight reset.
  - `X-RateLimit-Reset`: ISO timestamp of next UTC midnight.
  - `X-AI-Budget-Remaining-Tokens`: `0`
  - `X-AI-Budget-Remaining-Calls`: `0` (or remaining count)
- **JSON Body Contract**:
  ```json
  {
    "message": "Daily AI budget exceeded (TOKEN_BUDGET_EXCEEDED). Your budget will reset at midnight UTC.",
    "retryAfterSeconds": 41250,
    "remainingTokens": 0,
    "remainingCalls": 85,
    "resetAt": "2026-11-01T00:00:00.000Z",
    "error": {
      "message": "Daily AI budget exceeded (TOKEN_BUDGET_EXCEEDED). Your budget will reset at midnight UTC.",
      "code": "AI_DAILY_BUDGET_EXCEEDED",
      "retryAfterSeconds": 41250,
      "remainingTokens": 0,
      "remainingCalls": 85,
      "reason": "TOKEN_BUDGET_EXCEEDED",
      "resetAt": "2026-11-01T00:00:00.000Z"
    }
  }
  ```

#### 📸 Food Snap Image Ingestion & Validation (`POST /api/image-analysis`)
- **Transport**: Ingested via `multipart/form-data` (form field: `image`) streamed directly into in-memory buffer via Multer. (Fallback JSON payload with `{ image: "<base64>" }` is supported with pre-decode length checks).
- **Size Limit**: 4 MB maximum decoded buffer size (`MAX_IMAGE_BYTES`).
- **Allowed Formats**: `image/jpeg`, `image/png`, `image/webp`. Binary magic bytes are strictly inspected on the server to prevent file extension spoofing.
- **Error Contract**:
  - `400 Bad Request`: Empty file, corrupt image buffer, invalid base64 encoding, or resolution above `MAX_IMAGE_PIXELS` (`IMAGE_DIMENSIONS_TOO_LARGE`).
  - `413 Payload Too Large`: Decoded image exceeds 4 MB.
  - `415 Unsupported Media Type`: Unsupported format (HEIC, GIF, SVG, BMP, TIFF, PDF) or content/header MIME mismatch.
  - `429 Too Many Requests`: Rate limit reached (10 photos/hour per user).
- **Auto-Save Option**: Include `?autoSave=true` query param to persist high-confidence analysis ($\ge 0.75$) into user's `FoodLog` in 1 HTTP roundtrip.

### 🔄 Offline Logging & Write Idempotency Contract

The write endpoints (`POST /api/waterlogs`, `POST /api/weightlogs`, `POST /api/foodlogs`, and `POST /api/activitylogs`) support safe, replayable mutation requests queued offline.

#### Idempotency Key Semantics
- **Extraction**: Read from `Idempotency-Key` (preferred), `X-Idempotency-Key`, or `body.data.idempotencyKey` / `body.idempotencyKey` (for backwards compatibility with AI assistant chat actions).
- **Key Format**: Must be 8–128 characters matching `^[A-Za-z0-9_:.-]+$`. Invalid formats return `400 Bad Request` with `{ code: 'INVALID_IDEMPOTENCY_KEY' }`.
- **Missing Key**: Requests without an idempotency key execute standard non-idempotent creation.
- **Scoping**: All idempotency records are scoped strictly per authenticated user (`{ user, key }`).

#### Status Codes & Replay Headers
- **`200 OK`**: Replayed completion of water, food, or activity creation, or a stale-ignored weight entry.
- **`201 Created`**: Replayed completion of a weight log creation (or original write).
- **`Idempotency-Replayed: true`**: Present on all replayed responses served from the durable idempotency store.
- **`409 Conflict` (`IDEMPOTENCY_IN_PROGRESS`)**: Returned when a duplicate request arrives while the original operation is still in flight. Includes `Retry-After: 1` header.
- **`422 Unprocessable Entity` (`IDEMPOTENCY_KEY_REUSED`)**: Returned when an idempotency key is reused with a different request method, route, or canonicalized payload.
- **Failure Recovery (5xx)**: If an operation returns a 5xx status code or unhandled exception, the in-progress claim is immediately deleted so retries can proceed cleanly.

#### Payload Validation & Range Limits
- **Water (`POST /api/waterlogs`)**: `amount` must be a finite number between 1 and 10000 ml. Fields are whitelisted strictly to `amount` and `date`.
- **Food (`POST /api/foodlogs`)**:
  - `name`: non-empty string up to 100 characters.
  - `calories`: finite number between 0 and 20000 kcal.
  - `protein`, `carbs`, `fat`: finite numbers between 0 and 2000 g (optional / default 0).
  - `mealtype` / `mealType`: restricted to `breakfast`, `lunch`, `dinner`, or `snack`.
  - Fields are whitelisted to valid food attributes (`name`, `calories`, `protein`, `carbs`, `fat`, `mealtype`, `mealType`, `date`, `aiGenerated`).
- **Weight (`POST /api/weightlogs`)**:
  - `weightKg`: finite number between 20 and 400 kg.
  - **Conflict Rule (Event-Time Last-Writer-Wins)**: Exactly one entry per user per `localDay`. When a weigh-in arrives for an existing same-day record:
    - If the incoming event `date` is **older** than the stored same-day record's date, the server ignores the write, leaves `User.weight` untouched, suppresses SSE change events, and returns `200 OK` with the stored entry and header `X-Conflict: stale-ignored`.
    - If the incoming event `date` is **equal or newer**, the server upserts the entry, syncs `User.weight` if it is the newest overall weigh-in, and returns `201 Created`.
  - `localDay`: Explicit valid `localDay` in request body (`YYYY-MM-DD`) takes precedence over the `X-Timezone` header.
- **Date Range Boundary**: For water, food, and weight writes, dates cannot be more than 5 minutes in the future, nor older than `OFFLINE_MAX_AGE_DAYS` (default 30 days). Violations return `400 Bad Request` with `{ code: 'DATE_OUT_OF_RANGE' }`.

---

### 🌤️ Outdoor Weather & News
| Method | Endpoint | Description | Rate Limit | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/news/headlines` | Fetch curated live health & fitness headlines with 1-hr in-memory cache | 60 req / 15m | Public |


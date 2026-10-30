# AI Fitness Tracker — API (Express + MongoDB)

This is the production backend API service for FitTrack AI, built on Express and MongoDB.
It provides authentication, health metrics, food & workout tracking, and AI-driven coaching features.

## Setup

```bash
cd server
npm install
cp .env.example .env   # fill in the values below
npm run dev             # nodemon, auto-restart
# or
npm start                # plain node
```

Requires a MongoDB instance — local (`mongodb://127.0.0.1:27017/fittrack`)
or a free [Atlas](https://www.mongodb.com/atlas) cluster. On first boot the
server seeds the `blogs` collection with sample posts if the collection is empty.

## Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth token signing |
| `OPENROUTER_API_KEY` | Powers AI chat, image analysis, calorie/food estimation |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google sign-in |
| `NEWS_API_KEY` | Health news headlines |
| `RAPIDAPI_KEY` | YouTube workout video search |
| `BREVO_API_KEY` / `EMAIL_FROM` | Password reset & security notice emails via Brevo HTTPS REST API (Port 443) |
| `BREVO_WEBHOOK_KEY` | Optional HMAC key for `/api/webhooks/email` |
| `REDIS_URL` | Optional Redis URL for distributed rate limiting & token store |
| `METRICS_TOKEN` | Optional bearer token for Prometheus `/metrics` |

`GOOGLE_CALLBACK_URL` must point at **this server** (e.g.
`http://localhost:1337/api/connect/google/callback`), and that exact URL
must be registered in Google Cloud Console → Credentials → your OAuth
client → Authorized redirect URIs.

## Structure

```
server/
├── server.js              # entry point: connect DB → seed → listen
└── src/
    ├── app.js              # Express app: helmet, CORS, body parsing, routes
    ├── config/db.js
    ├── models/             # Mongoose schemas (data models)
    ├── controllers/        # Express route controllers
    ├── routes/             # Express API routes
    ├── middleware/         # auth (JWT), upload (multer), error handling
    ├── services/           # OpenRouter calls, email, blog seed, password-reset logic
    └── utils/
```

## Key Architecture & Security Decisions

The server architecture emphasizes security, reliability, and low latency:

- **AI endpoints now require a valid login.** `ai-assistant/chat`,
  `image-analysis`, and `calorie-estimate` were `auth: false` (fully public)
  in the original, even though every page that calls them already sends a
  Bearer token. Left open, a public deployment could let anyone burn through
  your OpenRouter key. `food-estimate` already required auth.
- **Ownership checks on updates.** `PUT /api/users/:id` and
  `PUT /api/foodlogs|activitylogs/:id` now confirm the record belongs to the
  caller. Ensures users cannot view or mutate another user's health and fitness records.
- **`ActivityLog.date` actually persists now.** Both `date` and `createdAt` fields are explicitly declared and persisted in the schema to ensure consistent day-based queries and time-series aggregation.
- **Password reset tokens are queried directly.** Indexed MongoDB fields (`resetPasswordTokenHash`, `resetPasswordExpires`) allow instant O(1) indexed lookups without in-memory linear scans.
- **A couple of error responses now surface the real message.** On
  `image-analysis` and `food-estimate`, the client reads
  `error.response.data.error.message`, but the original controllers
  returned `error` as a plain string — so failures always fell back to a
  generic toast. The response shape now matches what the client already
  reads, so specific errors (e.g. "Could not identify food in the image")
  actually show up.
- **`/api/blogs` write routes require login.** Blog article creation and editing are strictly protected and require administrator status (`isAdmin: true`). Public reads remain open.

## Dual Sign-In Architecture (Google OAuth + Password)

FitTrack AI implements a **single account, two ways to sign in** architecture. Users can seamlessly access their account with Google OAuth, standard email & password, or both:

### Account Linking Matrix

| Case | Scenario | Action | Security Behavior |
|---|---|---|---|
| **1** | Matching `googleId` exists | Sign in | Direct issuance of JWT session |
| **2** | Email exists with *different* `googleId` | Refuse | Returns `google_account_mismatch` (prevents cross-account takeover) |
| **3** | Brand new email | Create account | Sets `provider: 'google'`, `emailVerified: true`, `hasPassword: false` |
| **4** | Legacy Google user (no `googleId`, `hasPassword: false`) | Bind `googleId` | Automatically binds sub to existing account |
| **5** | Verified password account (`emailVerified: true`) | Link `googleId` | Seamlessly links Google account & dispatches security notice email |
| **6** | Unverified squatted account (`emailVerified: false`) | Reclaim | Sets `googleId`, wipes unverified squatter password, updates `passwordChangedAt` to invalidate any active squatter sessions |

### Security Controls & Session Safety

- **Session Invalidation**: Whenever a password is changed, added, or reset, `user.passwordChangedAt` is updated. Any JWT with an issued-at (`iat`) timestamp prior to `passwordChangedAt` is instantly rejected with HTTP 401 across all protected routes.
- **Step-Up Authentication (`requireRecentLogin`)**: Setting a password on a Google-only account requires an active session authenticated within the last 15 minutes (`MAX_AGE = 900s`). Stale sessions are rejected with HTTP 403 `reauth_required`.
- **Unified Password Policy**: Enforces minimum 8 characters, uppercase, lowercase, digit, and special character.
- **Password History & Anti-Reuse**: Stores the last 5 password hashes in `user.passwordHistory` and checks both current and historical passwords to prevent credential cycling.
- **Anti-Enumeration Timing Protection**: Public password reset and verification endpoints respond in constant time with uniform success messages regardless of whether the email exists.
- **Signup Email Verification**: New email/password registrations generate a 24-hour cryptographic verification token and send a verification link via Brevo. Confirmed at `/verify-email`.

## Testing performed

- Comprehensive unit and integration test suite: **644+ passing tests across 179 suites** (`npm test`).
- Automated suites cover:
  - Phase P1: Data model extensions & serialization (`phase1-datamodel.test.js`)
  - Phase P2: Session safety & passwordChangedAt invalidation (`phase2-session-safety.test.js`)
  - Phase P3: Google Sign-in hardening & decision matrix (`phase3-google-linking.test.js`)
  - Phase P4: Password management & reuse prevention (`phase4-password-management.test.js`)
  - Phase P5: Reset flow adjustments & provider preservation (`phase5-reset-adjustments.test.js`)
  - Phase P6: Email verification lifecycle (`phase6-email-verification.test.js`)
  - Brevo email delivery, retries, and webhooks (`passwordReset.test.js`)
  - Express API routes, auth protection, rate limiting, and metrics.


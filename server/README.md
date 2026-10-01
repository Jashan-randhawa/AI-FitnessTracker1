# AI Fitness Tracker — API (Express + MongoDB)

This is a MERN-stack replacement for the original Strapi 5 backend. Every
route, request/response shape, and business rule (AI prompts, calorie
formulas, password-reset flow, etc.) was ported to match what the existing
React client already expects — **the `client/` folder needs zero changes.**

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
server seeds the `blogs` collection with the same 6 sample posts the
original Strapi bootstrap hook created.

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
| `CLIENT_URL` | Used for CORS and building redirect/reset links |
| `SMTP_*` / `EMAIL_FROM` | Password reset emails (any standard SMTP provider, e.g. Gmail with an App Password) |

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
    ├── models/             # Mongoose schemas (one per Strapi content-type)
    ├── controllers/        # one per original Strapi controller
    ├── routes/             # one per original Strapi route file
    ├── middleware/         # auth (JWT), upload (multer), error handling
    ├── services/           # OpenRouter calls, email, blog seed, password-reset logic
    └── utils/
```

## Mapping from the original Strapi backend

| Strapi concept | MERN equivalent |
|---|---|
| Content-type schema (`schema.json`) | Mongoose model |
| `strapi.entityService` | Mongoose queries (`find`, `create`, `findOneAndUpdate`, …) |
| `ctx.state.user` (JWT + users-permissions) | `req.user`, set by `middleware/auth.js` |
| Core controller factories | Explicit Express route handlers |
| Bootstrap permissions (`src/index.ts`) | Route-level `protect` middleware |
| Email plugin | Brevo REST API (HTTPS/443) via `services/email.service.js` |
| Google OAuth (`grant` under the hood) | Plain OAuth2 authorization-code flow in `auth.controller.js` |

## Deliberate differences from the original

A handful of small, low-risk fixes were made along the way. None of them
require any client-side change — the client already behaves as if these
were already true.

- **AI endpoints now require a valid login.** `ai-assistant/chat`,
  `image-analysis`, and `calorie-estimate` were `auth: false` (fully public)
  in the original, even though every page that calls them already sends a
  Bearer token. Left open, a public deployment could let anyone burn through
  your OpenRouter key. `food-estimate` already required auth.
- **Ownership checks on updates.** `PUT /api/users/:id` and
  `PUT /api/foodlogs|activitylogs/:id` now confirm the record belongs to the
  caller. Strapi's default core `update` action doesn't enforce this unless
  a policy is added, and none was — the client only ever updates its own
  records, so this is invisible in normal use.
- **`ActivityLog.date` actually persists now.** The original schema never
  declared this field, so the controller's `date` assignment was silently
  dropped by Strapi on every save, even though it looked like it worked.
  Logs relied on `createdAt` as a fallback. Both fields now hold the same
  value, exactly as the code already intended.
- **Password reset tokens are queried directly.** The original scanned
  every user with a non-null token and parsed a JSON blob per row, because
  Strapi couldn't filter on JSON fields ("*We scan because Strapi doesn't
  support JSON field filtering*" — from the original code comment). Mongo
  can index and query this directly.
- **A couple of error responses now surface the real message.** On
  `image-analysis` and `food-estimate`, the client reads
  `error.response.data.error.message`, but the original controllers
  returned `error` as a plain string — so failures always fell back to a
  generic toast. The response shape now matches what the client already
  reads, so specific errors (e.g. "Could not identify food in the image")
  actually show up.
- **`/api/blogs` write routes require login.** The original only exposed
  blog writes through Strapi's separate Admin panel, which has no MERN
  equivalent here. Reads are still fully public.

Everything else — every path, payload shape, prompt, and status code — is a
direct port.

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

- Comprehensive unit and integration test suite: **124 passing tests across 33 suites** (`npm test`).
- Automated suites cover:
  - Phase P1: Data model extensions & serialization (`phase1-datamodel.test.js`)
  - Phase P2: Session safety & passwordChangedAt invalidation (`phase2-session-safety.test.js`)
  - Phase P3: Google Sign-in hardening & decision matrix (`phase3-google-linking.test.js`)
  - Phase P4: Password management & reuse prevention (`phase4-password-management.test.js`)
  - Phase P5: Reset flow adjustments & provider preservation (`phase5-reset-adjustments.test.js`)
  - Phase P6: Email verification lifecycle (`phase6-email-verification.test.js`)
  - Brevo email delivery, retries, and webhooks (`passwordReset.test.js`)
  - Express API routes, auth protection, rate limiting, and metrics.


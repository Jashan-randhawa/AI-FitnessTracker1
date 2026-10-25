# FitTrack AI — Architecture & Developer Guide

## Overview

**FitTrack AI** is a full-stack, AI-powered health and fitness operating system built on a modern MERN-like stack:
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Framer Motion, Recharts, Vite 7
- **Backend**: Node.js (>=20.0.0), Express 4.19, MongoDB & Mongoose 8
- **AI & Integrations**: OpenRouter LLMs (FitBot & meal planners), Open-Meteo API (weather & AQI), RapidAPI (YouTube workout streaming)

---

## System Architecture

```
AI-FitnessTracker1/
├── client/                     # React 19 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── assets/             # Types, SVGs, static assets
│   │   ├── components/         # Reusable UI, animations, Sidebar, BottomNav
│   │   ├── configs/            # Axios API instance with VITE_API_URL
│   │   ├── Context/            # AppContext (auth, logs) & ThemeContext
│   │   ├── Pages/              # Dashboard, FoodLog, ActivityLog, Workouts,
│   │   │                       # MealPlanner, ActivityPlanner, AIAssistant,
│   │   │                       # Weather, Profile, Blog, Login, Onboarding
│   │   ├── App.tsx             # Route definitions & guards
│   │   └── main.tsx            # App bootstrap
│   ├── .env.example            # Frontend environment variable template
│   └── package.json
│
└── server/                     # Express + MongoDB backend
    ├── src/
    │   ├── config/             # MongoDB connection (db.js)
    │   ├── controllers/        # Express request handlers
    │   ├── middleware/         # Auth (protect), rateLimiter, upload, errorHandler
    │   ├── models/             # Mongoose schemas (User, FoodLog, ActivityLog, etc.)
    │   ├── routes/             # REST route declarations
    │   ├── services/           # Business logic, email, AI services, seeders
    │   ├── utils/              # Token generation, response formatting
    │   └── app.js              # Express app setup, CORS, Helmet, rate limiting
    ├── server.js               # Entrypoint & listener
    ├── .env.example            # Backend environment variable template
    └── package.json
```

---

## API Endpoints

### Authentication & Users
- `POST /api/auth/local/register` — Register a new account *(rate limited: 20 req / 15 min)*
- `POST /api/auth/local` — Login with username/email and password *(rate limited)*
- `GET /api/users/me` — Fetch current authenticated user profile *(JWT required)*
- `GET /api/connect/google` — Initiate Google OAuth 2.0 flow
- `GET/POST /api/auth/google/callback` — Exchange Google access token for app JWT

### Password Reset
- `POST /api/password-reset/request` — Request password reset email *(rate limited: 10 req / 15 min; generic response to prevent account enumeration)*
- `GET /api/password-reset/validate?code=TOKEN` — Validate reset token
- `POST /api/password-reset/reset` — Reset password with token

### Resource Logs (User-Scoped & Authenticated)
- `GET /api/foodlogs`, `POST /api/foodlogs`, `DELETE /api/foodlogs/:id`
- `GET /api/activitylogs`, `POST /api/activitylogs`, `DELETE /api/activitylogs/:id`
- `GET /api/waterlogs`, `POST /api/waterlogs`, `DELETE /api/waterlogs/:id`
- `GET /api/chathistories`, `POST /api/chathistories`, `DELETE /api/chathistories/:id`

### System & Health Monitoring
- `GET /api/health` — Live health check returning MongoDB status (`connected`/`degraded`), uptime, and timestamp

### AI & Media Services
- `POST /api/ai-assistant/chat` — Context-aware chat with FitBot *(JWT required; dual rate limited: 30 req/min per IP + 20 req/min per user account; exponential backoff retries on transient errors; automatic fallback to `OPENROUTER_FALLBACK_MODEL`; 5-min TTL cache; and structured JSON repair for Activity Planner)*
- `POST /api/image-analysis` — Multimodal meal photo analysis *(JWT required, rate limited: 30 req / min)*
- `POST /api/food-estimate` — AI food nutrition estimation *(rate limited: 30 req / min)*
- `POST /api/calorie-estimate` — Activity calorie estimation *(rate limited: 30 req / min)*
- `GET /api/youtube/search?q=QUERY` — Workout video search proxy *(rate limited: 30 req / min)*

---

## Security & Reliability Architecture

1. **Helmet & Cross-Origin Resource Policy**: Set to protect against common web vulnerabilities.
2. **CORS Restrictions**: Origin whitelist restricting access to production URL, localhost, and `CLIENT_URL`. Exposes `X-Request-Id` header.
3. **JWT Authentication**: Secure Bearer tokens with 30-day expiration.
4. **Dual-Tier Rate Limiting (`express-rate-limit`)**:
   - Authentication brute-force defense (20 req / 15 min per IP)
   - Password-reset enumeration mitigation (10 req / 15 min per IP)
   - AI endpoints quota protection: 30 req/min per IP and 20 req/min per authenticated user (`aiUserLimiter`) to prevent NAT exhaustion
   - YouTube search proxy quota protection (30 req / min)
5. **No Account Enumeration**: Password reset returns identical success responses regardless of whether the email exists.
6. **Token Leakage Prevention**: Google OAuth uses URL fragments and POST payloads to prevent access tokens from leaking via query params or referrers.
7. **Environment-Gated Errors & Production Masking**: Detailed server error messages are gated behind `NODE_ENV !== 'production'`. Internal database driver errors are masked.
8. **Structured Logging & Secret Scrubbing**: Zero raw `console.log` in production; all logs use structured JSON formatting, correlation `X-Request-Id` headers, and automated redaction of passwords, tokens, and API keys.
9. **AI Resilience & Model Fallback**: Automatic retry on transient provider errors (429/5xx/timeouts) and seamless failover to fallback models before erroring gracefully with `503`.

---

## Context-Aware AI Architecture

All eligible AI features (FitBot chat, Meal Planner, Activity Planner) build their context on the server from the authenticated user's own records. The client never supplies goals, totals, or history.

**Shared context service** (`server/src/services/fitnessContext.service.js`)
- `buildFitnessContext({ user, timeZone })` returns the profile goals, today's totals and remaining targets, a 7-day trend, and the active workout plan. Daily and range figures come from `summary.service`, the same calculations the dashboard uses.
- Query cost is fixed per request: one day summary, one 7-day range summary, one active-plan lookup. Nothing scales with history length.
- Each section is loaded independently; a failed section is marked `unavailable` and logged by error name only, so the request still succeeds.
- An invalid or missing `X-Timezone` falls back to a safe default, and the local day is derived from the validated zone.

**Environment context** (`environment.service.js`, `environment.schema.js`, client `environmentPayload.ts`)
- Optional weather and local-time data are validated server-side. The schema has no field for coordinates or place names, so raw coordinates cannot reach a prompt.

**Planner context** (`plannerContext.service.js`, `utils/plannerLimits.js`)
- Meal and activity planners receive consumed and remaining targets, today's food names (sanitized, length-capped, read-only, user-scoped, query-limited), recent activity, and the active plan.

**Prompt and cache**
- `fitbot.prompt.js` (`PROMPT_VERSION` 1.6.0) treats the server-built `<fitness_context>` block as the only authoritative source for numbers. User-supplied text is sanitized before it enters a prompt.
- Response cache keys include the prompt version and a per-user scope (`user:<id>`, or `anon:<ip>`), so entries are not shared between users.
- Clinical safety guardrails are unchanged, except that the eating-disorder helpline reference now names the National Alliance for Eating Disorders (the former NEDA line is disconnected).

---

## Phase 6 Verification Record

Run on branch `main` at commit `382f5a7`, Node v22.22.2, after `npm ci`:

| Check | Exit code | Result |
|---|---|---|
| `cd server && npm test` | 0 | 459 passed, 0 failed, 0 skipped |
| `cd client && npm run build` | 0 | `tsc -b` and `vite build` succeeded |
| `cd client && npm run lint` | 0 | 0 errors, 130 warnings (mostly `no-explicit-any`) |

**Verified by code review:** user scoping of all context queries, fixed query count, cache scope and prompt-version keying, absence of coordinates from the environment schema.

**Not verified:** behavior against a live database, the real model provider, or a browser; per-scenario mapping of every Phase 6 integration case to a specific test; route-level request-size limits for AI endpoints (the global JSON limit is 5 MB).

---

## Local Development Setup

### 1. Backend (`/server`)
```bash
cd server
npm install
cp .env.example .env    # Configure MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY
npm run dev             # Starts API on http://localhost:1337
```

### 2. Frontend (`/client`)
```bash
cd client
npm install
cp .env.example .env    # Defaults to VITE_API_URL=http://localhost:1337
npm run dev             # Starts Vite on http://localhost:5173
```

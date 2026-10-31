# Phase 3: Manual Feature Verification Checklist

> **Reference**: AI-FitnessTracker1 Fix Plan (Page 3) — Priority 2
> **Purpose**: Manual verification protocol for end-to-end flows requiring databases, external APIs, and hardware peripherals.

---

## 1. Prerequisites & Environment Setup

Copy `.env.example` to `.env` in both `server/` and `client/` directories:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env # or verify VITE_ variables
```

Ensure the following service credentials are configured in `server/.env`:
- **Database**: `MONGODB_URI` (MongoDB connection string)
- **Authentication**: `JWT_SECRET` (at least 32 characters)
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Email Delivery**: `BREVO_API_KEY`, `EMAIL_FROM`
- **AI Core**: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- **YouTube Workout Search**: `RAPIDAPI_KEY` (YouTube workout streaming proxy; weather uses Open-Meteo with no key required)
- **Health News**: `NEWS_API_KEY`
- **Cache/Rate Limiting** (Optional): `REDIS_URL`

---

## 2. Feature Verification Matrix

| # | Flow | Verification Procedure | Required Services / Keys | Pass Criteria | Status |
|---|------|------------------------|--------------------------|---------------|--------|
| 1 | **Register & Login** | 1. Navigate to `/signup`<br>2. Register a new user<br>3. Verify redirection to onboarding/dashboard<br>4. Refresh browser<br>5. Log out | `MONGODB_URI`<br>`JWT_SECRET` | Token persists across page reloads; session state intact; logout clears token and storage. | `[ ]` |
| 2 | **Google Sign-In** | 1. Click "Sign in with Google"<br>2. Complete consent screen<br>3. Verify redirect to `/auth/google/callback` | `GOOGLE_CLIENT_ID`<br>`GOOGLE_CLIENT_SECRET` | Callback completes, user is authenticated, and redirected to `/dashboard`. | `[ ]` |
| 3 | **Password Reset Email** | 1. Navigate to `/forgot-password`<br>2. Submit registered email<br>3. Check inbox for Brevo email<br>4. Click reset link and update password | `BREVO_API_KEY`<br>`EMAIL_FROM` | Transactional email delivered via Brevo API; reset token accepted; new password allows login. | `[ ]` |
| 4 | **Food Snap (Vision v2)** | 1. Open Food Log modal<br>2. Upload meal photo (JPEG/PNG, <4MB)<br>3. Observe AI estimation | `GEMINI_API_KEY` | Multimodal model returns calories, macros, and dish title; single-RTT auto-save persists entry when confidence ≥ 0.75. | `[ ]` |
| 5 | **FitBot AI Chat** | 1. Navigate to `/ai-assistant`<br>2. Prompt: "Create a 3-day split workout plan"<br>3. Prompt: "Log 500ml of water" | `GEMINI_API_KEY` | Structured plans return with actionable buttons; function calls execute water and food logging; replies render in markdown with sanitization. | `[ ]` |
| 6 | **Voice Set Logging** | 1. Open Live Workout Tracker modal<br>2. Click mic icon and speak: "Bench press 80 kg for 8 reps RPE 8"<br>3. Confirm parsed set | `GEMINI_API_KEY`<br>Browser Microphone | Voice audio or speech recognition streams to server; structured set parsed; rest timer triggers automatically. | `[ ]` |
| 7 | **Offline Mutation Queue** | 1. Open Network tab in DevTools → Set to "Offline"<br>2. Log a food or activity entry<br>3. Set Network back to "Online" | `MONGODB_URI` (local/cloud) | Optimistic entry appears immediately with offline badge; on reconnection, mutation queue flushes once and syncs ID. | `[ ]` |
| 8 | **AI Rate Limiting** | 1. Send >10 Food Snap requests within 1 hour, or >30 FitBot chat messages | `Redis` (or in-memory rate limiter) | Clean HTTP 429 response received with `Retry-After` header; UI displays user-friendly cooldown warning without crash. | `[ ]` |
| 9 | **Weather, News & Video Widgets** | 1. View Dashboard weather widget (powered by Open-Meteo, no key needed)<br>2. View Blog health news feed<br>3. Search workout videos in Workout Tracker | Open-Meteo (free)<br>`NEWS_API_KEY`<br>`RAPIDAPI_KEY` | Weather cards render accurate forecast; news feed lists articles; workout video search queries YouTube via RapidAPI proxy; graceful fallback banner rendered if API fails. | `[ ]` |
| 10 | **Production Boot Check** | 1. Set `NODE_ENV=production`<br>2. Run `npm start` in `server/` | Full production `.env` | Server validates environment schema without fatal errors (`valid: true`); binds to configured `HOST` and `PORT`. | `[x]` |

---

## 3. DOMPurify Sanitization Verification

Following the critical dependency update of `dompurify` (v3.2.4) in Phase 1:
- Open `/ai-assistant` and verify chat responses containing markdown links, bold text, tables, and code snippets render without XSS vulnerability.
- Confirm browser console has zero script injection errors or unhandled DOM security exceptions.

---

## 4. Failure Logging Protocol

If any manual check fails:
1. Capture the exact timestamp and reproduction steps.
2. Inspect server logs (`server/` console or Render deploy logs).
3. Record the offending endpoint, status code, and error trace.
4. Open an isolated remediation task.

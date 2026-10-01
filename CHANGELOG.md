# 📋 Changelog

All notable changes to the **FitTrack AI** repository and ecosystem are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [[2.4.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v2.4.0)] — 2026-10-01

### 🛡️ Email Delivery Resilience & Duplicate Interception (F1–F5)
- **F1: Synchronous Double-Click Interceptor (`useRef`)**: Added synchronous `inFlightRef` in `ForgotPassword.tsx` to unconditionally intercept rapid duplicate click events before batched React state updates, preventing double submit triggers.
- **F2: 60-Second Active Token Debouncing**: If an active password reset token was issued within the last 60 seconds, `passwordReset.service.js` skips regenerating tokens and suppresses duplicate email dispatches. Keeps previous active link valid and prevents inbox spam while maintaining uniform anti-enumeration responses.
- **F3: Retry Hardening & Disconnect Protection**: Brevo REST API dispatch (`sendPasswordResetEmail`) halts immediately on timeout exceptions (`brevo_timeout`) without retry, preventing duplicate sends after remote acceptance.
- **F4: Distributed Redis Rate Limiting**: Verified atomic multi-command (INCR + TTL) rate limiting with automatic in-memory fallback during network drops.
- **F5: End-to-End Request ID Tracing**: Integrated `requestId` (`x-request-id`) through controllers, background dispatch workers, and structured security audit logs for 1:1 request traceability.

### 👤 Profile Customization & Username Management
- **Editable Username**: Enabled users to update their username directly from the Profile page and Edit Profile modal.
- **Live Validation & Conflict Prevention**: Enforced 3–30 character length constraints and case-insensitive MongoDB collision checks returning `409 Conflict` if taken.
- **Instant UI Synchronization**: Connected profile updates to React context (`useappcontext`) and storage for instant zero-reload updates.
- **Zero Vulnerability Audit**: Resolved package audit vulnerabilities; clean 0-vulnerability baseline across client and server.

---

## [[2.3.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v2.3.0)] — 2026-10-01

### 🔐 Unified Dual Sign-In Architecture (Google OAuth + Password)
- **One Account, Two Ways to Sign In**: Enables users with verified email addresses to link Google OAuth and standard password credentials to a single shared MongoDB user record without creating duplicate accounts or losing health logs.
- **6-Case Account Linking Matrix**:
  - Direct login for matching `googleId`.
  - Strict rejection with `google_account_mismatch` if an email is tied to a different Google account.
  - Safe automated binding for legacy Google accounts.
  - Linking with security notice dispatch for verified password accounts.
  - Reclaiming of unverified squatted accounts with password wiping and session invalidation.
- **Session Safety & Instant Invalidation**:
  - Auth middleware checks `decoded.iat < user.passwordChangedAt` on every protected route and instantly revokes tokens on password change/reset.
  - Step-up authentication middleware (`requireRecentLogin`) enforces a 15-minute window for sensitive credential additions.
- **Unified Password Policy & History Prevention**:
  - Enforced 8+ character strong password policy (uppercase, lowercase, number, special character).
  - Password history tracking (last 5 hashes) prevents credential reuse.
- **Signup Email Verification Flow**:
  - Built-in verification tokens (24-hour expiration) and dedicated `/verify-email` endpoint & UI.
- **Client Profile & Auth UI Enhancements**:
  - Added "Sign-in methods" management card to user profile.
  - Interactive "Add Password" / "Change Password" modal with live `PasswordStrengthMeter`.
  - First-login nudge banner for Google-only users.
  - Added "Continue with Google" to Forgot Password flow.

---

## [[2.2.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v2.2.0)] — 2026-10-01

### 📧 Brevo-Only Transactional Email Architecture
- **Pure HTTPS Port 443 Delivery**: Transitioned outgoing password reset emails to Brevo's REST API (`https://api.brevo.com/v3/smtp/email`), resolving egress SMTP port blocking (ports 25, 465, 587) on hosting environments such as Render.
- **Zero-Dependency Cleanup**: Uninstalled `nodemailer`, removed all legacy Gmail/SMTP/Resend code, and enforced zero forbidden mail dependencies via automated CI Guard (`scripts/ci-guard-email.js`).
- **Timing Oracle Protection**: Asynchronous background email dispatch guarantees uniform sub-100ms API response time regardless of email delivery duration, completely preventing user enumeration via timing discrepancies.
- **Token Hygiene on Delivery Failure**: If Brevo rejects or permanently fails email delivery, the active password reset token hash and expiration are immediately cleared from MongoDB to prevent orphaned valid tokens.
- **Bounced Recipient Suppression**: Recipients flagged with `emailBounced: true` automatically skip email dispatch while maintaining identical anti-enumeration responses.
- **Webhook Hardening**: Fortified `/api/webhooks/email` with timing-safe authentication (`BREVO_WEBHOOK_KEY`), SHA-256 event deduplication (`dedupeHash`), 256KB body payload limit, and rate limiting (120 req/min).

---

## [[2.1.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v2.1.0)] — 2026-09-28

### 📦 Modular Packages Ecosystem (`@jashan-randhawa/*`)
- **Published 7 Standalone npm Packages** to [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm):
  - `@jashan-randhawa/openrouter-resilient-client` (`v0.1.0`): Resilient OpenRouter LLM client with automatic model fallback, exponential retry with jitter, timeouts, and JSON extraction.
  - `@jashan-randhawa/express-ai-guard` (`v0.1.0`): Express middleware bundle providing dual-tier rate limiting (IP + authenticated user ID), request correlation ID (`X-Request-Id`), and production error masking.
  - `@jashan-randhawa/react-calendar-heatmap-streaks` (`v0.1.0`): Generic contribution-style heatmap with 4-level color scales, timezone-safe date calculations, and streak tracking.
  - `@jashan-randhawa/react-workout-tracker` (`v0.1.0`): Headless `useWorkoutSession` hook and live workout logging modal with rest countdown timer and celebration effects.
  - `@jashan-randhawa/react-motion-presets` (`v0.1.0`): Framer Motion animation presets, `AnimatedNumber`, `StreamingWordReveal`, and accessible `CollapsibleCard`.
  - `@jashan-randhawa/fitness-utils` (`v0.1.0`): Multi-entrypoint toolkit: `.` (BMI, BMR, TDEE, macros, CSV export), `./react` (Audio chime & Speech hooks), `./pdf` (Report PDF).
  - `@jashan-randhawa/ai-nutrition-estimator` (`v0.1.0`): Multimodal nutrition engine supporting NLP text meals, vision image analysis, MET exercise burn, and 5-min TTL cache.
- **Dual-Format Builds**: Packaged with `tsup` emitting modern ESM (`dist/index.js`), CommonJS (`dist/index.cjs`), and complete TypeScript declaration types (`dist/index.d.ts`, `dist/index.d.cts`).
- **Clean Tarballs**: Configured with `files: ["dist", "README.md", "LICENSE"]`, ensuring zero internal test fixtures, source maps, or credentials are leaked in tarballs.

### 🧠 FitBot AI Assistant & Coaching Enhancements
- **Hands-Free Voice Experience**: Integrated Speech-to-Text (STT) for hands-free query dictation and Web Speech API Text-to-Speech (TTS) read-aloud playback with visual audio meters.
- **Instant Generation Stop**: Single-tap abort control powered by client-side `AbortController` signal propagation.
- **Compact & Smooth Prompt Bar**: Redesigned prompt input with auto-expanding textarea (up to 140px), smooth scrolling, and safe-area notch padding for mobile devices.
- **Rich Markdown Tables & Collapsible Cards**: Native rendering for multi-day workout splits and macronutrient distributions, plus interactive collapsible plan cards.
- **Plan Export & Quick Copy**: 1-click Markdown file download of generated workout/diet plans and one-tap message clipboard copy with confirmation checkmarks.
- **Audio Completion Cue**: Dual-tone synthesized Web Audio API completion chime with quick header mute/unmute toggle.
- **60fps Chat Rendering**: Memoized message components and word reveal animations restricted to incoming messages to eliminate historical re-render lag.

### 🛡️ Backend Reliability & Security Hardening
- **Automated Model Failover**: Automatic failover to secondary fallback models (e.g., Gemini 2.0 Flash via `OPENROUTER_FALLBACK_MODEL`) when primary model (`openai/gpt-4o-mini`) experiences transient outages.
- **Dual-Tier AI Rate Limiting**: 30 req/min global IP limiter + 20 req/min authenticated user limiter keyed on `req.user.id` to prevent NAT starvation.
- **Correlation ID Tracing**: Integrated `requestId` middleware assigning and preserving persistent `X-Request-Id` UUIDs.
- **Structured JSON Logger & Scrubber**: Production logger with automated secret scrubbing (passwords, tokens, API keys, Bearer headers, JWTs).
- **Production Error Masking**: Strict masking of Mongoose, MongoDB, and database internals in production (`NODE_ENV === 'production'`) with generic user-friendly responses.
- **Sliding-Window Conversation Truncation**: Server-side bounds enforcing 50 messages max, 8,000 characters per single message, and graceful dropping of oldest messages when exceeding 40,000 total characters.
- **Versioned System Prompts**: Externalized FitBot system prompts into versioned constants (`prompts/fitbot.prompt.js`).

### 🧪 Testing & CI/CD Pipeline
- **91 Passing Unit Tests**:
  - 35 backend tests running natively on `node --test` across 13 test suites.
  - 56 package unit tests running on `vitest` covering retries, fallbacks, limiters, streak calculations, workout state transitions, and math formulas.
- **GitHub Actions CI**: Upgraded CI workflow with Linux native binding caching for Tailwind v4 / LightningCSS and multi-job syntax checks.
- **GitHub Packages Release Pipeline**: Automated packaging and publication workflow with provenance enabled.

---

## [[2.0.1](https://github.com/Jashan-randhawa/AI-FitnessTracker1/commit/eb565fe)] — 2026-09-27

### 🔒 Security Audit & Dependency Remediation
- **Critical CVE Remediation**: Bumped `jspdf` to `^4.2.1` in client, pulling patched `dompurify@3.4.16` and resolving confirmed critical XSS advisory in the dependency tree.
- **Multer Upgrade**: Bumped `multer` from outdated `1.4.x` to `2.4.0` resolving disclosed denial-of-service (DoS) advisories.
- **Rate Limiting Hardening**: Installed and wired `express-rate-limit@8.7.0` across auth routes (`5 req/15m`), password reset (`3 req/15m`), AI endpoints (`30 req/m`), and YouTube search proxy (`30 req/m`).
- **OAuth Token Security**: Replaced query-string token transfer with secure URL fragment (`#access_token=`) and POST body exchange, preventing token leakage in browser history and HTTP Referer headers.
- **Anti-Enumeration Password Recovery**: Unified responses across non-existent accounts, third-party OAuth providers, and upstream email errors to eliminate observable timing and oracle leaks.
- **YouTube Route Protection**: Enforced JWT authentication (`protect` middleware) on `/api/youtube/search` proxy.

### 🐛 CI Test-Failure Fix
- **Node 20 Runner Globstar Compatibility**: Fixed failing `test` script in `server/package.json` by replacing `test/**/*.test.js` with `test/*.test.js`, resolving globstar expansion failure on GitHub Actions Node 20 runners.
- **GitHub Actions CI Workflow**: Added `.github/workflows/ci.yml` establishing automated client lint/build and server syntax/test verification on every PR and commit.

---

## [[2.0.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v2.0.0)] — 2026-09-12

### 📱 Mobile Redesign & Architecture Upgrade
- **Mobile Navigation Dock**: Fixed bottom navigation bar with active micro-animations and tab switching.
- **Safe-Area Notch Padding**: Configured `viewport-fit=cover` and dynamic `.safe-area-pb` classes for iPhone dynamic islands and home indicators.
- **Responsive Drawer**: Unified slide-over drawer with profile summary, theme toggle, and mobile logout controls.
- **Full-Height Chat Viewport**: Dynamic `100dvh` layout preventing mobile soft keyboards from obscuring chat messages or input bars.
- **Technology Upgrades**: Upgraded frontend to React 19.2, TypeScript 5.9, Vite 7, and Tailwind CSS v4 design tokens.
- **Health News & Weather Hub**: Integrated Open-Meteo real-time weather & AQI forecasting and NewsAPI health feeds.

---

## [[1.0.0](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases/tag/v1.0.0)] — 2026-09-06

### 🚀 Initial Full-Stack Platform Release
- **Core Fitness Tracking**: Food logging with calorie and macronutrient tracking, activity workout logging, and water intake counter.
- **AI Core (FitBot)**: Initial conversational fitness coach powered by OpenRouter LLMs.
- **Authentication**: JWT stateless authentication, bcrypt password hashing, and Google OAuth 2.0 integration.
- **Media & Workouts**: Video library powered by RapidAPI YouTube search proxy and curated Punjabi gym pump playlists.
- **Data Export**: Initial PDF and PNG progress card downloads via jsPDF and html2canvas.

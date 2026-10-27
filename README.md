<div align="center">

# ⚡ FitTrack AI
### Intelligent Health, Nutrition & Fitness Operating System

[![Version](https://img.shields.io/badge/Version-v2.6.0-emerald?style=for-the-badge)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases)
[![CI](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml/badge.svg)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml)
[![GitHub Packages](https://img.shields.io/badge/GitHub_Packages-7_Published-2ea44f?style=for-the-badge&logo=github)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm)
[![Wiki](https://img.shields.io/badge/Documentation-Wiki-blue?style=for-the-badge&logo=github)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Unit_Tests-635_Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](#-testing--cicd)
[![Audit](https://img.shields.io/badge/Vulnerabilities-0-brightgreen?style=for-the-badge&logo=dependabot&logoColor=white)](#-security--authentication-hardening)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://ai-fitness-tracker1.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<p align="center">
  A full-stack, AI-powered health and fitness operating system designed to transform daily habits into measurable progress. Featuring multimodal AI meal logging, context-aware coaching with clinical safety boundaries, $O(N)$ single-pass analytics with midnight rollover, customizable macro & hydration goals, glassmorphism single-day and multi-day meal & activity planners with 1-click tracker logging, interactive heatmaps, and hardened dual authentication.
</p>

[🚀 **Explore Live Demo**](https://ai-fitness-tracker1.vercel.app) • [📦 **Modular Packages**](#-modular-packages-ecosystem) • [📖 **Wiki Documentation**](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki) • [✨ **Features**](#-features) • [📱 **Mobile View**](#-mobile-experience) • [🧪 **Testing & CI**](#-testing--cicd) • [🛠️ **Quick Start**](#-quick-start) • [📡 **API Reference**](#-api-reference)

---

</div>

## 🌟 Overview

**FitTrack AI** combines modern fitness tracking with generative artificial intelligence to deliver an experience that goes beyond standard calorie counting:

- **Intelligent Vision & NLP Logging:** Snap a photo or type a meal description; AI identifies foods and computes calories and macros automatically.
- **Context-Aware Coaching & Clinical Safety:** FitBot and the meal and activity planners build their context on the server from your own records (goals, today's food, activity and water, a 7-day trend, streak, and active workout plan), optionally with a validated weather observation, while enforcing clinical safe-harbor boundaries against hazardous dietary advice.
- **High-Performance Analytics & Midnight Rollover:** $O(N)$ single-pass daily totals aggregation engine (`dailyTotals.ts`), dynamic midnight rollover (`useToday`) with visibility detection, weekly insight tiles, and goal reference lines with rose exceed highlights.
- **Full-Stack Macro & Hydration Target Customization:** Profile and dashboard integration with customizable protein, carbohydrate, fat, and hydration goals, backed by intelligent automatic derivation (30/40/30 macro split, 2500 ml water).
- **Redesigned Modern Planners:** Glassmorphism UI for both Meal Planner and Activity Planner featuring single-day ("Today") and multi-day scheduling (1, 3, 5, 7 days), smart presets, and one-click "Log to Tracker" integration.
- **Interactive Calendar Heatmaps:** GitHub-style 90-day activity and nutrition heatmaps with intensity scaling, streak tracking, and instant date navigation.
- **Hardened Security & Rate Limiting:** Protected with dual-tier rate limiting (IP + authenticated user ID), strict AI payload caps, Brevo F1–F5 transactional email resilience, secure fragment-based Google OAuth, and anti-enumeration password resets.
- **Mobile-First Experience:** Built with responsive bottom-dock navigation, edge-to-edge notch handling, and adaptive data cards for desktop and mobile screens.
- **Comprehensive Wellness Hub:** Includes YouTube workout streaming with server-side caching, live workout tracker with draft persistence, Bhangra & gym pump playlists, persistent AI workout plans, real-time weather & Air Quality Index (AQI), and live fitness news.

---

## 📦 Modular Packages Ecosystem

FitTrack AI features **7 decoupled, production-grade npm packages** published under the [`@jashan-randhawa/`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm) scope on **GitHub Packages**. These modular libraries decouple the platform's core algorithms, security middleware, and interactive UI components for use across the JavaScript and TypeScript ecosystem.

| Package | Version | Registry | Description |
|---|---|---|---|
| [`@jashan-randhawa/openrouter-resilient-client`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/openrouter-resilient-client) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/openrouter-resilient-client) | Resilient OpenRouter LLM client with automated fallback model failover, exponential retry with jitter, timeouts, and JSON extraction. |
| [`@jashan-randhawa/express-ai-guard`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/express-ai-guard) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/express-ai-guard) | Express middleware bundle: dual-tier rate limiting (IP + authenticated user ID), request correlation ID (`X-Request-Id`), and production error masking. |
| [`@jashan-randhawa/react-calendar-heatmap-streaks`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-calendar-heatmap-streaks) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-calendar-heatmap-streaks) | Generic contribution-style heatmap with 4-level color scales, timezone-safe date calculations, and streak tracking. |
| [`@jashan-randhawa/react-workout-tracker`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-workout-tracker) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-workout-tracker) | Headless `useWorkoutSession` hook and live workout logging modal with rest countdown timer and celebration effects. |
| [`@jashan-randhawa/react-motion-presets`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-motion-presets) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-motion-presets) | Framer Motion animation presets, `AnimatedNumber`, `StreamingWordReveal`, and accessible `CollapsibleCard`. |
| [`@jashan-randhawa/fitness-utils`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/fitness-utils) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/fitness-utils) | Multi-entrypoint toolkit: `.` (BMI, BMR, TDEE, macros, CSV export), `./react` (Audio chime & Speech hooks), `./pdf` (Report PDF). |
| [`@jashan-randhawa/ai-nutrition-estimator`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/ai-nutrition-estimator) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/ai-nutrition-estimator) | Multimodal nutrition engine supporting NLP text meals, vision image analysis, MET exercise burn, and 5-min TTL cache. |

### Quick Installation via GitHub Packages
Configure your project's `.npmrc`:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```
Then install any package:
```bash
npm install @jashan-randhawa/openrouter-resilient-client
npm install @jashan-randhawa/express-ai-guard
npm install @jashan-randhawa/fitness-utils
```
> 📖 For comprehensive guides, API signatures, and interactive usage examples, explore the **[Wiki: Modular Packages Guide](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Modular-Packages)**.

---

## ✨ Features

### 🧠 1. Artificial Intelligence Core
- **FitBot Personal Coach (`/ai-assistant` & `/ai`):** Chat with a context-aware fitness assistant powered by OpenRouter LLMs. FitBot references your profile (weight, target calories, training goal) and remembers past sessions.
  - **Server-Built Fitness Context:** One shared, user-scoped context service (`server/src/services/fitnessContext.service.js`) reuses the dashboard's own summary and goal calculations, so AI answers match the numbers you see on screen. Missing data is reported as unavailable rather than zero, the local day comes from the validated `X-Timezone` header (with a safe fallback), and the prompt text is length-bounded. Context sent by the client is not trusted or forwarded.
  - **Weather & Local-Time Context (optional):** The Weather page's AI suggestions can send a compact observation (temperature, condition, precipitation chance, AQI, timestamp) that the server validates against fixed ranges. Raw coordinates and place names are never part of the contract, observations older than 3 hours are treated as stale, and missing data is never treated as safe weather. AQI uses the US EPA scale by default (`AQI_STANDARD`).
  - **Cache & Privacy:** Response cache keys include the full prompt, prompt version, and a per-user scope, so one user's personalised answer cannot be served to another.
  - **Zod Schema Validation & Plan Contracts:** Automated structural parsing and validation for meal and workout plans ensuring non-negative values, realistic workout durations ($\le 720$ min), and validated schema structures.
  - **Clinical Safety Boundaries & Non-Diagnosis Guarantees:** Built-in clinical safe harbor refusing harmful diet advice, extreme caloric deficits, or medical treatment prescriptions while requiring affirmative confirmation for rigorous training splits.
  - **Transparent AI Context & Memory Management:** User-directed conversation memory scoping, per-user isolation, and zero-leak context privacy controls (`/api/ai-assistant/memory`).
  - **LRU Query Caching & Concurrency Controls:** Bounded 5-minute query caching with LRU eviction and per-user concurrent request limits (`MAX_USER_CONCURRENT_AI_REQUESTS`).
  - **Idempotent Message Persistence & Cancellation:** Client-side generation cancellation with `AbortController`, request deduplication, and retry queues.
  - **Hands-Free Voice Experience:** Integrated Speech-to-Text (STT) for hands-free workout/diet queries, plus Text-to-Speech (TTS) read-aloud playback via the Web Speech API.
  - **Dynamic Input & Stop Controls:** Auto-resizing textarea (up to 140px) with single-tap instant generation abortion via `AbortController`.
  - **Rich Markdown Tables & Collapsible Cards:** Native rendering of markdown tables for multi-day workout splits and macro breakdowns, along with interactive collapsible plan cards.
  - **Resilience & Inline Error Retry:** Automatic fallback, retry on 429/5xx, and inline chat retry button for immediate one-click prompt re-dispatch.
  - **One-Click Export & Clipboard:** Download full workout and nutrition plans as formatted Markdown files or copy specific messages with checkmark confirmation.
  - **Audio Completion Cue:** Gentle dual-tone Web Audio API completion chime with quick mute/unmute header toggle.
  - **Ultra-Smooth 60fps UX:** Memoized message items and animated word reveal restricted strictly to the newest response, eliminating re-render stagger on past chat history.
- **Resilient AI Architecture & Transient Retries:** Integrated exponential backoff retry mechanism (1–2 retries) on network timeouts, provider hiccups, and 429/5xx status codes.
- **Automated Model Fallback (`OPENROUTER_FALLBACK_MODEL`):** Automatic failover to secondary fallback models (e.g., Gemini 2.0 Flash) if the primary model (`openai/gpt-4o-mini`) is temporarily unavailable.
- **Dual-Tier Rate Limiting:** 30 req/min per IP (`aiLimiter`) plus 20 req/min per authenticated user (`aiUserLimiter`) keyed on `req.user.id` to prevent NAT starvation and credit exhaustion.
- **Structured JSON Validation & Repair Retry:** Automated parse verification and repair retry on Activity Planner and Meal Planner calls, ensuring valid multi-day workout JSON plans.
- **AI Food Snap (Vision Analysis):** Upload or capture a meal photo directly from your camera for instant dish recognition and nutritional estimation.
- **Smart Natural Language Nutrition Estimator:** Type `"Grilled salmon with brown rice and broccoli"` and receive automated calorie and macronutrient breakdowns (Protein, Carbs, Fat).
- **Graceful Degradation:** Production outage handling delivering clear, user-friendly status responses (`503 Service Unavailable`) instead of raw stack traces.
- **Prompt Injection & Token Guardrails:** Server-side message history bounds (50 messages max), per-message length limits (8,000 chars), and graceful sliding-window conversation truncation.

### 📊 2. Health Analytics & Performance Engine
- **Single-Pass Daily Totals Engine (`dailyTotals.ts`):** High-performance $O(N)$ aggregation over food, activity, and water logs for blazing-fast streak calculations, daily totals, and weekly charts.
- **Live Midnight Rollover (`useToday` Hook):** Seamless date rollover at local midnight (`setTimeout`) and on tab visibility restoration (`visibilitychange`) without requiring a browser reload.
- **Weekly Insights & Trends Strip:** 4 actionable metrics computed across logged days:
  - Average Calories In per logged day.
  - Average Calories Burned per logged day.
  - Days on Target (`x/7`) meeting calorie goals with active meals.
  - Average Protein intake per logged day.
  - Week-over-week comparative percentage indicators (▲/▼ %) guarded against erratic divide-by-zero rates ($\ge 3$ logged days condition).
- **Goal Reference Lines & Visual Alerts:** Recharts `ReferenceLine` goals on calorie and macro chart tabs with dynamic `Cell` styling (rose `#f43f5e` highlight when exceeding calorie limits).
- **Customizable Macro & Hydration Goals:** Full-stack target configuration across Profile and Dashboard with dynamic macro progress bars ("x / goal g") and customizable hydration goals.
- **Next-Badge Gamification Progress:** Real-time progress bars for nearest unearned achievement badges (`x / target`).
- **Dynamic Time-Based Greeting:** Contextual greeting adapted to the user's local hour ("Good morning", "Good afternoon", "Good evening").
- **Interactive Dashboard:** 
  - **Dynamic Goal Rings:** Real-time visual meters for Calories In, Calories Out, and Active Minutes that scale responsively for mobile and desktop screens.
  - **Activity Streak Engine:** Tracks consecutive daily logging milestones with confetti celebrations.
  - **Net Calorie Calculator:** Instant calculation of caloric balance (Eaten vs. Burned).
  - **Macro Breakdown:** Protein, Carbohydrate, and Fat distribution cards.
  - **Automated BMI Calculator:** Visual BMI classification and personalized target alerts.
- **Interactive Calendar Heatmap (`CalendarHeatmap`):**
  - Contribution-style activity and nutrition heatmap embedded in both **Food Log** and **Activity Log**.
  - 4-level color intensity scaling based on daily calories consumed or burned.
  - Streak tracking (current & max streak), interactive day selection, and tooltip summaries for past 90 days.
- **Interactive Water Intake Tracker:** Visual hydration progress with quick-add presets (`+150ml`, `+250ml`, `+350ml`, `+500ml`), custom volume input, and customizable daily target.
- **Filterable Date Selector:** Historic log inspection with date-by-date nutritional breakdown.
- **Data Exports (PDF, CSV & PNG):**
  - **Formatted PDF Report:** Multi-page PDF report with stats summary, profile metrics, food logs, and activity records powered by jsPDF and AutoTable.
  - **Raw CSV Spreadsheets:** Downloadable comma-separated records of food and activity history with timestamps, categories, and nutritional values.
  - **PNG Progress Card:** Shareable visual progress cards generated client-side with html2canvas for streak milestones and stats.

### 🥗 3. Redesigned Meal & Activity Planners
- **Glassmorphism UI Overhaul:** Modern glass cards, glowing accents, and dark mode responsiveness matching app-wide design aesthetics.
- **Single-Day & Multi-Day Modes:** Support planning for 1 day ("Today / Single Day") in addition to multi-day schedules (3, 5, 7 days) in both Meal Planner and Activity Planner.
- **Smart Presets & Goal Filters:** Quick presets for Weight Loss, Muscle Gain, Maintenance, Keto, High Protein, Endurance, HIIT, Strength, and Home Workouts.
- **One-Click "Log to Tracker":** Seamlessly log meals directly to Food Log (`/api/foodlogs`) and workouts directly to Activity Log (`/api/activitylogs`) with validated payload normalization (`mealType`, `time`, `calories`, `protein`, `carbs`, `fat`, structured exercises, and sets).
- **Nutrition Summary & Macro Distribution:** Visual breakdown of daily calories, protein, carbs, and fat per day with progress against targets.
- **Adaptive Planning:** The server adds today's remaining calories and macros, the names of food already logged, your active workout plan, and your recent activity to every planner request. Day 1 of a meal plan fits what is left today, or is planned as tomorrow if today's budget is used up. If this context cannot be loaded, the request is refused with `503` instead of planning without your data. Planned meals and workouts are never logged automatically; logging stays an explicit button press.
- **Current limitation:** The Activity Planner does not yet receive weather, so it treats outdoor conditions as unknown and favours indoor options.

### 🏋️ 4. Workout Studio, Live Tracker & Music Player
- **Three-Tab Segmented Control:** Instantly switch between **Videos**, **Today's Plan**, and **Music** with compact mobile hero and animated tab transitions.
- **Today's Plan (Persistent Workout Plans):**
  - Auto-loads your active workout plan from the server on mount. Switch between multiple saved plans, mark one as active, or delete unused ones.
  - Activity Planner auto-saves AI-generated plans to `/api/workout-plans` for cross-session persistence — no more losing generated routines on page reload.
  - Enriched activity log payloads with `type`, `intensity`, and `source: "planner"` for granular analytics.
- **Live Workout Tracker:**
  - Full-featured in-session tracker launched from BottomSheet modals with drag-to-dismiss, body scroll lock, focus trapping, and Escape key support.
  - **Weight & Rep Stepper Controls:** ±2.5 kg weight and ±1 rep steppers with 44px minimum touch targets and responsive `flex-wrap` layout.
  - **Wall-Clock Accurate Rest Timer:** Uses `Date.now()` differential (not `setInterval` drift) for sub-second accuracy. Haptic `navigator.vibrate` feedback on timer completion.
  - **Draft Auto-Save & Restore:** Workout-in-progress automatically persisted to `localStorage`; resume mid-session even after accidental tab close.
  - **Finish & Log Session:** One-tap "Finish & Log Session" POSTs structured exercise/set data to `/api/activitylogs`, or "Discard" to clear the draft.
- **In-App Video Streaming:** Embedded modal video player powered by YouTube search with **24-hour TTL server-side caching** (Redis with in-memory `Map` fallback) and `X-Cache: HIT/MISS` response headers.
- **Horizontally Scrollable Filter Chips:** Category, level, and mood filters with swipe-to-scroll on mobile. All interactive elements meet 44px minimum tap target guidelines.
- **High-Energy Punjabi Gym Playlists:** Curated pump-up mixes (Diljit Dosanjh, AP Dhillon, Sidhu Moosewala, Karan Aujla, Shubh) tagged by BPM and mood (Hype, Pump, Warm-Up, Cool-Down).
- **Accessible BottomSheet Modals:** Framer Motion drag-to-dismiss with `max-h-[92dvh]`, safe-area bottom padding, focus trapping, and `prefers-reduced-motion` support.

### 🌤️ 5. Outdoor Weather & Health News
- **Live Weather & AQI:** Real-time temperature, wind, humidity, and Air Quality Index powered by Open-Meteo to plan safe outdoor training sessions.
- **Context-Aware Workout Suggestions:** AI suggestions use the current observation together with your logged data, and stay conservative when conditions are risky, stale, or incomplete.
- **Health & Wellness News Feed:** Live headlines curated from leading health publications via NewsAPI.
- **Curated Fitness Blog:** Informative fitness articles with search and category tags.

### 🔐 6. Security & Authentication Hardening
- **Unified Dual Sign-In Architecture (Google OAuth + Password):** Allows users to seamlessly authenticate with Google OAuth, standard password credentials, or both on a single shared account. Features a 6-case automated linking matrix, squat account protection, and cross-provider security alerts.
- **Resilient Google OAuth Callback Handling:** Frontend `GoogleCallback` utilizes a single-execution `useRef` lifecycle guard to eliminate duplicate OAuth code exchange triggers, timing-safe fragment scrubbing before React state changes, explicit URL parameter error code mapping (`access_denied`, `google_state_invalid`, `oauth_failed`), and an interactive fallback retry screen.
- **Session Safety & Instant Revocation:** Tokens are verified against `user.passwordChangedAt` on every protected request, immediately invalidating active JWTs across devices upon password change or reset. Step-up authentication (`requireRecentLogin`) enforces a 15-minute window for password changes.
- **Unified Password Policy & History Prevention:** Enforces 8+ character passwords with uppercase, numbers, and special characters. Maintains a rolling 5-password history hash to strictly block password reuse.
- **Signup & Profile Email Verification:** Built-in cryptographic verification tokens with 24-hour expiration, anti-enumeration endpoints, 60-second rate-limited resend debouncing with live UI countdown timer, unverified account warning banners, and dedicated verification screens.
- **Brevo HTTPS Transactional Email with 5-Layer Resilience (F1–F5):**
  - **F1 (Double-Click Interceptor):** Synchronous `inFlightRef` guard blocks duplicate API triggers before React state updates.
  - **F2 (60s Token Debouncing):** Suppresses duplicate dispatches within 60s cooldown, keeping the existing reset link valid.
  - **F3 (Retry Hardening):** Strict timeout handling breaks retry loops immediately to eliminate duplicate sends after remote acceptance.
  - **F4 (Distributed Rate Limiting):** Distributed atomic Redis rate limiting with automatic in-memory fallback.
  - **F5 (Request Tracing):** Correlates `requestId` end-to-end across controllers, background workers, and audit logs.
- **Zero-Vulnerability Security Baseline:** Continuous dependency audits with `npm audit` ensuring 0 known vulnerabilities across client and server packages.
- **Anti-Enumeration Password Recovery:** Uniform responses across all scenarios — including non-existent accounts, third-party OAuth providers, and upstream email delivery errors — ensuring no observable timing or oracle leaks exist.
- **Production Error Masking:** All database errors (`MongoServerError`, Mongoose internals) and unhandled 5xx exceptions are strictly masked with generic client messages in production (`NODE_ENV === 'production'`), shielding database topologies and credentials from client disclosure.

### 👤 7. Profile Customization & Data Management
- **Custom Macro & Hydration Targets:** Direct configuration for Daily Protein Goal (g), Daily Carbs Goal (g), Daily Fat Goal (g), and Daily Water Goal (ml), with intelligent automatic derivation (30% protein, 40% carbs, 30% fat from calorie target, 2500 ml water) when left blank.
- **Editable Username:** Users can update their username directly from the Profile card with live validation (3–30 characters) and case-insensitive conflict prevention.
- **Unified Sign-in Methods Card:** Symmetrical, responsive layout displaying Google Account linkage (`Linked`/`Not linked`) and Password credentials alongside an Email Verification card with live verification status badges (`Verified` / `Pending Verification`), resend verification triggers with 60s cooldown, and unverified account alert banners.
- **Goal & Biometrics Management:** Fine-tune target calorie intake, calorie burn goals, age, weight, and height with real-time recalculations.
- **Data Exports (PDF, CSV & PNG):**
  - **Formatted PDF Report:** Multi-page progress report with stats summary, profile metrics, food logs, and activity records powered by jsPDF and AutoTable.
  - **Raw CSV Spreadsheets:** Comma-separated food and activity history with timestamps, categories, and nutritional values.
  - **Shareable Progress Card:** Canvas-rendered progress cards for streak milestones and stats.

---

## 📱 Mobile Experience

FitTrack AI features a dedicated mobile architecture designed for modern smartphones:

| Feature | Description |
|---|---|
| **Bottom Navigation Dock** | Quick-access tab bar (Home, Food, Activity, Workouts, AI Coach) fixed to the bottom with active micro-animations, persisting cleanly across screens including the FitBot AI Coach. |
| **Full-Height Chat Viewport** | Dynamic `100dvh` layout with auto-scroll lock eliminates jitter, while preserving bottom navigation and input controls above mobile soft keyboards. |
| **Safe-Area Insets** | `viewport-fit=cover` and `.safe-area-pb` support to prevent clipping on iPhone dynamic islands and home indicators. |
| **Adaptive Goal Rings** | 3-column responsive goal rings that fit cleanly on compact mobile viewports without broken line wraps. |
| **Unified Mobile Drawer** | Slide-over drawer with user profile summary, one-tap theme toggle, and mobile logout functionality. |
| **Responsive Sign-in & Verification UI** | Responsive mobile cards for authentication methods and email verification status chips with touch-friendly actions and cooldown feedback. |

---

## 🛠️ Tech Stack

```mermaid
graph TD
    Client["Client (React 19 + TypeScript + Tailwind v4 + Vite)"]
    Server["Server (Node.js >=20 + Express 4.19)"]
    DB[("Database (MongoDB Atlas)")]
    Redis[("Redis (Optional Cache & Rate Limiting)")]
    OpenRouter["OpenRouter AI (LLM / Vision)"]
    OpenMeteo["Open-Meteo (Weather & AQI)"]
    Brevo["Brevo API (Transactional Email)"]
    YouTube["RapidAPI (YouTube Video Search)"]

    Client -->|REST API / JWT| Server
    Client -->|Direct Weather API| OpenMeteo
    Server -->|Mongoose ODM| DB
    Server -.->|24h TTL Cache & Distributed Rate Limit| Redis
    Server -->|Vision / Chat / Nutrition| OpenRouter
    Server -->|Password Reset Emails| Brevo
    Server -->|Workout Video Query| YouTube
```

### Frontend Architecture
- **Framework:** React 19.3 with TypeScript ~5.9
- **Build Engine:** Vite 8.x
- **Design System:** Tailwind CSS v4
- **Routing:** React Router v7 (`react-router-dom` 7.18+)
- **Motion & Micro-interactions:** Framer Motion 14.x
- **Data Charts:** Recharts 3.x (with ReferenceLines, dynamic Cells, and custom tooltips)
- **Document & Data Export:** jsPDF 4.2.x (patched DOMPurify), jsPDF-AutoTable 5.x, html2canvas
- **Data Modeling & Validation:** Zod 4.x
- **Icons:** Lucide React
- **Notifications:** React Hot Toast

### Backend Architecture
- **Runtime:** Node.js `>=20.0.0` (tested on Node 20 & 22)
- **Framework:** Express.js 5.x
- **Database & ODM:** MongoDB & Mongoose 9.x
- **Security & Reliability:** Helmet, CORS, `express-rate-limit` (dual IP and per-user limiters), bcryptjs, JSON Web Tokens (JWT), Role-Based Admin Auth (`requireAdmin`)
- **Contract Validation:** Zod 4.x
- **Media Ingestion:** Multer 2.4.x (multipart form handling for vision analysis)
- **Logging & Tracing:** Structured JSON Logger (`LOG_LEVEL`), automated secret scrubber (passwords, tokens, API keys), request ID correlation middleware (`X-Request-Id`), and HTTP access logging
- **Health & Monitoring:** Production uptime monitoring endpoint (`GET /api/health`) with live MongoDB connection state inspection
- **External Providers:** Google Gemini API (Food Snap vision, voice logging, agentic tools), OpenRouter (GPT-4o-mini & fallback models), Brevo HTTP API (transactional email), NewsAPI, RapidAPI

---

## 🧪 Testing & CI/CD

### Automated Test Suite
The backend contains an automated unit test suite built with Node.js's native test runner (`node --test`), requiring zero external test framework dependencies:

```bash
# Run server test suite
cd server
npm test
```

Test coverage includes **635 unit tests** across **176 suites** (100% passing, 0 external runner overhead):
- **Blog Admin Authorization & Field Whitelisting (`test/blogAdminAuthz.test.js`):** Role-based access control (RBAC), `requireAdmin` middleware verification, strict `isAdmin: true` database flag enforcement, and field whitelisting for blog write operations.
- **User Macro & Water Goals (`test/userGoals.test.js`):** Numeric validation, non-negative constraints (`min: 0`), and non-numeric casting guards for `dailyproteingoal`, `dailycarbsgoal`, `dailyfatgoal`, and `dailywatergoal`.
- **AI Structured Plans & Schemas (`test/aiPlans.test.js`):** Zod validation contracts for meal and workout plan JSON payloads, rejecting negative macros or unrealistic durations.
- **FitBot Reliability & Cancellation (`test/fitbotReliability.test.js`):** Idempotent persistence, request deduplication, and client abort handling.
- **FitBot Context, Memory & Privacy (`test/fitbotContextPrivacy.test.js`):** Per-user memory scoping, context injection, and privacy controls.
- **Shared Fitness Context (`test/fitnessContext.test.js`):** Complete and partial profiles, empty logs, missing plans, invalid timezones, day rollovers, user isolation, and prompt-size limits.
- **Weather & Local-Time Context (`test/environment.test.js`):** Range and enum validation, malformed or stale observations, missing fields, and conservative outdoor risk handling.
- **FitBot Contextual Coaching (`test/fitbotCoaching.test.js`):** Server-built context in prompts, prompt-version and cache-key behaviour, and cross-user cache isolation.
- **Adaptive Planners (`test/plannerContext.test.js`):** Remaining calorie and macro budgets, exceeded or missing targets, active-plan and streak rules, fail-closed behaviour, and planner limits.
- **Release Gate & Safety Boundaries (`test/phase6Release.test.js`):** Multi-user authorization boundaries, adversarial prompt injection defense, clinical safety safe harbor, and LRU cache isolation.
- **Auth & JWT (`test/auth.test.js`):** Token generation, signature validation, payload integrity, username/email/password registration validators, and login validation.
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

### Continuous Integration (GitHub Actions)
The repository includes a GitHub Actions CI workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) running on Node.js 20:
- **Client Job:** Dependency installation (`npm ci`), ESLint validation (`npm run lint`), TypeScript typecheck, and Vite production build (`npm run build`).
- **Server Job:** Dependency installation, JavaScript syntax validation (`node -c`), module loading check, CI email guard, and test execution (`npm test`).

---

## 📁 Project Structure

```text
AI-FitnessTracker1/
├── .github/
│   └── workflows/
│       └── ci.yml                       # GitHub Actions CI workflow
├── client/                              # React + TypeScript Client
│   ├── public/
│   │   └── favicon.svg                  # Brand favicon
│   ├── src/
│   │   ├── Pages/                       # Route views
│   │   │   ├── Dashboard.tsx            # Analytics, rings, streak, water, insights
│   │   │   ├── FoodLog.tsx              # Nutrition logging, AI food snap & heatmap
│   │   │   ├── ActivityLog.tsx          # Exercise tracker & activity heatmap
│   │   │   ├── AIAssistant.tsx          # FitBot AI chat interface
│   │   │   ├── Workouts.tsx             # 3-tab studio (Videos / Today's Plan / Music)
│   │   │   ├── MealPlanner.tsx          # Glassmorphism meal generator (1-day & multi-day)
│   │   │   ├── ActivityPlanner.tsx      # Glassmorphism workout generator (1-day & multi-day)
│   │   │   ├── Weather.tsx              # Live forecast & AQI
│   │   │   ├── Blog.tsx / BlogPost.tsx  # Fitness articles & news feed
│   │   │   ├── Profile.tsx              # User metrics, macro targets, PDF & CSV export
│   │   │   ├── Login.tsx                # Auth form (Sign in / Sign up)
│   │   │   ├── GoogleCallback.tsx       # Secure fragment-based OAuth handler
│   │   │   ├── ForgotPassword.tsx       # Password reset request view
│   │   │   ├── ResetPassword.tsx        # Password update view
│   │   │   └── Onboarding.tsx           # Initial setup questionnaire
│   │   ├── components/
│   │   │   ├── BottomNav.tsx            # Mobile fixed bottom navigation dock
│   │   │   ├── Sidebar.tsx              # Responsive sidebar & mobile drawer
│   │   │   ├── CalendarHeatmap.tsx      # 90-day activity & nutrition heatmap
│   │   │   ├── Logo.tsx                 # Dynamic SVG animated logo
│   │   │   ├── DateDropdown.tsx         # Date selector component
│   │   │   ├── ui/                      # Shared reusable UI primitives
│   │   │   │   └── BottomSheet.tsx      # Accessible drag-to-dismiss modal
│   │   │   └── animations/
│   │   │       ├── RestCountdownTimer.tsx     # Wall-clock accurate rest timer
│   │   │       ├── WorkoutSetRow.tsx          # Weight/rep stepper controls
│   │   │       └── LiveWorkoutTrackerModal.tsx # In-session tracker with draft save
│   │   ├── features/
│   │   │   └── workouts/
│   │   │       ├── types.ts             # Workout plan & exercise TypeScript types
│   │   │       └── data/
│   │   │           └── playlists.ts     # Static playlist data & filter constants
│   │   ├── utils/
│   │   │   ├── dailyTotals.ts           # O(N) single-pass daily aggregation & streak
│   │   │   └── deriveGoals.ts           # Automatic macro & hydration derivation
│   │   ├── hooks/
│   │   │   └── useVideoSearch.ts        # Unified video search hook (YouTube API)
│   │   ├── Context/
│   │   │   ├── AppContext.tsx           # Global user state & records
│   │   │   └── Themecontext.tsx         # Light/Dark mode state
│   │   ├── configs/
│   │   │   └── api.ts                   # Axios configuration (VITE_API_URL)
│   │   ├── App.tsx                      # Root routes & layout wrapper
│   │   └── index.css                    # Tailwind CSS v4 theme tokens
│   ├── index.html                       # HTML entry point (viewport-fit)
│   └── vite.config.ts                   # Vite configuration
│
├── server/                              # Express + MongoDB API
│   ├── server.js                        # Server entry point
│   ├── test/                            # Unit tests (node --test - 176 suites / 635 tests)
│   │   ├── aiAssistant.test.js          # AI payload caps & truncation tests
│   │   ├── aiPlans.test.js              # Zod schema validation for structured plans
│   │   ├── auth.test.js                 # Auth & JWT unit tests
│   │   ├── blogAdminAuthz.test.js       # Admin authorization & blog write field whitelisting tests
│   │   ├── brevoEmailService.test.js    # Brevo email delivery tests
│   │   ├── chatHistory.test.js          # Chat history persistence tests
│   │   ├── errorHandler.test.js         # Error handling & production masking tests
│   │   ├── estimates.test.js            # Calorie & food estimate tests
│   │   ├── environment.test.js          # Weather & local-time context validation tests
│   │   ├── fitbotCoaching.test.js       # Contextual coaching, prompt version & cache tests
│   │   ├── fitbotContextPrivacy.test.js # FitBot context, memory & privacy tests
│   │   ├── fitbotReliability.test.js    # FitBot retry & cancellation tests
│   │   ├── fitnessContext.test.js       # Shared server-side fitness context tests
│   │   ├── health.test.js               # Health check & request-ID tests
│   │   ├── logger.test.js               # Logger & secret scrubber tests
│   │   ├── metrics.test.js              # Prometheus metrics tests
│   │   ├── openrouter.test.js           # OpenRouter resilience & prompt tests
│   │   ├── passwordReset.test.js        # Password reset validation tests
│   │   ├── phase6Release.test.js        # Release gates, clinical safety & security boundaries
│   │   ├── plannerContext.test.js       # Meal & activity planner context tests
│   │   ├── userGoals.test.js            # User macro and water targets validation
│   │   └── workoutPlan.test.js          # Workout plan & activity log schema tests
│   └── src/
│       ├── app.js                       # Express configuration & middleware
│       ├── config/db.js                 # MongoDB connection
│       ├── models/                      # Mongoose schemas (User, Food, Activity, Water, Blog, Chat, WorkoutPlan)
│       ├── controllers/                 # Business logic controllers (incl. workoutPlan, aiAssistant)
│       ├── routes/                      # API endpoint definitions (incl. workoutPlan, aiAssistant)
│       ├── prompts/                     # Versioned AI system prompts (fitbot.prompt.js)
│       ├── middleware/                  # JWT auth, rateLimiter, requestId, httpLogger, errorHandler
│       ├── utils/                       # Structured JSON logger, secret scrubber, Redis client
│       └── services/                    # OpenRouter AI with fallback, shared fitness/planner/weather context, Brevo email services
│
├── IMPLEMENTATION_GUIDE.md              # Technical architecture & deployment guide
└── LICENSE                              # MIT License
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js:** `>= 20.0.0`
- **npm:** `>= 8.0.0`
- **MongoDB:** Local MongoDB instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Clone the Repository
```bash
git clone https://github.com/Jashan-randhawa/AI-FitnessTracker1.git
cd AI-FitnessTracker1
```

### 2. Configure & Run Backend Server
```bash
cd server
npm install

# Setup environment configuration
cp .env.example .env
```

Edit `server/.env` with your credentials:
```env
HOST=0.0.0.0
PORT=1337
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/fittrack

# Security
JWT_SECRET=your_super_secret_random_jwt_key
JWT_EXPIRES_IN=30d

# AI & APIs
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_FALLBACK_MODEL=google/gemini-2.0-flash-001
GEMINI_API_KEY=your_gemini_api_key
NEWS_API_KEY=your_newsapi_key
RAPIDAPI_KEY=your_rapidapi_key

# OAuth & Mail (Brevo HTTPS REST API)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:1337/api/connect/google/callback
BREVO_API_KEY=your_brevo_api_key
BREVO_WEBHOOK_KEY=your_brevo_webhook_secret_key
EMAIL_FROM="FitTrack AI <no-reply@fittrack.app>"

# Optional Distributed Rate Limiting (Automatic in-memory fallback if omitted)
REDIS_URL=redis://default:password@your-redis-host:6379

# Observability
METRICS_TOKEN=your_secret_metrics_token

CLIENT_URL=http://localhost:5173
```

Start the server:
```bash
npm run dev
```
> Server will boot on `http://localhost:1337` and auto-seed initial blog data if empty.

### 3. Configure & Run Frontend Client
Open a new terminal window:
```bash
cd client
npm install
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:1337
```
*(Note: Legacy `VITE_STRAPI_API_URL` is also supported for backward compatibility).*

Launch the development server:
```bash
npm run dev
```
> Visit `http://localhost:5173` in your browser.

---

## 📡 API Reference

All requests requiring authorization must include the header:  
`Authorization: Bearer <JWT_TOKEN>`

### Authentication & User Management
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/auth/local/register` | Register new user account with email verification | 5 req / 15m | Public |
| `POST` | `/api/auth/local` | Authenticate with email & password | 5 req / 15m | Public |
| `POST` | `/api/auth/google/callback` | Exchange Google OAuth access token for JWT session | — | Public |
| `POST` | `/api/auth/verify-email` | Confirm account email verification token | 10 req / 15m | Public |
| `POST` | `/api/auth/resend-verification` | Request fresh email verification link | 3 req / 15m | Public |
| `GET` | `/api/users/me` | Fetch authenticated profile details | — | Private |
| `PUT` | `/api/users/:id` | Update profile biometrics, username, and custom macro/water goals (`dailyproteingoal`, `dailycarbsgoal`, `dailyfatgoal`, `dailywatergoal`) | — | Private |
| `POST` | `/api/users/me/password` | Set password (OAuth) or update password (step-up required) | 5 req / 15m | Private |
| `GET` | `/api/connect/google` | Initiate Google OAuth sign-in | — | Public |
| `POST` | `/api/password-reset/request` | Request password reset email (Brevo HTTPS, 60s debounce) | 3 req / 1h | Public |
| `GET` | `/api/password-reset/validate` | Validate password reset token without consuming | 10 req / 15m | Public |
| `POST` | `/api/password-reset/reset` | Reset password using valid token (5-history protection) | 3 req / 1h | Public |
| `POST` | `/api/webhooks/email` | Brevo email delivery & bounce webhook receiver | 120 req / 1m | Webhook Key |
| `GET` | `/metrics` | Prometheus-style application metrics endpoint | — | Token Auth |

### Nutrition & Food Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/foodlogs` | List all food entries for current user | — | Private |
| `POST` | `/api/foodlogs` | Create new food entry | — | Private |
| `DELETE` | `/api/foodlogs/:id` | Delete meal record | — | Private |

### Exercise & Activity Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/activitylogs` | List all workout logs | — | Private |
| `POST` | `/api/activitylogs` | Log activity with optional structured exercises, sets, type, intensity & source | — | Private |
| `DELETE` | `/api/activitylogs/:id` | Delete activity record | — | Private |

### Workout Plans
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/workout-plans` | List all saved workout plans for current user | — | Private |
| `GET` | `/api/workout-plans/active` | Fetch the currently active workout plan | — | Private |
| `POST` | `/api/workout-plans` | Save a new workout plan (auto-deactivates previous active plan) | — | Private |
| `PUT` | `/api/workout-plans/:id/activate` | Set a specific plan as the active plan | — | Private |
| `DELETE` | `/api/workout-plans/:id` | Delete a workout plan | — | Private |

### Water Intake
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/waterlogs` | Fetch user water intake records | — | Private |
| `POST` | `/api/waterlogs` | Log water consumption (amount in ml) | — | Private |
| `DELETE` | `/api/waterlogs/:id` | Delete water entry | — | Private |

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

### Generative AI & Media
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/ai-assistant/chat` | Send message to FitBot Coach or run a planner (server-built context from `X-Timezone`; optional validated `environment`; model fallback & retry) | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/image-analysis` | Analyze meal photo for nutrition | 30 req / 1m | Private |
| `POST` | `/api/food-estimate` | Natural language text nutrition estimator | 30 req / 1m | Private |
| `POST` | `/api/calorie-estimate` | Estimate calories burned from exercise | 30 req / 1m | Private |
| `GET` | `/api/youtube/search` | Search workout videos via RapidAPI proxy (24h TTL cache) | 30 req / 1m | Private |

---

## 🚢 Deployment

### Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Set root directory to `client`.
3. Add Environment Variable:
   - `VITE_API_URL` = `https://your-backend-api-url.com`
4. The repo includes `client/vercel.json` for SPA URL rewrites:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```

### Backend (Render / Railway / Fly.io / VPS)
1. Deploy `server/` to any Node.js host.
2. Ensure Node.js version is `>=20.0.0`.
3. Set all required environment variables in the host dashboard.
4. Set start command: `npm start`.

---

## 📖 Documentation, Changelog & Engineering Reports

### 📑 Repository Documentation & RFCs
- 📋 **[Changelog (`CHANGELOG.md`)](CHANGELOG.md)**: Detailed release history and version change details from `v1.0.0` through `v2.4.0`.
- 📑 **[Engineering Reports & Architecture RFCs (`docs/ENGINEERING_REPORTS.md`)](docs/ENGINEERING_REPORTS.md)**: Comprehensive compilation of the engineering audits and architecture RFCs.
- 🛠️ **[Architecture & Developer Guide (`IMPLEMENTATION_GUIDE.md`)](IMPLEMENTATION_GUIDE.md)**: Technical overview of endpoints and folder architecture.

### 🌐 Official GitHub Wiki
Explore complete architectural specifications, API schemas, and interactive guides in our **[Official GitHub Wiki](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki)**:
- 🚀 **[Getting Started Guide](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Getting-Started)**: Local installation, environment variables, and unit testing.
- 🏗️ **[Architecture & Tech Stack](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Architecture-and-Tech-Stack)**: Full-stack topology, rate limiting, and CI/CD pipelines.
- 📦 **[Modular Packages Catalog](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Modular-Packages)**: The 7 decoupled npm libraries published under `@jashan-randhawa/*`.
- 🧠 **[AI Core & FitBot Features](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/AI-Core-and-Features)**: Vision meal logging, prompt guardrails, and voice dictation.
- 📊 **[Health Analytics & Tracking](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Health-Analytics-and-Tracking)**: Goal rings, streaks, calendar heatmaps, and data exports.
- 🏋️ **[Workout Studio & Punjabi Playlists](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Workout-Studio-and-Media)**: Video proxy streaming and BPM-tagged pump mixes.
- 🔌 **[Complete API Reference](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/API-Reference)**: All REST endpoints, schemas, and authentication headers.
- 🌐 **[Production Deployment Guide](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Deployment-Guide)**: Vercel, MongoDB Atlas, Brevo, and Render setup.

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. **Fork** the repository.
2. **Create a branch:** `git checkout -b feature/amazing-feature`.
3. **Commit your changes:** `git commit -m "feat: add amazing feature"`.
4. **Push to branch:** `git push origin feature/amazing-feature`.
5. **Open a Pull Request**.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Jashan-randhawa">Jashan Randhawa</a></sub>
</div>

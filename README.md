<div align="center">

# ⚡ FitTrack AI
### Intelligent Health, Nutrition & Fitness Operating System

[![CI](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml/badge.svg)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml)
[![GitHub Packages](https://img.shields.io/badge/GitHub_Packages-7_Published-2ea44f?style=for-the-badge&logo=github)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm)
[![Wiki](https://img.shields.io/badge/Documentation-Wiki-blue?style=for-the-badge&logo=github)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=20.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Unit_Tests-35_Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](#-testing--cicd)
[![Audit](https://img.shields.io/badge/Vulnerabilities-0-brightgreen?style=for-the-badge&logo=dependabot&logoColor=white)](#-security--authentication-hardening)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://ai-fitness-tracker1.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<p align="center">
  A full-stack, AI-powered health and fitness companion designed to transform daily habits into measurable progress. Featuring multimodal AI meal logging, real-time context-aware coaching, interactive activity heatmaps, adaptive workout and meal planners, and a mobile-optimized interface.
</p>

[🚀 **Explore Live Demo**](https://ai-fitness-tracker1.vercel.app) • [📦 **Modular Packages**](#-modular-packages-ecosystem) • [📖 **Wiki Documentation**](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki) • [✨ **Features**](#-features) • [📱 **Mobile View**](#-mobile-experience) • [🧪 **Testing & CI**](#-testing--cicd) • [🛠️ **Quick Start**](#-quick-start) • [📡 **API Reference**](#-api-reference)

---

</div>

## 🌟 Overview

**FitTrack AI** combines modern fitness tracking with generative artificial intelligence to deliver an experience that goes beyond standard calorie counting:

- **Intelligent Vision & NLP Logging:** Snap a photo or type a meal description; AI identifies foods and computes calories and macros automatically.
- **Context-Aware AI Coaching:** FitBot tracks your personal goals, daily calories consumed/burned, and past conversation context to provide personalized guidance.
- **Interactive Calendar Heatmaps:** GitHub-style 90-day activity and nutrition heatmaps with intensity scaling, streak tracking, and instant date navigation.
- **Tailored Multi-Day Planners:** Custom meal schedules and multi-split activity routines created to match your schedule and fitness targets.
- **Hardened Security & Rate Limiting:** Protected with `express-rate-limit`, strict AI payload caps, secure fragment-based Google OAuth, and anti-enumeration password resets.
- **Mobile-First Experience:** Built with responsive bottom-dock navigation, edge-to-edge notch handling, and adaptive data cards for desktop and mobile screens.
- **Comprehensive Wellness Hub:** Includes YouTube workout streaming, Bhangra & gym pump playlists, real-time weather & Air Quality Index (AQI), and live fitness news.

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
- **In-Memory Query Cache:** 5-minute short-TTL caching on identical prompt hashes, saving API credits and accelerating repeat advice queries.
- **AI Food Snap (Vision Analysis):** Upload or capture a meal photo directly from your camera for instant dish recognition and nutritional estimation.
- **Smart Natural Language Nutrition Estimator:** Type `"Grilled salmon with brown rice and broccoli"` and receive automated calorie and macronutrient breakdowns (Protein, Carbs, Fat).
- **AI Workout & Meal Planners:** Generates 3, 5, or 7-day workout and diet routines customized by equipment, focus, and daily calorie burn target.
- **Graceful Degradation:** Production outage handling delivering clear, user-friendly status responses (`503 Service Unavailable`) instead of raw stack traces.
- **Prompt Injection & Token Guardrails:** Server-side message history bounds (50 messages max), per-message length limits (8,000 chars), and graceful sliding-window conversation truncation.

### 📊 2. Health Analytics & Daily Tracking
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
- **Interactive Water Intake Tracker:** Visual hydration progress with quick-add presets (`+150ml`, `+250ml`, `+350ml`, `+500ml`) and custom volume input.
- **Filterable Date Selector:** Historic log inspection with date-by-date nutritional breakdown.
- **Data Exports (PDF, CSV & PNG):**
  - **Formatted PDF Report:** Multi-page PDF report with stats summary, profile metrics, food logs, and activity records powered by jsPDF and AutoTable.
  - **Raw CSV Spreadsheets:** Downloadable comma-separated records of food and activity history with timestamps, categories, and nutritional values.
  - **PNG Progress Card:** Shareable visual progress cards generated client-side with html2canvas for streak milestones and stats.

### 🏋️ 3. Workout Studio & Music Player
- **Curated Workout Categories:** Strength, Cardio, HIIT, Yoga, and Mobility.
- **In-App Video Streaming:** Embedded modal video player powered by YouTube search (authenticated & rate-limited via backend proxy).
- **High-Energy Punjabi Gym Playlists:** Curated pump-up mixes (Diljit Dosanjh, AP Dhillon, Sidhu Moosewala, Karan Aujla, Shubh) tagged by BPM and mood (Hype, Pump, Warm-Up, Cool-Down).

### 🌤️ 4. Outdoor Weather & Health News
- **Live Weather & AQI:** Real-time temperature, wind, humidity, and Air Quality Index powered by Open-Meteo to plan safe outdoor training sessions.
- **Health & Wellness News Feed:** Live headlines curated from leading health publications via NewsAPI.
- **Curated Fitness Blog:** Informative fitness articles with search and category tags.

### 🔐 5. Security & Authentication Hardening
- **Zero-Vulnerability Security Baseline:** Continuous dependency audits with `npm audit` ensuring 0 known vulnerabilities across client and server packages. Critical advisories (e.g. transitive `dompurify` XSS) resolved by upgrading `jspdf` to `^4.2.1`.
- **Secure JWT Auth:** Stateless token-based authentication with encrypted password hashing via bcryptjs.
- **IP Rate Limiting:** Enforced via `express-rate-limit` on auth (`5 req/15m`), password reset (`3 req/hour`), AI endpoints (`20 req/min`), and YouTube search (`30 req/min`).
- **Secure Google OAuth 2.0:** Tokens transferred via URL fragment (`#access_token=`) and exchanged over POST body to prevent token leakage in browser history and HTTP Referer headers.
- **Anti-Enumeration Password Recovery:** Uniform responses across all scenarios — including non-existent accounts, third-party OAuth providers, and upstream email delivery errors — ensuring no observable timing or oracle leaks exist.
- **Production Error Masking:** All database errors (`MongoServerError`, Mongoose internals) and unhandled 5xx exceptions are strictly masked with generic client messages in production (`NODE_ENV === 'production'`), shielding database topologies and credentials from client disclosure.

---

## 📱 Mobile Experience

FitTrack AI features a dedicated mobile architecture designed for modern smartphones:

| Feature | Description |
|---|---|
| **Bottom Navigation Dock** | Quick-access tab bar (Home, Food, Activity, Workouts, AI Coach) fixed to the bottom with active micro-animations. |
| **Safe-Area Insets** | `viewport-fit=cover` and `.safe-area-pb` support to prevent clipping on iPhone dynamic islands and home indicators. |
| **Adaptive Goal Rings** | 3-column responsive goal rings that fit cleanly on compact mobile viewports without broken line wraps. |
| **Unified Mobile Drawer** | Slide-over drawer with user profile summary, one-tap theme toggle, and mobile logout functionality. |
| **Full-Height Chat Viewport** | Dynamic `100dvh` layout prevents mobile keyboards or bottom bars from hiding message history or the input bar. |

---

## 🛠️ Tech Stack

```mermaid
graph TD
    Client["Client (React 19 + TypeScript + Tailwind v4 + Vite)"]
    Server["Server (Node.js >=20 + Express 4.19)"]
    DB[("Database (MongoDB Atlas)")]
    OpenRouter["OpenRouter AI (LLM / Vision)"]
    OpenMeteo["Open-Meteo (Weather & AQI)"]
    Brevo["Brevo API (Transactional Email)"]
    YouTube["RapidAPI (YouTube Video Search)"]

    Client -->|REST API / JWT| Server
    Client -->|Direct Weather API| OpenMeteo
    Server -->|Mongoose ODM| DB
    Server -->|Vision / Chat / Nutrition| OpenRouter
    Server -->|Password Reset Emails| Brevo
    Server -->|Workout Video Query| YouTube
```

### Frontend Architecture
- **Framework:** React 19.2 with TypeScript ~5.9
- **Build Engine:** Vite 7.x
- **Design System:** Tailwind CSS v4
- **Routing:** React Router v7 (`react-router-dom` 7.18+)
- **Motion & Micro-interactions:** Framer Motion 12.x
- **Data Charts:** Recharts 3.x
- **Document & Data Export:** jsPDF 4.2.x (patched DOMPurify), jsPDF-AutoTable 5.x, html2canvas
- **Icons:** Lucide React
- **Notifications:** React Hot Toast

### Backend Architecture
- **Runtime:** Node.js `>=20.0.0`
- **Framework:** Express.js 4.19
- **Database & ODM:** MongoDB & Mongoose 8.x
- **Security & Reliability:** Helmet, CORS, `express-rate-limit` (dual IP and per-user limiters), bcryptjs, JSON Web Tokens (JWT)
- **Media Ingestion:** Multer 2.4.x (multipart form handling for vision analysis)
- **Logging & Tracing:** Structured JSON Logger (`LOG_LEVEL`), automated secret scrubber (passwords, tokens, API keys), request ID correlation middleware (`X-Request-Id`), and HTTP access logging
- **Health & Monitoring:** Production uptime monitoring endpoint (`GET /api/health`) with live MongoDB connection state inspection
- **External Providers:** OpenRouter (GPT-4o-mini & Gemini fallback), Brevo HTTP API, NewsAPI, RapidAPI

---

## 🧪 Testing & CI/CD

### Automated Test Suite
The backend contains an automated unit test suite built with Node.js's native test runner (`node --test`), requiring zero external test framework dependencies:

```bash
# Run server test suite
cd server
npm test
```

Test coverage includes **35 unit tests** across **13 suites**:
- **Auth & JWT (`test/auth.test.js`):** Token generation, signature validation, payload integrity, username/email/password registration validators, and login validation.
- **AI Assistant Guardrails & Truncation (`test/aiAssistant.test.js`):** Message array boundary checks, maximum character length limits, graceful sliding-window history truncation, and friendly outage responses (`503`).
- **OpenRouter Resilience & Prompts (`test/openrouter.test.js`):** Transient error detection (429/5xx/timeouts), primary/fallback model defaults, JSON code fence extraction, and versioned FitBot prompt generation.
- **Structured Logger & Secret Scrubber (`test/logger.test.js`):** Automated redaction of passwords, tokens, API keys, Bearer tokens, and JWTs while preserving token usage metrics.
- **Health Endpoint & Request ID (`test/health.test.js`):** `GET /api/health` status, database connection state, uptime tracking, and UUID `X-Request-Id` assignment and preservation.
- **Error Handling & Production Masking (`test/errorHandler.test.js`):** Multer errors, Mongoose validation/cast/duplicate key errors, and production internal database error masking.
- **Nutrition & Calorie Estimation (`test/estimates.test.js`):** Input validation for duration, activity name, food items, and numeric boundaries.
- **Password Reset (`test/passwordReset.test.js`):** Email format verification and non-string/missing payload handling.

### Continuous Integration (GitHub Actions)
The repository includes a GitHub Actions CI workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) running on Node.js 20:
- **Client Job:** Dependency installation (`npm ci`), ESLint validation (`npm run lint`), TypeScript typecheck, and Vite production build (`npm run build`).
- **Server Job:** Dependency installation, JavaScript syntax validation (`node -c`), module loading check, and test execution (`npm test`).

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
│   │   │   ├── Dashboard.tsx            # Analytics, rings, streak, water
│   │   │   ├── FoodLog.tsx              # Nutrition logging, AI food snap & heatmap
│   │   │   ├── ActivityLog.tsx          # Exercise tracker & activity heatmap
│   │   │   ├── AIAssistant.tsx          # FitBot AI chat interface
│   │   │   ├── Workouts.tsx             # Video library & Punjabi playlists
│   │   │   ├── MealPlanner.tsx          # Multi-day meal generator
│   │   │   ├── ActivityPlanner.tsx      # Multi-day workout generator
│   │   │   ├── Weather.tsx              # Live forecast & AQI
│   │   │   ├── Blog.tsx / BlogPost.tsx  # Fitness articles & news feed
│   │   │   ├── Profile.tsx              # User metrics, PDF & CSV export
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
│   │   │   └── ui/                      # Shared reusable UI primitives
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
│   ├── test/                            # Unit tests (node --test - 35 tests)
│   │   ├── aiAssistant.test.js          # AI payload caps & truncation tests
│   │   ├── auth.test.js                 # Auth & JWT unit tests
│   │   ├── errorHandler.test.js         # Error handling & production masking tests
│   │   ├── estimates.test.js            # Calorie & food estimate tests
│   │   ├── health.test.js               # Health check & request-ID tests
│   │   ├── logger.test.js               # Logger & secret scrubber tests
│   │   ├── openrouter.test.js           # OpenRouter resilience & prompt tests
│   │   └── passwordReset.test.js        # Password reset validation tests
│   └── src/
│       ├── app.js                       # Express configuration & middleware
│       ├── config/db.js                 # MongoDB connection
│       ├── models/                      # Mongoose schemas (User, Food, Activity, Water, Blog, Chat)
│       ├── controllers/                 # Business logic controllers
│       ├── routes/                      # API endpoint definitions
│       ├── prompts/                     # Versioned AI system prompts (fitbot.prompt.js)
│       ├── middleware/                  # JWT auth, rateLimiter, requestId, httpLogger, errorHandler
│       ├── utils/                       # Structured JSON logger & secret scrubber
│       └── services/                    # OpenRouter AI with fallback, Brevo email services
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
NEWS_API_KEY=your_newsapi_key
RAPIDAPI_KEY=your_rapidapi_key

# OAuth & Mail
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:1337/api/connect/google/callback
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM="FitTrack AI <no-reply@fittrack.app>"

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

### Authentication & User
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/auth/local/register` | Register new user account | 5 req / 15m | Public |
| `POST` | `/api/auth/local` | Authenticate with email & password | 5 req / 15m | Public |
| `GET` | `/api/users/me` | Fetch authenticated profile details | — | Private |
| `PUT` | `/api/users/:id` | Update profile goals, height, weight | — | Private |
| `GET` | `/api/connect/google` | Initiate Google OAuth sign-in | — | Public |
| `POST` | `/api/password-reset/request` | Request password reset email | 3 req / 1h | Public |
| `POST` | `/api/password-reset/reset` | Reset password using valid token | 3 req / 1h | Public |

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
| `POST` | `/api/activitylogs` | Log new activity (duration, calories) | — | Private |
| `DELETE` | `/api/activitylogs/:id` | Delete activity record | — | Private |

### Water Intake
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/waterlogs` | Fetch user water intake records | — | Private |
| `POST` | `/api/waterlogs` | Log water consumption (amount in ml) | — | Private |
| `DELETE` | `/api/waterlogs/:id` | Delete water entry | — | Private |

### System & Health Monitoring
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/health` | Uptime health check (MongoDB status, process uptime, timestamp) | — | Public |

### Generative AI & Media
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/ai-assistant/chat` | Send message to FitBot Coach (with model fallback & retry) | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/image-analysis` | Analyze meal photo for nutrition | 30 req / 1m | Private |
| `POST` | `/api/food-estimate` | Natural language text nutrition estimator | 30 req / 1m | Private |
| `POST` | `/api/calorie-estimate` | Estimate calories burned from exercise | 30 req / 1m | Private |
| `GET` | `/api/youtube/search` | Search workout videos via RapidAPI proxy | 30 req / 1m | Private |

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
- 📋 **[Changelog (`CHANGELOG.md`)](CHANGELOG.md)**: Detailed release history and version change details from `v1.0.0` through `v2.1.0`.
- 📑 **[Engineering Reports & Architecture RFCs (`docs/ENGINEERING_REPORTS.md`)](docs/ENGINEERING_REPORTS.md)**: Comprehensive compilation of the 4 engineering audits:
  1. *CI Failure Root Cause Analysis & Verified Fix*
  2. *Maintenance Plan Verification & Follow-Up Security Audit*
  3. *FitBot AI Assistant Code Review, Logging & Maintenance Plan*
  4. *Package Release Assessment & Modular Monorepo Execution Plan*
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

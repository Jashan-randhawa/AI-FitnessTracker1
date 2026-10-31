# ✨ Features & Capabilities

[← Back to Documentation Index](README.md)

## ✨ Features

### 🧠 1. Artificial Intelligence Core
- **FitBot Personal Coach (`/api/ai-assistant/chat` & `/api/ai/chat`):** Chat with a context-aware fitness assistant powered by OpenRouter LLMs. FitBot references your profile (weight, target calories, training goal) and remembers past sessions.
  - **Server-Built Fitness Context:** One shared, user-scoped context service (`server/src/services/fitnessContext.service.js`) reuses the dashboard's own summary and goal calculations, so AI answers match the numbers you see on screen. Missing data is reported as unavailable rather than zero, the local day comes from the validated `X-Timezone` header (with a safe fallback), and the prompt text is length-bounded. Context sent by the client is not trusted or forwarded.
  - **Weather & Local-Time Context (optional):** The Weather page's AI suggestions can send a compact observation (temperature, condition, precipitation chance, AQI, timestamp) that the server validates against fixed ranges. Raw coordinates and place names are never part of the contract, observations older than 3 hours are treated as stale, and missing data is never treated as safe weather. AQI uses the US EPA scale by default (`AQI_STANDARD`).
  - **Cache & Privacy:** Response cache keys include the full prompt, prompt version, and a per-user scope, so one user's personalised answer cannot be served to another.
  - **Zod Schema Validation & Plan Contracts:** Automated structural parsing and validation for meal and workout plans ensuring non-negative values, realistic workout durations ($\le 720$ min), and validated schema structures.
  - **Clinical Safety Boundaries & Non-Diagnosis Guarantees:** Built-in clinical safe harbor refusing harmful diet advice, extreme caloric deficits ($< 1000$ kcal), or medical treatment prescriptions while requiring affirmative confirmation for rigorous training splits.
  - **Transparent AI Context & Memory Management:** User-directed conversation memory scoping, per-user isolation, and zero-leak context privacy controls (`/api/chathistories`).
  - **LRU Query Caching & Concurrency Controls:** Bounded 5-minute query caching with LRU eviction and per-user concurrent request limits (`MAX_USER_CONCURRENT_AI_REQUESTS`).
  - **Idempotent Message Persistence & Cancellation:** Client-side generation cancellation with `AbortController`, request deduplication, and retry queues.
  - **Hands-Free Voice Experience:** Integrated Speech-to-Text (STT) for hands-free workout/diet queries, plus Text-to-Speech (TTS) read-aloud playback via the Web Speech API.
  - **Dynamic Input & Stop Controls:** Auto-resizing textarea (up to 140px) with single-tap instant generation abortion via `AbortController`.
  - **Rich Markdown Tables & Collapsible Cards:** Native rendering of markdown tables for multi-day workout splits and macro breakdowns, along with interactive collapsible plan cards.
  - **Resilience & Inline Error Retry:** Automatic fallback, retry on 429/5xx, and inline chat retry button for immediate one-click prompt re-dispatch.
  - **One-Click Export & Clipboard:** Download full workout and nutrition plans as formatted Markdown files or copy specific messages with checkmark confirmation.
  - **Audio Completion Cue:** Gentle dual-tone Web Audio API completion chime with quick mute/unmute header toggle.
  - **Ultra-Smooth 60fps UX:** Memoized message items and animated word reveal restricted strictly to the newest response, eliminating re-render stagger on past chat history.
- **Multimodal Gemini Voice Gym Logger (`/api/workouts/parse-voice-set`):** Speak workout sets or upload audio recordings; parses exercise names, imperial-to-metric weight conversion, reps, and RPE ratings into structured activity logs with deterministic fallback.
- **Resilient AI Architecture & Transient Retries:** Integrated exponential backoff retry mechanism (1–2 retries) on network timeouts, provider hiccups, and 429/5xx status codes.
- **Automated Model Fallback (`OPENROUTER_FALLBACK_MODEL`):** Automatic failover to secondary fallback models (e.g., Gemini 2.0 Flash) if the primary model (`openai/gpt-4o-mini`) is temporarily unavailable.
- **Dual-Tier Rate Limiting:** 30 req/min per IP (`aiLimiter`) plus 20 req/min per authenticated user (`aiUserLimiter`) keyed on `req.user.id` to prevent NAT starvation and credit exhaustion.
- **Structured JSON Validation & Repair Retry:** Automated parse verification and repair retry on Activity Planner and Meal Planner calls, ensuring valid multi-day workout JSON plans.
- **AI Food Snap (Vision Analysis):** Upload or capture a meal photo directly from your camera for instant dish recognition and nutritional estimation with confidence scores and single-RTT auto-save flow. Includes client-side pre-compression to ~1024px / JPEG q82 (reducing upload size by ~90% while preserving recognition fidelity), white-flattened transparency, EXIF auto-rotation, and strict server-side magic-byte validation (enforcing 4MB limits and HTTP 400/413/415 contracts).
- **Smart Natural Language Nutrition Estimator (`/api/food-estimate`):** Type `"Grilled salmon with brown rice and broccoli"` and receive automated calorie and macronutrient breakdowns (Protein, Carbs, Fat).
- **Graceful Degradation:** Production outage handling delivering clear, user-friendly status responses (`503 Service Unavailable`) instead of raw stack traces.
- **Prompt Injection & Token Guardrails:** Server-side message history bounds (50 messages max), per-message length limits (8,000 chars), XML encapsulation of untrusted user input, and graceful sliding-window conversation truncation.

### 📊 2. Health Analytics & Performance Engine
- **Single-Pass Daily Totals Engine (`dailyTotals.ts`):** High-performance $O(N)$ aggregation over food, activity, and water logs for blazing-fast streak calculations, daily totals, and weekly charts.
- **Live Midnight Rollover (`useToday` Hook):** Seamless date rollover at local midnight (`setTimeout`) and on tab visibility restoration (`visibilitychange`) without requiring a browser reload.
- **Real-Time Server-Sent Events (SSE) Synchronization (`/api/events`):** Ticket-authorized SSE stream providing instantaneous reactive updates (such as `kind: 'weight'`, hydration, and food logs) across active tabs without manual refreshes.
- **Timezone-Safe Weight Tracker (`/api/weightlogs`):** Historical weight tracking with ISO date normalization, timezone-safe `localDay` derivation (`YYYY-MM-DD`), compound unique indexes with `partialFilterExpression` safeguarding legacy data, and migration scripts with automated backup.
- **Daily & Range Summary Aggregations (`/api/summary/day`, `/api/summary/range`):** High-performance server-side daily and date-range totals, calculating net calories, macro balances, and goal progress in a single pass.
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
  - **Formatted PDF Report:** Multi-page PDF report with stats summary, profile metrics, food logs, and activity records powered by jsPDF (patched DOMPurify) and AutoTable.
  - **Raw CSV Spreadsheets:** Downloadable comma-separated records of food and activity history with timestamps, categories, and nutritional values.
  - **PNG Progress Card:** Shareable visual progress cards generated client-side with html2canvas for streak milestones and stats.

### 🥗 3. Redesigned Meal & Activity Planners
- **Glassmorphism UI Overhaul:** Modern glass cards, glowing accents, and dark mode responsiveness matching app-wide design aesthetics.
- **Single-Day & Multi-Day Modes:** Support planning for 1 day ("Today / Single Day") in addition to multi-day schedules (3, 5, 7 days) in both Meal Planner and Activity Planner.
- **Smart Presets & Goal Filters:** Quick presets for Weight Loss, Muscle Gain, Maintenance, Keto, High Protein, Endurance, HIIT, Strength, and Home Workouts.
- **One-Click "Log to Tracker":** Seamlessly log meals directly to Food Log (`/api/foodlogs`) and workouts directly to Activity Log (`/api/activitylogs`) with validated payload normalization (`mealType`, `time`, `calories`, `protein`, `carbs`, `fat`, structured exercises, and sets).
- **Nutrition Summary & Macro Distribution:** Visual breakdown of daily calories, protein, carbs, and fat per day with progress against targets.
- **Adaptive Planning:** The server adds today's remaining calories and macros, the names of food already logged, your active workout plan, and your recent activity to every planner request. Day 1 of a meal plan fits what is left today, or is planned as tomorrow if today's budget is used up. If this context cannot be loaded, the request is refused with `503` instead of planning without your data. Planned meals and workouts are never logged automatically; logging stays an explicit button press.

### 🏋️ 4. Workout Studio, Live Tracker & Music Player
- **Three-Tab Segmented Control:** Instantly switch between **Videos**, **Today's Plan**, and **Music** with compact mobile hero and animated tab transitions.
- **Sticky Filter Bar & Content Grid Alignment:** Horizontally scrollable category filter chips with sticky positioning and seamless alignment with the content grid on both mobile and desktop viewports.
- **Today's Plan (Persistent Workout Plans):**
  - Auto-loads your active workout plan from the server on mount. Switch between multiple saved plans, mark one as active, or delete unused ones.
  - Activity Planner auto-saves AI-generated plans to `/api/workout-plans` for cross-session persistence — no more losing generated routines on page reload.
  - Enriched activity log payloads with `type`, `intensity`, and `source: "planner"` for granular analytics.
- **Live Workout Tracker:**
  - Full-featured in-session tracker launched from BottomSheet modals with drag-to-dismiss, body scroll lock, focus trapping, and Escape key support.
  - **Weight & Rep Stepper Controls:** $\pm2.5$ kg weight and $\pm1$ rep steppers with 44px minimum touch targets and responsive `flex-wrap` layout.
  - **Wall-Clock Accurate Rest Timer:** Uses `Date.now()` differential (not `setInterval` drift) for sub-second accuracy. Haptic `navigator.vibrate` feedback on timer completion.
  - **Draft Auto-Save & Restore:** Workout-in-progress automatically persisted to `localStorage`; resume mid-session even after accidental tab close.
  - **Finish & Log Session:** One-tap "Finish & Log Session" POSTs structured exercise/set data to `/api/activitylogs`, or "Discard" to clear the draft.
- **In-App Video Streaming:** Embedded modal video player powered by YouTube search with **24-hour TTL server-side caching** (Redis with in-memory `Map` fallback) and `X-Cache: HIT/MISS` response headers.
- **High-Energy Punjabi Gym Playlists:** Curated pump-up mixes (Diljit Dosanjh, AP Dhillon, Sidhu Moosewala, Karan Aujla, Shubh) tagged by BPM and mood (Hype, Pump, Warm-Up, Cool-Down).
- **Accessible BottomSheet Modals:** Framer Motion drag-to-dismiss with `max-h-[92dvh]`, safe-area bottom padding, focus trapping, and `prefers-reduced-motion` support.

### 🌤️ 5. Outdoor Weather & Health News
- **Live Weather & AQI:** Real-time temperature, wind, humidity, and Air Quality Index powered by Open-Meteo to plan safe outdoor training sessions.
- **Context-Aware Workout Suggestions:** AI suggestions use the current observation together with your logged data, and stay conservative when conditions are risky, stale, or incomplete.
- **Health & Wellness News Feed:** Live headlines curated from leading health publications via NewsAPI.
- **Curated Fitness Blog:** Informative fitness articles with search and category tags.


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


### 📶 5. Offline Logging & Sync Engine
- **Zero-Drop Offline Experience:** Log water intake, weigh-ins, meals, and workout sessions without an active internet connection.
- **Optimistic UI with Badges:** Instant local rendering with visible "Pending" badges and automatic rollback on 400 validation failures.
- **Durable Local Storage:** Persisted via IndexedDB (`fittrack_offline_v2`) with in-memory fallback; zero credentials or health metrics written to `localStorage`.
- **Automatic FIFO Replay:** Background queue drains chronologically when online connectivity returns, using durable `Idempotency-Key` headers.
- **Last-Writer-Wins Weigh-in Conflict Resolution:** Same-day weight replays safely update or acknowledge stale entries with `X-Conflict: stale-ignored` without overwriting newer data.
- **Accessible Sync Status Indicator:** Real-time sync badge (`synced`, `offline`, `waiting`, `syncing`, `needs_auth`, `attention`) with `aria-live="polite"` announcements and a full queue inspection bottom sheet.
- **Privacy-Preserving Logout Guard:** Confirms and purges pending entries on explicit user logout while preserving auth-expired queues across re-logins.

## 📱 Mobile Experience

FitTrack AI features a dedicated mobile architecture designed for modern smartphones:

| Feature | Description |
|---|---|
| **Bottom Navigation Dock** | Quick-access tab bar (Home, Food, Activity, Workouts, AI Coach) fixed to the bottom with active micro-animations, persisting cleanly across screens including the FitBot AI Coach. |
| **Sticky Filter Chips** | Swipable horizontal filter header with 44px tap targets and content grid alignment on mobile screens. |
| **Full-Height Chat Viewport** | Dynamic `100dvh` layout with auto-scroll lock eliminates jitter, while preserving bottom navigation and input controls above mobile soft keyboards. |
| **Safe-Area Insets** | `viewport-fit=cover` and `.safe-area-pb` support to prevent clipping on iPhone dynamic islands and home indicators. |
| **Adaptive Goal Rings** | 3-column responsive goal rings that fit cleanly on compact mobile viewports without broken line wraps. |
| **Unified Mobile Drawer** | Slide-over drawer with user profile summary, one-tap theme toggle, and mobile logout functionality. |
| **Responsive Sign-in & Verification UI** | Responsive mobile cards for authentication methods and email verification status chips with touch-friendly actions and cooldown feedback. |

---


> For full security and hardening architecture, see [Security Architecture](security.md).

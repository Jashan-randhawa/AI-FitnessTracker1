# AI Fitness Tracker — Improvements Implementation Guide

## What's included in this patch

### New Files (drop-in, no edits needed)

| File | What it does |
|------|-------------|
| `server/src/api/waterlog/` | Full Strapi API for water intake tracking (schema, controller, routes, service) |
| `server/src/api/chathistory/` | Full Strapi API for FitBot persistent memory |
| `client/src/Pages/MealPlanner.tsx` | New AI meal planner page with one-click logging |
| `client/src/components/CalendarHeatmap.tsx` | Reusable calendar heat-map component |

### Replacement Files (replace existing files entirely)

| File | Changes |
|------|---------|
| `server/src/index.ts` | Adds permissions for waterlog + chathistory APIs in bootstrap |
| `client/src/Context/AppContext.tsx` | Adds `allWaterLogs` state, fetch on login, optimistic water helpers |
| `client/src/assets/types/index.ts` | Adds `WaterEntry` type, updates `initialState` |
| `client/src/App.tsx` | Adds `/planner` route for MealPlanner |
| `client/src/components/Sidebar.tsx` | Adds Meal Planner nav item |
| `client/src/Pages/Dashboard.tsx` | Circular rings, water tracker, macro chart tabs, achievements, water quick-add |
| `client/src/Pages/AIAssistant.tsx` | FitBot memory (load past sessions, save on close, memory panel, clear memory) |
| `client/src/Pages/Profile.tsx` | Badges shelf, CSV export, shareable progress card |

### Integration instructions (manual edits needed)

See `CALENDAR_INTEGRATION.md` for adding the calendar heat-map to `FoodLog.tsx` and `ActivityLog.tsx`.

---

## Installation steps

### 1. Copy new server API folders
```
server/src/api/waterlog/      → your server/src/api/
server/src/api/chathistory/   → your server/src/api/
```

### 2. Replace server/src/index.ts
```
server/src/index.ts  → replace existing file
```

### 3. Copy new client files
```
client/src/Pages/MealPlanner.tsx         → new file
client/src/components/CalendarHeatmap.tsx → new file
```

### 4. Replace existing client files
```
client/src/Context/AppContext.tsx    → replace
client/src/assets/types/index.ts     → replace
client/src/App.tsx                   → replace
client/src/components/Sidebar.tsx    → replace
client/src/Pages/Dashboard.tsx       → replace
client/src/Pages/AIAssistant.tsx     → replace
client/src/Pages/Profile.tsx         → replace
```

### 5. Install optional dependency (for shareable card download)
```bash
cd client
npm install html2canvas
```

### 6. Apply calendar heat-map to FoodLog and ActivityLog
Follow the instructions in `CALENDAR_INTEGRATION.md`.

### 7. Restart Strapi
The new `waterlog` and `chathistory` content types will be auto-registered when Strapi restarts. The bootstrap will also register their permissions.

---

## Feature summary

### Dashboard
- **Circular progress rings** — calories in, calories out, active minutes (animated SVG rings)
- **Macro breakdown** — protein/carbs/fat totals for today with colored pills
- **Weekly chart tabs** — switch between Calories, Protein, Carbs, Fat trends
- **Water tracker** — quick-add buttons (+150/250/350/500ml), custom amount, daily progress bar, per-entry delete
- **Achievements** — 7 badges that unlock automatically based on your data (streaks, log counts)

### AI Assistant (FitBot)
- **Persistent memory** — past sessions are saved to Strapi and injected as context on next visit
- **Memory panel** — tap 🧠 Memory in the header to see what FitBot remembers
- **Clear memory** — one-tap button to delete all past sessions
- **Auto-save** — session saves when you start a new chat or leave the page
- **Smarter context** — system prompt now includes today's food and activity logs

### Profile
- **Badges shelf** — all 7 badges displayed with earned/locked state
- **Extended edit modal** — now also edits daily calorie intake/burn targets
- **CSV export** — downloads all food and activity logs as a CSV
- **Shareable progress card** — a visual summary card (streak, food entries, workouts, goal) downloadable as PNG

### Meal Planner (new page)
- **AI-generated plans** — choose 3, 5, or 7 days + cuisine preference
- **One-click log** — log individual meals or "Log all meals" for a day
- **Optimistic UI** — logged state updates instantly, syncs to server in background
- **Regenerate** — tap to generate a fresh plan without leaving the page

### Calendar Heat-map (FoodLog + ActivityLog)
- Month-view calendar showing days with logged activity
- Color intensity scales with the amount logged that day
- Tap any day to jump the log view to that date
- Navigate between months with ‹ › arrows

### Water Tracking (full backend + frontend)
- New `waterlog` Strapi content type with per-user isolation
- State managed in AppContext alongside food/activity logs
- Optimistic UI — entries appear instantly, sync in background

### FitBot Memory (full backend + frontend)
- New `chathistory` Strapi content type storing session summaries
- Last 3 sessions injected as context into every new FitBot conversation
- DELETE /api/chathistories/all endpoint for one-tap memory clearing

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
| Email plugin | `nodemailer` via `services/email.service.js` |
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

## Testing performed

MongoDB isn't installable in the environment this was built in (dropped
from Ubuntu's default apt repos years ago, and the sandbox network doesn't
allow reaching MongoDB's own download servers), so a live end-to-end DB
test wasn't possible here. What *was* verified before delivery:

- `node --check` on all 40+ files — no syntax errors
- A full require of `app.js` — every controller/route/service/model
  resolves with no missing imports or export mismatches
- A live HTTP test against the running Express app covering health checks,
  404s, CORS headers, auth-required vs. public routes for every resource,
  and validation-before-DB paths (24/24 passing)
- Direct Mongoose schema tests: required-field and format validation,
  password hashing/comparison, JWT sign/verify round-trip, and the
  `_id → id` response transform (18/18 passing)

Recommend running through the main flows once against a real database
(register/login, add a food/activity/water log, FitBot chat, Google
sign-in, password reset) before treating this as production-ready.

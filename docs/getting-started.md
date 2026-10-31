# 🚀 Getting Started & Local Setup

[← Back to Documentation Index](README.md)

## 🚀 Quick Start

### Prerequisites
- **Node.js:** `>= 20.0.0` (Node 22 recommended)
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
LOG_LEVEL=info

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/fittrack

# Security
JWT_SECRET=your_super_secret_random_jwt_key
JWT_EXPIRES_IN=30d
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_SAMESITE=lax
REFRESH_TOKEN_EXPIRES_DAYS=30
REFRESH_TOKEN_SECURE=false
REFRESH_TOKEN_COOKIE_PATH=/api/auth

# AI & APIs
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_FALLBACK_MODEL=google/gemini-2.0-flash-001
OPENROUTER_TIMEOUT_MS=15000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_VISION_MODEL=gemini-2.5-flash
NEWS_API_KEY=your_newsapi_key
RAPIDAPI_KEY=your_rapidapi_key

# OAuth & Mail (Brevo HTTPS REST API)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:1337/api/connect/google/callback
BREVO_API_KEY=your_brevo_api_key
BREVO_WEBHOOK_KEY=your_brevo_webhook_secret_key
EMAIL_FROM="FitTrack AI <no-reply@fittrack.app>"
BREVO_SANDBOX=false

# Optional Distributed Rate Limiting (Automatic in-memory fallback if omitted)
REDIS_URL=redis://default:password@your-redis-host:6379

# Observability
METRICS_TOKEN=your_secret_metrics_token

CLIENT_URL=http://localhost:5173

# Optional AI Caching, Token & Concurrency Tuning
AI_CACHE_TTL_MS=300000
AI_CACHE_MAX_ENTRIES=200
AI_MAX_OUTPUT_TOKENS=2500
MAX_CONCURRENT_AI_REQUESTS=25
MAX_USER_CONCURRENT_AI_REQUESTS=2
AQI_STANDARD=us_epa
STRICT_AI_KEYS=false
CI_DRY_RUN=false
```

Start the server:
```bash
npm run dev
```
> Server will boot on `http://localhost:1337` and auto-seed initial blog data if empty.

Verify the server with the automated smoke test:
```bash
npm run test:smoke
```

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

Launch the development server:
```bash
npm run dev
```
> Visit `http://localhost:5173` in your browser.

Run the client unit tests:
```bash
npm test
```

---


### Generating Secure Secrets
Before launching in staging or production, generate a strong random secret:
```bash
openssl rand -base64 48
```

### Port and Dev Proxy Notes
- **Backend Port:** Defaults to `1337` (`PORT=1337`).
- **Frontend Port:** Vite dev server is configured on port `5000` in `client/vite.config.ts`.
- **API Dev Proxy:** If `VITE_API_URL` is omitted in `client/.env`, Vite proxies `/api` requests to `http://localhost:8000` by default. If your server runs on `1337`, ensure `VITE_API_URL=http://localhost:1337` is set in `client/.env`, or update the proxy target in `client/vite.config.ts`.

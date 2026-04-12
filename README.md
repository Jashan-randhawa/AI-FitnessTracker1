# 🏋️ AI Fitness Tracker

A full-stack, AI-powered fitness and nutrition tracking web application. Log meals, track workouts, chat with an AI coach, monitor weather for outdoor planning, and stay informed with health news — all in one place.

> **Live Demo:**
> - Frontend: [ai-fitness-tracker1.vercel.app](https://ai-fitness-tracker1.vercel.app)
> - Backend API: [brilliant-darling-d5497e96aa.strapiapp.com](https://brilliant-darling-d5497e96aa.strapiapp.com)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup (Strapi)](#2-backend-setup-strapi)
  - [3. Frontend Setup (React)](#3-frontend-setup-react)
- [Environment Variables](#-environment-variables)
- [API Keys Required](#-api-keys-required)
- [API Endpoints](#-api-endpoints)
- [Database](#️-database)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🧠 AI-Powered
- **FitBot AI Assistant** — Chat with a Gemini 2.5 Flash-powered fitness coach for personalized advice on nutrition, exercise, and wellness. FitBot is context-aware — it uses your profile (goals, weight, activity level) for tailored responses.
- **AI Food Image Analysis** — Snap or upload a photo of your meal and let Gemini AI automatically identify the food and estimate calories. Supports JPEG, PNG, WebP, GIF, HEIC, and HEIF formats.
- **AI Calorie Estimation** — Estimate calories from food descriptions using the Gemini API when no image is available.

### 📊 Dashboard
- Daily calorie summary with progress toward your goal
- Calories burned from logged activities
- 7-day bar chart for calories consumed and burned
- BMI calculator with visual range indicator
- Macro breakdown (protein, carbs, fat)

### 🍽️ Food Log
- Log meals by type: Breakfast, Lunch, Dinner, and Snacks
- Track calories, protein, carbs, and fat per entry
- Edit and delete existing entries
- Filter logs by date

### 🏃 Activity Log
- Log workouts with name, duration (minutes), and calories burned
- Edit and delete activity entries
- Filter by date

### 🎬 Workout Video Library
- Curated library of **12 workout playlists** across 6 categories: Strength, Cardio, HIIT, Yoga, and Mobility
- Filter playlists by **category** and **difficulty level** (Beginner, Intermediate, Advanced, All Levels)
- **Search** across playlist titles, channel names, and descriptions
- **Hero banner** highlighting a featured playlist with a live animated preview
- **Live YouTube video search** — when a RapidAPI key is configured, each playlist modal loads real YouTube results via the YouTube138 API
- **In-app video player** — watch videos directly in an embedded modal without leaving the app
- Each playlist links to the full YouTube playlist for extended viewing
- Animated playlist cards with sparkle effects, shimmer banners, and smooth transitions
- Graceful fallback UI when no RapidAPI key is provided

### 📰 Blog & Health News
- Read curated fitness and wellness blog posts (managed via Strapi CMS)
- Live health news headlines powered by NewsAPI

### 🌤️ Weather
- Current weather conditions for your location
- Hourly and 7-day forecast
- Air Quality Index (AQI) to help plan outdoor workouts
- Powered by Open-Meteo (no API key required)

### 👤 Profile & Onboarding
- Onboarding flow to capture goals, weight, height, age, and activity level
- Profile page to update personal details
- BMI automatically calculated from your measurements

### 🔐 Authentication
- Email/password registration and login
- Google OAuth (one-click sign-in)
- Forgot password and secure email-based reset flow with expiring tokens

### 🎨 UI/UX
- Dark / Light theme toggle
- Smooth animations via Framer Motion
- Fully responsive layout with a collapsible sidebar
- Toast notifications for user feedback

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| TypeScript | ~5.9 | Type safety |
| Vite | 7.x | Build tool & dev server |
| Tailwind CSS | v4 | Utility-first styling |
| React Router | v7 | Client-side routing |
| Framer Motion | 12.x | Animations and transitions |
| Recharts | 3.x | Data visualization (bar charts) |
| Axios | 1.x | HTTP client |
| React Hot Toast | 2.x | Toast notifications |
| Lucide React | 0.574 | Icon library |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Strapi | 5.36 | Headless CMS & REST API |
| Node.js | >=20 | Server runtime |
| better-sqlite3 | 12.x | Local development database |
| PostgreSQL | — | Production database |
| @google/genai | 1.x | Gemini AI (chat & image analysis) |
| NewsAPI | — | Live health & fitness news |
| Open-Meteo | — | Weather & AQI (free, no key needed) |

---

## 📁 Project Structure

```
AI-FitnessTracker1/
│
├── client/                              # React + TypeScript frontend
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── Pages/
│   │   │   ├── Dashboard.tsx            # Overview: calories, BMI, weekly chart
│   │   │   ├── FoodLog.tsx              # Meal logging with AI calorie estimation
│   │   │   ├── ActivityLog.tsx          # Workout logging
│   │   │   ├── AIAssistant.tsx          # FitBot chat interface
│   │   │   ├── Workouts.tsx             # Workout video library with YouTube integration
│   │   │   ├── Blog.tsx                 # Blog listing + live news
│   │   │   ├── BlogPost.tsx             # Individual blog post view
│   │   │   ├── Weather.tsx              # Weather forecast & AQI
│   │   │   ├── Profile.tsx              # User profile management
│   │   │   ├── Onboarding.tsx           # First-time setup flow
│   │   │   ├── Login.tsx                # Login & registration
│   │   │   ├── ForgotPassword.tsx       # Request password reset
│   │   │   ├── ResetPassword.tsx        # Set new password via token
│   │   │   └── GoogleCallback.tsx       # Google OAuth redirect handler
│   │   │
│   │   ├── Context/
│   │   │   ├── AppContext.tsx           # Global state: auth, user data, food/activity logs
│   │   │   └── Themecontext.tsx         # Dark/light theme state
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx              # Collapsible navigation sidebar
│   │   │   ├── Loading.tsx              # Animated loading screen
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── ProgressBar.tsx
│   │   │       ├── Select.tsx
│   │   │       ├── Slider.tsx
│   │   │       └── Tooltip.tsx
│   │   │
│   │   ├── configs/
│   │   │   └── api.ts                   # Axios instance with base URL
│   │   │
│   │   ├── assets/
│   │   │   ├── style.css
│   │   │   └── types/
│   │   │       └── index.ts             # Shared TypeScript interfaces
│   │   │
│   │   ├── App.tsx                      # Route definitions
│   │   ├── main.tsx                     # Entry point
│   │   └── index.css                    # Global styles
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vercel.json                      # Vercel SPA routing config
│
└── server/                              # Strapi 5 backend
    ├── config/
    │   ├── server.ts                    # Host & port config
    │   ├── database.ts                  # SQLite / PostgreSQL config
    │   ├── middlewares.ts               # CORS, security, body parsing
    │   ├── plugins.ts                   # Google OAuth plugin config
    │   ├── api.ts                       # REST API settings
    │   └── admin.ts                     # Admin panel settings
    │
    ├── src/
    │   ├── api/
    │   │   ├── foodlog/                 # Food log CRUD
    │   │   │   ├── content-types/foodlog/schema.json
    │   │   │   ├── controllers/foodlog.ts
    │   │   │   ├── routes/foodlog.ts
    │   │   │   └── services/foodlog.ts
    │   │   │
    │   │   ├── activitylog/             # Activity log CRUD
    │   │   │   ├── content-types/activitylog/schema.json
    │   │   │   ├── controllers/activitylog.ts
    │   │   │   ├── routes/activitylog.ts
    │   │   │   └── services/activitylog.ts
    │   │   │
    │   │   ├── ai-assistant/            # FitBot Gemini chat
    │   │   │   ├── controllers/ai-assistant.ts
    │   │   │   ├── routes/ai-assistant.ts
    │   │   │   └── services/gemini-chat.ts
    │   │   │
    │   │   ├── image-analysis/          # Gemini food image analysis
    │   │   │   ├── controllers/image-analysis.ts
    │   │   │   ├── routes/image-analysis.ts
    │   │   │   └── services/gemini.ts
    │   │   │
    │   │   ├── calorie-estimate/        # Text-based calorie estimation
    │   │   │   ├── controllers/calorie-estimate.ts
    │   │   │   ├── routes/calorie-estimate.ts
    │   │   │   └── services/calorie-estimate.ts
    │   │   │
    │   │   ├── blog/                    # Blog content type
    │   │   │   ├── content-types/blog/schema.json
    │   │   │   ├── controllers/blog.ts
    │   │   │   ├── routes/blog.ts
    │   │   │   └── services/blog.ts
    │   │   │
    │   │   ├── news/                    # NewsAPI proxy
    │   │   │   ├── controllers/news.ts
    │   │   │   └── routes/news.ts
    │   │   │
    │   │   └── password-reset/          # Custom secure reset flow
    │   │       ├── controllers/password-reset.ts
    │   │       ├── routes/password-reset.ts
    │   │       └── services/password-reset.ts
    │   │
    │   ├── extensions/
    │   │   └── users-permissions/
    │   │       └── content-types/user/schema.json   # Extended user schema
    │   │
    │   ├── services/
    │   │   └── gemini.ts                # Shared Gemini AI singleton
    │   │
    │   └── index.ts                     # Strapi lifecycle hooks & custom bootstrap
    │
    ├── database/migrations/
    ├── public/uploads/
    ├── types/generated/                 # Auto-generated Strapi type definitions
    ├── package.json
    ├── tsconfig.json
    └── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>=20.0.0` (up to `24.x`)
- **npm** `>=6.0.0`
- **PostgreSQL** (for production) or SQLite (auto-used for local dev — no setup needed)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/AI-FitnessTracker1.git
cd AI-FitnessTracker1
```

---

### 2. Backend Setup (Strapi)

```bash
cd server
npm install
```

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
HOST=0.0.0.0
PORT=1337

# Strapi secrets — generate secure random strings (e.g. openssl rand -base64 32)
APP_KEYS="your_app_key_1,your_app_key_2"
API_TOKEN_SALT=your_api_token_salt
ADMIN_JWT_SECRET=your_admin_jwt_secret
TRANSFER_TOKEN_SALT=your_transfer_token_salt
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Google Gemini AI (used for FitBot chat, image analysis, and calorie estimation)
GOOGLE_API_KEY=your_gemini_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NewsAPI (live health headlines)
NEWS_API_KEY=your_newsapi_key

# Frontend origin — used in password reset emails
CLIENT_URL=http://localhost:5173
```

Start the development server:

```bash
npm run dev
```

Strapi runs at `http://localhost:1337`.
Open `http://localhost:1337/admin` to create your admin account on first run.

---

### 3. Frontend Setup (React)

```bash
cd client
npm install
```

Create a `.env` file in the `client/` directory:

```env
VITE_STRAPI_API_URL=http://localhost:1337/
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🔐 Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `HOST` | ✅ | Server host (use `0.0.0.0`) |
| `PORT` | ✅ | Server port (default `1337`) |
| `APP_KEYS` | ✅ | Comma-separated Strapi app keys |
| `API_TOKEN_SALT` | ✅ | Salt for API tokens |
| `ADMIN_JWT_SECRET` | ✅ | JWT secret for Strapi admin |
| `TRANSFER_TOKEN_SALT` | ✅ | Salt for transfer tokens |
| `JWT_SECRET` | ✅ | JWT secret for user auth |
| `ENCRYPTION_KEY` | ✅ | Encryption key |
| `GOOGLE_API_KEY` | ✅ | Gemini AI API key |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `NEWS_API_KEY` | ✅ | NewsAPI.org key |
| `CLIENT_URL` | ✅ | Frontend URL for email links |
| `DATABASE_URL` | ⚠️ Production | PostgreSQL connection string |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_STRAPI_API_URL` | ✅ | Base URL of the Strapi backend |
| `VITE_RAPIDAPI_KEY` | ⚠️ Optional | RapidAPI key for live YouTube video search in the Workout Library |

---

## 🔑 API Keys Required

| Key | Service | Where to Get It |
|---|---|---|
| `GOOGLE_API_KEY` | Google Gemini AI | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GOOGLE_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Same as above |
| `NEWS_API_KEY` | NewsAPI | [newsapi.org/register](https://newsapi.org/register) |
| `VITE_RAPIDAPI_KEY` | YouTube138 (optional) | [rapidapi.com](https://rapidapi.com/hub) → search "YouTube138" — enables live video search in the Workout Library |

> **Weather** is powered by [Open-Meteo](https://open-meteo.com/) — free and **no API key required**.

---

## 📡 API Endpoints

### Authentication (Strapi Built-in)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/local` | Login with email & password |
| `POST` | `/api/auth/local/register` | Register a new account |
| `GET` | `/api/connect/google` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |

### Food Log

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/foodlogs` | Get all food log entries for the user |
| `POST` | `/api/foodlogs` | Create a new food log entry |
| `PUT` | `/api/foodlogs/:id` | Update a food log entry |
| `DELETE` | `/api/foodlogs/:id` | Delete a food log entry |

### Activity Log

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/activitylogs` | Get all activity log entries for the user |
| `POST` | `/api/activitylogs` | Create a new activity log entry |
| `PUT` | `/api/activitylogs/:id` | Update an activity log entry |
| `DELETE` | `/api/activitylogs/:id` | Delete an activity log entry |

### AI Features

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai-assistant/chat` | Chat with FitBot (Gemini 2.5 Flash) |
| `POST` | `/api/image-analysis/analyze` | Analyze a food image and return calorie estimate |
| `POST` | `/api/calorie-estimate/estimate` | Estimate calories from a food description |

### Content & External Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/blogs` | List all blog posts |
| `GET` | `/api/blogs/:id` | Get a single blog post |
| `GET` | `/api/news/headlines` | Fetch live health & fitness headlines |

### Password Reset

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/password-reset/request` | Request a password reset email |
| `GET` | `/api/password-reset/validate` | Validate a reset token |
| `POST` | `/api/password-reset/reset` | Submit a new password |

---

## 🗄️ Database

- **Local development:** Strapi uses **SQLite** (`better-sqlite3`) by default — no database setup required.
- **Production:** Use **PostgreSQL**. Configure via `server/config/database.ts` using `DATABASE_URL` or individual `DATABASE_*` environment variables.

Example PostgreSQL configuration in `server/config/database.ts`:

```ts
url: env('DATABASE_URL'),
ssl: env.bool('DATABASE_SSL', false),
```

---

## 🚢 Deployment

### Frontend → Vercel

1. Build the project:
   ```bash
   cd client
   npm run build
   ```
2. Deploy the `dist/` folder to Vercel, or connect your GitHub repository for automatic deployments.
3. In Vercel's dashboard, set the environment variable:
   ```
   VITE_STRAPI_API_URL=https://your-strapi-backend.com/
   ```
4. The `client/vercel.json` is already configured to handle SPA routing:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```

### Backend → Strapi Cloud

```bash
cd server
npm run deploy
```

Or deploy to any Node.js-compatible host (Railway, Render, Fly.io, etc.) with:
- All required environment variables configured
- A PostgreSQL database connected via `DATABASE_URL`
- Node.js `>=20` runtime

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and commit with a clear message:
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push to your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch

Please make sure your code:
- Follows the existing TypeScript patterns
- Doesn't introduce breaking changes to existing API endpoints
- Includes meaningful commit messages

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- [Google Gemini](https://deepmind.google/technologies/gemini/) — AI chat and image analysis
- [Strapi](https://strapi.io/) — Headless CMS and backend framework
- [Open-Meteo](https://open-meteo.com/) — Free weather & AQI API
- [NewsAPI](https://newsapi.org/) — Live news headlines
- [Vercel](https://vercel.com/) — Frontend hosting

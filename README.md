# 🏋️ AI Fitness Tracker

A full-stack, AI-powered fitness and nutrition tracking web application. Log meals, track workouts and water intake, chat with an AI coach, monitor weather for outdoor planning, and stay informed with health news — all in one place.

> **Live Demo:**
> - Frontend: [ai-fitness-tracker1.vercel.app](https://ai-fitness-tracker1.vercel.app)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup (Express + MongoDB)](#2-backend-setup-express--mongodb)
  - [3. Frontend Setup (React)](#3-frontend-setup-react)
- [Environment Variables](#-environment-variables)
- [API Keys Required](#-api-keys-required)
- [API Endpoints](#-api-endpoints)
- [Database](#️-database)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🧠 AI-Powered
- **FitBot AI Assistant** — Chat with an AI fitness coach (served via OpenRouter) for personalized advice on nutrition, exercise, and wellness. FitBot is context-aware — it uses your profile (goals, weight, activity level) for tailored responses, and chat history is saved per user.
- **AI Food Image Analysis** — Upload a photo of your meal and let the AI identify the food and estimate calories.
- **AI Calorie & Food Estimation** — Estimate calories and macros from a text description of a meal when no image is available.
- **AI Meal Planner** — Generate a multi-day (3/5/7-day) meal plan tailored to your goal, calorie target, weight, and preferred cuisine; log any suggested meal straight to your Food Log with one click.
- **AI Activity Planner** — Generate a multi-day workout plan tailored to your training focus (Balanced, Fat Loss, Strength, Endurance, Mobility), experience level, and available equipment, complete with warm-up/cool-down notes; log any planned activity straight to your Activity Log.

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

### 💧 Water Log
- Track daily water intake
- Add and remove entries

### 🎬 Workout Video Library
- Curated library of workout playlists across categories: Strength, Cardio, HIIT, Yoga, and Mobility
- Filter playlists by **category** and **difficulty level** (Beginner, Intermediate, Advanced, All Levels)
- **Search** across playlist titles, channel names, and descriptions
- **Live YouTube video search** — when a RapidAPI key is configured, each playlist modal loads real YouTube results via the YouTube138 API
- **In-app video player** — watch videos directly in an embedded modal without leaving the app
- Graceful fallback UI when no RapidAPI key is provided

### 📰 Blog & Health News
- Read curated fitness and wellness blog posts (seeded on first server boot; publicly readable, writes require login)
- Live health news headlines powered by NewsAPI

### 🌤️ Weather
- Current weather conditions for your location
- Hourly and 7-day forecast
- Air Quality Index (AQI) to help plan outdoor workouts
- Powered by Open-Meteo, called directly from the client (no API key required)

### 👤 Profile & Onboarding
- Onboarding flow to capture goals, weight, height, age, and activity level
- Profile page to update personal details
- BMI automatically calculated from your measurements

### 🔐 Authentication
- Email/password registration and login (JWT-based)
- Google OAuth (one-click sign-in)
- Forgot password and secure email-based reset flow with expiring tokens (sent via Brevo's HTTP API)

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
| Express | 4.19 | REST API framework |
| Node.js | >=18 | Server runtime |
| MongoDB / Mongoose | 8.x | Database & ODM |
| JWT (jsonwebtoken) | 9.x | Auth tokens |
| bcryptjs | 2.x | Password hashing |
| Multer | 1.x | File uploads (food image analysis) |
| Helmet, CORS, Morgan | — | Security headers, CORS, request logging |
| OpenRouter | — | Powers FitBot chat, image analysis, and calorie/food estimation |
| Brevo (HTTP API) | — | Transactional email for password reset |
| NewsAPI | — | Live health & fitness news |
| YouTube138 (RapidAPI) | — | Workout video search |

> **Note:** This project originally shipped with a Strapi 5 + PostgreSQL backend. It has since been fully ported to a plain **Express + MongoDB (MERN)** backend — every route, request/response shape, and business rule was carried over, so the `client/` app didn't need any changes. See `server/README.md` for the full migration notes.

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
│   │   │   ├── MealPlanner.tsx          # AI-generated multi-day meal plan
│   │   │   ├── ActivityPlanner.tsx      # AI-generated multi-day workout plan
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
│   │   │   └── ui/                      # Button, Card, Input, ProgressBar, Select, Slider, Tooltip
│   │   │
│   │   ├── configs/
│   │   │   └── api.ts                   # Axios instance with base URL
│   │   │
│   │   ├── assets/
│   │   │   ├── style.css
│   │   │   └── types/index.ts           # Shared TypeScript interfaces
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
└── server/                              # Express + MongoDB backend
    ├── server.js                        # Entry point: connect DB → seed blog → listen
    └── src/
        ├── app.js                       # Express app: helmet, CORS, body parsing, routes
        ├── config/db.js                 # Mongoose connection
        ├── models/                      # Mongoose schemas
        │   ├── User.js
        │   ├── FoodLog.js
        │   ├── ActivityLog.js
        │   ├── WaterLog.js
        │   ├── Blog.js
        │   └── ChatHistory.js
        │
        ├── controllers/                 # Request handlers, one per resource
        ├── routes/                      # Route definitions, one per resource
        ├── middleware/                  # JWT auth, file upload (multer), error handling
        ├── services/                    # OpenRouter calls, email, blog seeding, password-reset logic
        └── utils/
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>=18.0.0`
- **npm** `>=6.0.0`
- **MongoDB** — a local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

---

### 1. Clone the Repository

```bash
git clone https://github.com/Jashan-randhawa/AI-FitnessTracker1.git
cd AI-FitnessTracker1
```

---

### 2. Backend Setup (Express + MongoDB)

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
NODE_ENV=development

# MongoDB — local: mongodb://127.0.0.1:27017/fittrack
# or Atlas:       mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fittrack
MONGODB_URI=mongodb://127.0.0.1:27017/fittrack

# Auth
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=30d

# OpenRouter — powers FitBot chat, image analysis, calorie/food estimation
OPENROUTER_API_KEY=your_openrouter_api_key

# Google OAuth (must point at THIS server, not the frontend)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:1337/api/connect/google/callback

# NewsAPI (live health headlines)
NEWS_API_KEY=your_newsapi_key

# RapidAPI (YouTube138 — workout video search)
RAPIDAPI_KEY=your_rapidapi_key

# Frontend origin — used for CORS and password-reset/OAuth redirect links
CLIENT_URL=http://localhost:5173

# Brevo HTTP API — transactional email for password reset
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM="AI Fitness Tracker <no-reply@fittrack.app>"
```

Start the development server:

```bash
npm run dev
```

The API runs at `http://localhost:1337`. On first boot it seeds the `blogs` collection with sample posts.

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

> The variable is still named `VITE_STRAPI_API_URL` for historical reasons — it simply points at the backend's base URL, which is now the Express API above.

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
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret used to sign auth tokens |
| `JWT_EXPIRES_IN` | ✅ | Token lifetime (e.g. `30d`) |
| `OPENROUTER_API_KEY` | ✅ | Powers FitBot chat, image analysis, calorie/food estimation |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | ✅ | Must point at this server and be registered in Google Cloud Console |
| `NEWS_API_KEY` | ✅ | NewsAPI.org key |
| `RAPIDAPI_KEY` | ⚠️ Optional | Enables live YouTube search in the Workouts page |
| `CLIENT_URL` | ✅ | Frontend URL — used for CORS and email/OAuth redirect links |
| `BREVO_API_KEY` | ✅ | Sends password-reset emails via Brevo's HTTP API |
| `EMAIL_FROM` | ✅ | From-address used on outgoing emails |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_STRAPI_API_URL` | ✅ | Base URL of the backend API |
| `VITE_RAPIDAPI_KEY` | ⚠️ Optional | RapidAPI key for live YouTube search in Workout Videos |

---

## 🔑 API Keys Required

| Key | Service | Where to Get It |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials |
| `NEWS_API_KEY` | NewsAPI | [newsapi.org/register](https://newsapi.org/register) |
| `RAPIDAPI_KEY` / `VITE_RAPIDAPI_KEY` | YouTube138 (optional) | [rapidapi.com](https://rapidapi.com/hub) → search "YouTube138" |
| `BREVO_API_KEY` | Brevo (email) | [app.brevo.com](https://app.brevo.com) → Settings → SMTP & API → API Keys |

> **Weather** is powered by [Open-Meteo](https://open-meteo.com/) — free and **no API key required**.

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/local/register` | Register a new account |
| `POST` | `/api/auth/local` | Login with email & password |
| `GET` | `/api/users/me` | Get the current authenticated user |
| `PUT` | `/api/users/:id` | Update a user (must be the caller's own record) |
| `GET` | `/api/connect/google` | Initiate Google OAuth |
| `GET` | `/api/connect/google/callback` | Google OAuth callback (server-side hop) |
| `GET` | `/api/auth/google/callback` | Google OAuth redirect handler |

### Food Log

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/foodlogs` | Get all food log entries for the user |
| `POST` | `/api/foodlogs` | Create a new food log entry |
| `GET` | `/api/foodlogs/:id` | Get a single food log entry |
| `PUT` | `/api/foodlogs/:id` | Update a food log entry |
| `DELETE` | `/api/foodlogs/:id` | Delete a food log entry |

### Activity Log

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/activitylogs` | Get all activity log entries for the user |
| `POST` | `/api/activitylogs` | Create a new activity log entry |
| `GET` | `/api/activitylogs/:id` | Get a single activity log entry |
| `PUT` | `/api/activitylogs/:id` | Update an activity log entry |
| `DELETE` | `/api/activitylogs/:id` | Delete an activity log entry |

### Water Log

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/waterlogs` | Get all water log entries for the user |
| `POST` | `/api/waterlogs` | Create a new water log entry |
| `DELETE` | `/api/waterlogs/:id` | Delete a water log entry |

### AI Features

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai-assistant/chat` | Chat with FitBot |
| `POST` | `/api/image-analysis` | Analyze a food image and return a calorie estimate |
| `POST` | `/api/calorie-estimate` | Estimate calories from a food description |
| `POST` | `/api/food-estimate` | Estimate full nutrition (calories, protein, carbs, fat) from a food description |

> The **Meal Planner** and **Activity Planner** pages don't have dedicated routes — they build a structured-JSON prompt client-side and reuse `/api/ai-assistant/chat` (the same endpoint FitBot uses), which is why `maxTokens` on that endpoint is sized for a full multi-day plan, not just a short chat reply.

### Chat History

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/chathistories` | Get the user's saved FitBot conversation |
| `POST` | `/api/chathistories` | Save a chat message |
| `DELETE` | `/api/chathistories/all` | Clear the user's chat history |

### Content & External Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/blogs` | List all blog posts (public) |
| `GET` | `/api/blogs/:id` | Get a single blog post (public) |
| `POST` | `/api/blogs` | Create a blog post (auth required) |
| `PUT` | `/api/blogs/:id` | Update a blog post (auth required) |
| `DELETE` | `/api/blogs/:id` | Delete a blog post (auth required) |
| `GET` | `/api/news/headlines` | Fetch live health & fitness headlines |
| `GET` | `/api/youtube/search` | Search YouTube for workout videos (requires `RAPIDAPI_KEY`) |

### Password Reset

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/password-reset/request` | Request a password reset email |
| `GET` | `/api/password-reset/validate` | Validate a reset token |
| `POST` | `/api/password-reset/reset` | Submit a new password |

Unless noted otherwise, all endpoints under `/api` other than registration, login, blog reads, and OAuth require a `Bearer` JWT.

---

## 🗄️ Database

- **MongoDB** via Mongoose — one model per resource (`User`, `FoodLog`, `ActivityLog`, `WaterLog`, `Blog`, `ChatHistory`).
- Use a **local instance** (`mongodb://127.0.0.1:27017/fittrack`) for development, or a free **[MongoDB Atlas](https://www.mongodb.com/atlas)** cluster for anything shared or deployed.
- Set the connection string via `MONGODB_URI` in `server/.env`.
- On first boot, the server seeds the `blogs` collection with sample posts if it's empty.

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
   VITE_STRAPI_API_URL=https://your-backend-url.com/
   ```
   The frontend must call your deployed backend URL (Render/Railway/Fly.io/etc.), not the Vercel frontend domain.
4. `client/vercel.json` is already configured to handle SPA routing:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```

### Backend → Any Node.js Host

Deploy the `server/` folder to any Node.js-compatible host (Render, Railway, Fly.io, etc.) with:
- All required environment variables configured (see [Environment Variables](#-environment-variables))
- A MongoDB connection string (local, self-hosted, or Atlas) set as `MONGODB_URI`
- Node.js `>=18` runtime
- Start command: `npm start` (or `npm run dev` for auto-restart during staging)

> Render's free tier blocks outbound SMTP ports, which is why password-reset email goes through Brevo's HTTPS API rather than SMTP — no extra setup is needed on that front beyond a `BREVO_API_KEY`.

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
- Follows the existing TypeScript / JavaScript patterns
- Doesn't introduce breaking changes to existing API endpoints
- Includes meaningful commit messages

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- [OpenRouter](https://openrouter.ai/) — AI chat, image analysis, and calorie estimation
- [MongoDB](https://www.mongodb.com/) — Database
- [Open-Meteo](https://open-meteo.com/) — Free weather & AQI API
- [NewsAPI](https://newsapi.org/) — Live news headlines
- [Brevo](https://www.brevo.com/) — Transactional email for password reset
- [Vercel](https://vercel.com/) — Frontend hosting

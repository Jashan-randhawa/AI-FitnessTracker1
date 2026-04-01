# 🏋️ AI Fitness Tracker

A full-stack AI-powered fitness and nutrition tracking web app. Log meals, track workouts, get personalized advice from an AI coach, and monitor your health — all in one place.

---

## 🚀 Live Demo

- **Frontend:** [ai-fitness-tracker1.vercel.app](https://ai-fitness-tracker1.vercel.app)
- **Backend API:** [brilliant-darling-d5497e96aa.strapiapp.com](https://brilliant-darling-d5497e96aa.strapiapp.com)

---

## ✨ Features

- **📊 Dashboard** — Overview of daily calories, activity, and progress charts
- **🍽️ Food Log** — Track meals by type (breakfast, lunch, dinner, snacks) with calorie counts
- **📸 AI Image Analysis** — Snap a photo of your food and let Gemini AI identify it and estimate calories automatically
- **🏃 Activity Log** — Log workouts with name, duration, and calories burned
- **🤖 AI Assistant (FitBot)** — Chat with a Gemini-powered fitness coach for personalized advice on nutrition, exercise, and wellness
- **📰 Health Blog & News** — Read fitness articles and live health news powered by NewsAPI
- **🌤️ Weather** — Current weather, hourly/daily forecast, and AQI data to plan outdoor workouts
- **👤 Profile & Onboarding** — Set your goals, weight, and activity level for personalized context
- **🔐 Auth** — Email/password login, Google OAuth, forgot password & secure email reset flow
- **🌙 Dark / Light Theme** — Full theme toggle across the app

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS v4 | Styling |
| React Router v7 | Client-side routing |
| Framer Motion | Animations |
| Recharts | Data visualization |
| Axios | HTTP client |
| React Hot Toast | Notifications |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Strapi 5 (Node.js) | Headless CMS & REST API |
| PostgreSQL | Production database |
| Google Gemini 2.5 Flash | AI chat & image analysis |
| NewsAPI | Live health & fitness news |
| Open-Meteo | Weather & AQI data (no key needed) |
| Strapi Users & Permissions | Auth, JWT, Google OAuth |

---

## 📁 Project Structure

```
AI-FitnessTracker1/
├── client/                         # React frontend
│   ├── src/
│   │   ├── Pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── FoodLog.tsx
│   │   │   ├── ActivityLog.tsx
│   │   │   ├── AIAssistant.tsx
│   │   │   ├── Blog.tsx
│   │   │   ├── Weather.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   └── ResetPassword.tsx
│   │   ├── Context/
│   │   │   ├── AppContext.tsx      # Global auth & user state
│   │   │   └── Themecontext.tsx   # Dark/light theme
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   └── ui/                # Reusable UI components
│   │   └── configs/
│   │       └── api.ts             # Axios instance
│   └── vite.config.ts
│
└── server/                        # Strapi backend
    ├── src/
    │   └── api/
    │       ├── foodlog/           # Food logging CRUD
    │       ├── activitylog/       # Activity logging CRUD
    │       ├── ai-assistant/      # Gemini chat endpoint
    │       ├── image-analysis/    # Gemini food image analysis
    │       ├── blog/              # Blog content type
    │       ├── news/              # NewsAPI proxy
    │       └── password-reset/    # Custom secure password reset
    └── config/
        └── plugins.ts             # Google OAuth config
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js `>=20.0.0`
- npm `>=6.0.0`
- PostgreSQL database (for production) or SQLite (for local dev)

---

### 1. Clone the repository

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

Create a `.env` file in the `server/` directory:

```env
HOST=0.0.0.0
PORT=1337

# Strapi secrets (generate random strings)
APP_KEYS="your_app_key_1,your_app_key_2"
API_TOKEN_SALT=your_api_token_salt
ADMIN_JWT_SECRET=your_admin_jwt_secret
TRANSFER_TOKEN_SALT=your_transfer_token_salt
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Google Gemini AI
GOOGLE_API_KEY=your_gemini_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NewsAPI
NEWS_API_KEY=your_newsapi_key

# Frontend URL (for password reset emails)
CLIENT_URL=http://localhost:5173
```

Start the development server:

```bash
npm run dev
```

Strapi will be running at `http://localhost:1337`. Open `http://localhost:1337/admin` to set up your admin account.

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

The app will be running at `http://localhost:5173`.

---

## 🔑 API Keys Required

| Key | Where to get it |
|---|---|
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) — OAuth 2.0 credentials |
| `NEWS_API_KEY` | [newsapi.org](https://newsapi.org/register) |

> **Weather** uses [Open-Meteo](https://open-meteo.com/) which is free and requires no API key.

---

## 🗄️ Database

- **Local development:** Strapi uses SQLite by default (no setup needed)
- **Production:** PostgreSQL — configure `DATABASE_URL` or individual `DATABASE_*` env vars in your Strapi config

---

## 🚢 Deployment

### Frontend → Vercel

```bash
cd client
npm run build
# Deploy the dist/ folder to Vercel
```

Set `VITE_STRAPI_API_URL` to your production Strapi URL in Vercel's environment variables.

### Backend → Strapi Cloud

```bash
cd server
npm run deploy
```

Or deploy to any Node.js host (Railway, Render, etc.) with the required environment variables set.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/local` | Login |
| `POST` | `/api/auth/local/register` | Register |
| `GET` | `/api/connect/google` | Google OAuth |
| `GET/POST/PUT/DELETE` | `/api/foodlogs` | Food log CRUD |
| `GET/POST/PUT/DELETE` | `/api/activitylogs` | Activity log CRUD |
| `POST` | `/api/ai-assistant/chat` | Chat with FitBot |
| `POST` | `/api/image-analysis/analyze` | Analyze food image |
| `GET` | `/api/news/headlines` | Fetch health news |
| `GET` | `/api/blogs` | List blog posts |
| `POST` | `/api/password-reset/request` | Request password reset |
| `GET` | `/api/password-reset/validate` | Validate reset token |
| `POST` | `/api/password-reset/reset` | Reset password |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

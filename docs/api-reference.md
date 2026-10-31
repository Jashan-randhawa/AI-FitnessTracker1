# 📡 REST API Reference

[← Back to Documentation Index](README.md)

> ⏱️ **Last verified against code:** 2026-10-31 (commit 8a875d2)

## 📡 API Reference

All requests requiring authorization must include the header:  
`Authorization: Bearer <JWT_TOKEN>`

### Authentication & User Management
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/auth/local/register` | Register new user account with email verification | 5 req / 15m | Public |
| `POST` | `/api/auth/local` | Authenticate with email & password | 5 req / 15m | Public |
| `POST` | `/api/auth/google/callback` | Exchange Google OAuth access token for JWT session | — | Public |
| `POST` | `/api/email-verification/confirm` | Confirm account email verification token | 10 req / 15m | Public |
| `POST` | `/api/email-verification/request` | Request fresh email verification link | 3 req / 15m | Public |
| `GET` | `/api/users/me` | Fetch authenticated profile details | — | Private |
| `PUT` | `/api/users/:id` | Update profile biometrics, username, and custom macro/water goals | — | Private |
| `POST` | `/api/users/me/password` | Set password (OAuth) or update password (step-up required) | 5 req / 15m | Private |
| `GET` | `/api/connect/google` | Initiate Google OAuth sign-in | — | Public |
| `POST` | `/api/password-reset/request` | Request password reset email (Brevo HTTPS, 60s debounce) | 3 req / 1h | Public |
| `GET` | `/api/password-reset/validate` | Validate password reset token without consuming | 10 req / 15m | Public |
| `POST` | `/api/password-reset/reset` | Reset password using valid token (5-history protection) | 3 req / 1h | Public |
| `POST` | `/api/webhooks/email` | Brevo email delivery & bounce webhook receiver | 120 req / 1m | Webhook Key |

| `POST` | `/api/auth/refresh` | Single-flight refresh token rotation (RTR) via httpOnly cookie | 30 req / 15m | Public |
| `POST` | `/api/auth/logout` | Invalidate session family and clear httpOnly refresh token cookie | — | Private |
| `GET` | `/api/connect/google/callback` | Handle Google OAuth redirection and code exchange | — | Public |

### Nutrition & Food Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/foodlogs` | List all food entries for current user | — | Private |
| `POST` | `/api/foodlogs` | Create new food entry | — | Private |
| `DELETE` | `/api/foodlogs/:id` | Delete meal record | — | Private |

| `GET` | `/api/foodlogs/:id` | Fetch a single food log entry by ID | — | Private |
| `PUT` | `/api/foodlogs/:id` | Update an existing food log entry | — | Private |

### Exercise & Activity Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/activitylogs` | List all workout logs | — | Private |
| `POST` | `/api/activitylogs` | Log activity with optional structured exercises, sets, type, intensity & source | — | Private |
| `DELETE` | `/api/activitylogs/:id` | Delete activity record | — | Private |

| `GET` | `/api/activitylogs/:id` | Fetch a single activity log entry by ID | — | Private |
| `PUT` | `/api/activitylogs/:id` | Update an existing activity log entry | — | Private |

### Weight Tracking
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/weightlogs` | Fetch user weight records sorted chronologically | — | Private |
| `POST` | `/api/weightlogs` | Log weight entry (with automatic timezone-safe `localDay` derivation) | — | Private |
| `DELETE` | `/api/weightlogs/:id` | Delete weight measurement record | — | Private |

### Daily & Range Summary Aggregations
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/summary/day` | Get single-pass aggregated daily summary for a specific date (`?date=YYYY-MM-DD`) | — | Private |
| `GET` | `/api/summary/range` | Get multi-day aggregated analytics and trend summary (`?startDate=&endDate=`) | — | Private |

### Real-Time Server-Sent Events (SSE)
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/events/ticket` | Generate short-lived authentication ticket for SSE connection | — | Private |
| `GET` | `/api/events` | Stream live server events (`?ticket=<TICKET>`) for zero-reload reactive updates | — | Ticket Auth |

### Chat History & Conversations
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/chathistories` | Retrieve all chat sessions for the authenticated user | — | Private |
| `POST` | `/api/chathistories` | Save or create a chat session | 30 req / 1m | Private |
| `GET` | `/api/chathistories/session/:sessionId` | Retrieve messages for a specific chat session | — | Private |
| `PUT` | `/api/chathistories/session/:sessionId` | Upsert message history for a specific chat session | 30 req / 1m | Private |
| `DELETE` | `/api/chathistories/session/:sessionId` | Delete a single chat session | — | Private |
| `DELETE` | `/api/chathistories/all` | Purge all chat sessions and conversation memory | — | Private |

### Workout Plans & Voice Set Logging
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/workout-plans` | List all saved workout plans for current user | — | Private |
| `GET` | `/api/workout-plans/active` | Fetch the currently active workout plan | — | Private |
| `POST` | `/api/workout-plans` | Save a new workout plan (auto-deactivates previous active plan) | — | Private |
| `PUT` | `/api/workout-plans/:id/active` | Set a specific plan as the active plan | — | Private |
| `DELETE` | `/api/workout-plans/:id` | Delete a workout plan | — | Private |
| `GET` | `/api/workouts/recommendations` | Get personalized workout recommendations | — | Private |
| `POST` | `/api/workouts/parse-voice-set` | Multimodal voice set parser (audio upload or spoken text) | — | Private |

### Water Intake
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `GET` | `/api/waterlogs` | Fetch user water intake records | — | Private |
| `POST` | `/api/waterlogs` | Log water consumption (amount in ml) | — | Private |
| `DELETE` | `/api/waterlogs/:id` | Delete water entry | — | Private |

| `PUT` | `/api/waterlogs/:id` | Update an existing water log entry | — | Private |

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
| `GET` | `/api/metrics` | Prometheus-style application metrics endpoint | — | Token Auth |

### Generative AI & Media
| Method | Endpoint | Description | Rate Limit | Access |
|---|---|---|---|---|
| `POST` | `/api/ai-assistant/chat` | Send message to FitBot Coach or run a planner (server-built context from `X-Timezone`; model fallback & retry) | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/ai/chat` | Playbook alias for `/api/ai-assistant/chat` | 30 req/m (IP) + 20 req/m (User) | Private |
| `POST` | `/api/image-analysis` | Analyze meal photo for nutrition (multimodal Food Snap) | 10 req / 1h + 30 req / 1m | Private |
| `POST` | `/api/food-estimate` | Natural language text nutrition estimator | 30 req / 1m | Private |
| `POST` | `/api/calorie-estimate` | Estimate calories burned from exercise | 30 req / 1m | Private |
| `GET` | `/api/youtube/search` | Search workout videos via RapidAPI proxy (24h TTL cache) | 30 req / 1m | Private |

---


### 🌤️ Outdoor Weather & News
| Method | Endpoint | Description | Rate Limit | Auth |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/news/headlines` | Fetch curated live health & fitness headlines with 1-hr in-memory cache | 60 req / 15m | Public |


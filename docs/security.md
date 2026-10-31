# 🔐 Security & Hardening Architecture

[← Back to Documentation Index](README.md)

### 🔐 6. Security, Authentication Hardening & CodeQL Remediation
- **Admin-Only Blog Operations & Field Whitelisting:** Creating, updating, or deleting blog posts is strictly restricted to accounts with `isAdmin: true` via `requireAdmin` middleware. Non-admin requests receive `403 Forbidden`. In addition, create and update controllers accept only an explicit whitelist of allowed fields.
- **GitHub CodeQL Remediation:** Audited and resolved GitHub code scanning alerts across the codebase, enforcing strict HTML entity escaping against DOM text XSS, cryptographically secure random token generation, complete string escaping, and scoped GitHub Actions workflow permissions (`permissions: contents: read`).
- **React Compiler Compliance:** Frontend views and hooks (including `AIAssistant.tsx`) refactored to satisfy React Compiler rules, ensuring deterministic memoization and eliminating unnecessary re-renders.
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
- **Multimodal Image Upload Security & Magic-Byte Validation (`/api/image-analysis`):**
  - **Independent Security Boundary:** Client-side checks are treated strictly as performance optimizations. The server independently verifies all uploads.
  - **Magic-Byte Sniffing:** Strictly inspects binary magic bytes on image buffers (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP), rejecting spoofed filenames (e.g. `.txt` or `.svg` renamed to `.jpg`) with `415 Unsupported Media Type`.
  - **XSS & Polyglot Prevention:** Explicitly rejects SVG XML payloads (eliminating stored/reflected XSS vectors), GIFs, BMPs, and PDFs.
  - **Decompression Bomb & DoS Guard:** Enforces hard 4MB decoded buffer limit (`LIMIT_FILE_SIZE`). For base64 input, validates base64 character set and computes decoded byte size before allocating Node.js buffers. Image dimensions are also read from the JPEG/PNG/WebP header (no pixel decoding) and anything above `MAX_IMAGE_PIXELS` (default 50 MP) is rejected with `400 IMAGE_DIMENSIONS_TOO_LARGE`, so a client that skips the 1024px resize cannot send a tiny file that expands into a huge image at the AI provider.
  - **EXIF & GPS Privacy Protection:** Client-side pre-processing (`imageResize.ts`) decodes via `createImageBitmap({ imageOrientation: 'from-image' })` and redraws onto an HTML5/Offscreen canvas, automatically normalizing orientation while stripping embedded EXIF metadata (such as camera GPS location coordinates) before transmission. This protection is client-side only: the server validates but does not re-encode, so a request that bypasses the web client keeps whatever metadata it was sent (server-side re-encoding, e.g. with `sharp`, is a possible follow-up).
  - **Production Error Sanitization:** Upload errors (400, 413, 415) return uniform JSON error responses with no stack traces or server internal paths.
- **Anti-Enumeration Password Recovery:** Uniform responses across all scenarios — including non-existent accounts, third-party OAuth providers, and upstream email delivery errors — ensuring no observable timing or oracle leaks exist.
- **Production Error Masking:** All database errors (`MongoServerError`, Mongoose internals) and unhandled 5xx exceptions are strictly masked with generic client messages in production (`NODE_ENV === 'production'`), shielding database topologies and credentials from client disclosure.
- **Cost-Abuse Protection Model & Daily AI Budgets:**
  - **Pre-Execution Gate:** Quota checks (`checkBudget`) execute strictly *before* dispatching calls to OpenRouter or Gemini. Requests exceeding daily token or call ceilings are rejected immediately with HTTP 429 (`AI_DAILY_BUDGET_EXCEEDED`), preventing unmetered API token spend.
  - **UTC Midnight Anchor & Timezone-Hopping Prevention:** Quota reset boundaries and document day keys (`YYYY-MM-DD`) are strictly anchored to UTC midnight. Client-supplied `X-Timezone` headers are untrusted for billing resets, preventing attackers from repeatedly resetting budgets by rotating timezone offsets.
  - **Fail-Closed vs Fail-Open Security Policy (`AI_BUDGET_FAIL_MODE`):** When the MongoDB usage store is unreachable, production environments default to `AI_BUDGET_FAIL_MODE=closed` (blocking AI requests to protect corporate API keys and billing accounts). Development and staging environments default to `open` to preserve developer workflow continuity.
  - **Zero-PII Ledger Guarantee:** The daily usage store (`AiUsageDaily`) persists only numeric counters (`calls`, `tokens`, `promptTokens`, `completionTokens`, `timeouts`, `failures`) and provider IDs. User prompts, LLM completions, meal photos, and personal identity attributes are strictly excluded from the usage ledger.
  - **Audit Logging for Blocked Accounts:** When an account is first blocked by quota exhaustion on a given day, an `AuditLog` entry (`event: 'ai_budget_exceeded'`, `status: 'blocked'`) is generated with feature and numerical counts only, providing auditable security trails without data leaks.
  - **Output Inflation & Model Injection Defense:** Client-supplied `options.maxTokens` is strictly clamped to server ceilings (2,500 tokens for chat, 4,000 for structured JSON plans via `DEFAULT_MAX_OUTPUT_TOKENS`), and `options.model` is restricted to approved system models (`DEFAULT_MODEL`, `DEFAULT_FALLBACK_MODEL`). Arbitrary user-supplied models or token expansions are rejected or clamped.
  - **Default Budget Numbers & Admin Multiplier:** Baseline defaults are 50,000 tokens/day (`AI_DAILY_TOKEN_BUDGET`), 100 calls/day (`AI_DAILY_CALL_BUDGET`), and 10x multiplier for admin accounts (`AI_DAILY_BUDGET_ADMIN_MULTIPLIER`), preventing runaway costs while accommodating operational administrative workloads.

### 🔒 Offline Sync & Idempotency Storage Security
- **What Is Stored**: The `IdempotencyKey` collection persists minimal transaction metadata: `user` (`ObjectId`), `key` (client-generated key string), `requestHash` (SHA-256 hash), `route` (API path), `status` (`in_progress` | `completed`), `statusCode` (integer), `response` (cached JSON payload), and `expiresAt` (expiration date).
- **Client Storage Privacy**: Health data mutations in the offline queue are stored exclusively in IndexedDB (`fittrack_offline_v2`) with in-memory fallback. No access tokens, refresh cookies, passwords, or emails are ever written to the queue. Plaintext `localStorage` is avoided.
- **Strict User Scoping**: Compound unique index `{ user: 1, key: 1 }` on the server and `userId` partitioning in IndexedDB guarantee complete tenant isolation. Keys or records used by User A can never match, replay, or access transactions belonging to User B.
- **Client Logout Guard**: Explicit user logout confirms and permanently purges the user's local queued mutations (`deleteQueue(userId)`), eliminating data exposure risks on shared computers or mobile devices.
- **Zero Authentication Data or Secret Storage**: The `requestHash` is computed strictly from the HTTP method, route, and canonicalized request `body` (with `idempotencyKey` omitted). Bearer tokens, cookies, passwords, and sensitive request headers are **never** incorporated into hashes, stored in the collection, or replayed back to clients.
- **Automated TTL Retention**: Records expire after `IDEMPOTENCY_TTL_HOURS` (default: 336 hours / 14 days, matching client offline queue retry retention) and are permanently purged by MongoDB via the `{ expiresAt: 1 }` TTL index (`expireAfterSeconds: 0`). Client-side mutations expire after 14 days.
- **Failure Recovery (5xx)**: If an operation returns a 5xx error or crashes, the in-progress claim is immediately removed so subsequent retries are never blocked.

### Generating Cryptographic Secrets

For production environments, never commit secrets to version control. Generate secure, cryptographically random strings using OpenSSL or Node.js crypto:

```bash
# Generate 256-bit base64-encoded secret for JWT_SECRET
openssl rand -base64 48

# Alternatively using Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Environment Security Best Practices
- Store all secrets in `server/.env` (never in client or public source control).
- Keep `REFRESH_TOKEN_SECURE=true` in production to enforce HTTPS-only cookies.
- Set `REFRESH_TOKEN_COOKIE_PATH=/api/auth` to limit cookie transmission scope to auth endpoints.
- Configure `BREVO_WEBHOOK_KEY` to authenticate incoming transactional email webhooks and prevent spoofed delivery status injections.

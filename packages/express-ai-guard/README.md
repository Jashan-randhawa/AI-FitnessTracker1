# @jashan-randhawa/express-ai-guard

Express middleware suite tailored for AI-powered applications: dual-tier rate limiting (IP + authenticated user) to avoid NAT budget starvation and runaway LLM costs, unique request tracking IDs, and production-hardened error shielding.

## Features

- 🛡️ **Dual-Tier AI Rate Limiting**: Limit total requests per IP *and* per authenticated user account (`req.user.id`). Prevents multi-tenant offices/NAT gateways from hitting false limits while containing single abusive accounts.
- 🆔 **Request ID Tracking**: Generates or preserves `X-Request-Id` headers and attaches `req.id` / `req.requestId` across logs and error responses.
- 🔒 **Production-Safe Error Handler**: Masks internal 5xx exceptions and MongoDB / Mongoose errors in production to prevent credential and topology leaks, while preserving friendly 503 upstream AI outage responses.
- 🧱 **Authentication Presets**: Pre-configured limiters for login and password-reset brute-force defense.
- 📨 **Structured Error Envelope**: Ships both flat `message` and nested `error.message` for seamless client compatibility.

## Installation

```bash
npm install @jashan-randhawa/express-ai-guard
```

## Quick Start

```typescript
import express from 'express';
import { aiLimiters, requestId, errorHandler } from '@jashan-randhawa/express-ai-guard';

const app = express();

// 1. Assign Request IDs
app.use(requestId());

// 2. Protect AI Endpoints (Dual-tier rate limiting)
app.use('/api/ai', aiLimiters({
  perIp: 30,      // 30 requests / minute per IP
  perUser: 20,    // 20 requests / minute per authenticated account
  windowMs: 60000 // 1 minute
}));

// 3. Centralized Production-Safe Error Handler
app.use(errorHandler({
  logger: console,
  isProduction: process.env.NODE_ENV === 'production'
}));
```

## Options Table

### `aiLimiters(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `perIp` | `number` | `30` | Max requests per IP per window |
| `perUser` | `number` | `20` | Max requests per authenticated user |
| `windowMs` | `number` | `60000` | Rate limit window in milliseconds |
| `store` | `any` | Memory | Pluggable store adapter (e.g. Redis) |
| `ipMessage` | `string` | Built-in | Custom IP rate limit error message |
| `userMessage` | `string` | Built-in | Custom user rate limit error message |

### `errorHandler(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `logger` | `GuardLogger` | `console` | Injectable logger instance |
| `isProduction` | `boolean` | `NODE_ENV === 'production'` | Whether to mask internal error details |
| `genericErrorMessage` | `string` | Built-in | Generic fallback for 5xx errors |

## License

MIT © Jashan Randhawa

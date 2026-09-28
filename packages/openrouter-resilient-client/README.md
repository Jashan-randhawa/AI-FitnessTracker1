# @jashan-randhawa/openrouter-resilient-client

A lightweight, resilient, dependency-free Node.js client for OpenRouter chat completions with exponential retry, failover fallback models, per-request timeouts, and clean JSON extraction.

## Features

- 🔄 **Exponential Backoff**: Automatic retry on HTTP 429 (rate-limited) and 5xx (server errors), and network disconnections (`ECONNRESET`, `ETIMEDOUT`, `AbortError`).
- 🔀 **Automatic Model Failover**: Seamlessly fails over to a secondary fallback model (e.g. `google/gemini-2.0-flash-001`) if the primary model (`openai/gpt-4o-mini`) is down.
- ⏱️ **Configurable Timeout**: Per-request timeout using standard `AbortController`.
- 📦 **Zero Runtime Dependencies**: Uses Node.js 20+ native `fetch`.
- 🧩 **Clean JSON Extraction**: Robust markdown code fence stripper and JSON parser for LLM structured outputs.
- 🪵 **Injectable Logger**: Custom logging support for request tracking and observability.

## Installation

```bash
npm install @jashan-randhawa/openrouter-resilient-client
```

## Quick Start

```typescript
import { createOpenRouterClient } from '@jashan-randhawa/openrouter-resilient-client';

const ai = createOpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'openai/gpt-4o-mini',
  fallbackModel: 'google/gemini-2.0-flash-001',
  timeoutMs: 20000,
  maxRetries: 2,
  logger: console,
});

const { text, usage, model } = await ai.chat({
  messages: [
    { role: 'system', content: 'You are a fitness coach.' },
    { role: 'user', content: 'Give me a 3-exercise chest routine.' }
  ],
  title: 'FitBot Coaching',
});

console.log(text);
console.log('Total tokens:', usage.total_tokens);
```

## Options Table

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `process.env.OPENROUTER_API_KEY` | OpenRouter API Key |
| `model` | `string` | `'openai/gpt-4o-mini'` | Primary chat model |
| `fallbackModel` | `string` | `'google/gemini-2.0-flash-001'` | Fallback model upon primary exhaustion |
| `timeoutMs` | `number` | `20000` | Per-request timeout in milliseconds |
| `maxRetries` | `number` | `2` | Max retry attempts on primary model |
| `maxFallbackRetries` | `number` | `1` | Max retry attempts on fallback model |
| `referer` | `string` | `'https://openrouter.ai'` | HTTP-Referer header for OpenRouter analytics |
| `appTitle` | `string` | `'OpenRouter Client'` | X-Title header for OpenRouter analytics |
| `logger` | `OpenRouterLogger` | Silent no-op | Logger for retry warnings & errors |

## Error Handling

Throws `OpenRouterError` with `status: 503` when upstream providers fail completely after all retries and fallback attempts.

## License

MIT © Jashan Randhawa

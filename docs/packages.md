# 📦 Modular Packages Ecosystem

[← Back to Documentation Index](README.md)

## 📦 Modular Packages Ecosystem

FitTrack AI features **7 decoupled, production-grade npm packages** published under the [`@jashan-randhawa/`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm) scope on **GitHub Packages**. These modular libraries decouple the platform's core algorithms, security middleware, and interactive UI components for use across the JavaScript and TypeScript ecosystem.

| Package | Version | Registry | Description |
|---|---|---|---|
| [`@jashan-randhawa/openrouter-resilient-client`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/openrouter-resilient-client) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/openrouter-resilient-client) | Resilient OpenRouter LLM client with automated fallback model failover, exponential retry with jitter, timeouts, and JSON extraction. |
| [`@jashan-randhawa/express-ai-guard`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/express-ai-guard) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/express-ai-guard) | Express middleware bundle: dual-tier rate limiting (IP + authenticated user ID), request correlation ID (`X-Request-Id`), and production error masking. |
| [`@jashan-randhawa/react-calendar-heatmap-streaks`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-calendar-heatmap-streaks) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-calendar-heatmap-streaks) | Generic contribution-style heatmap with 4-level color scales, timezone-safe date calculations, and streak tracking. |
| [`@jashan-randhawa/react-workout-tracker`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-workout-tracker) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-workout-tracker) | Headless `useWorkoutSession` hook and live workout logging modal with rest countdown timer and celebration effects. |
| [`@jashan-randhawa/react-motion-presets`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-motion-presets) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/react-motion-presets) | Framer Motion animation presets, `AnimatedNumber`, `StreamingWordReveal`, and accessible `CollapsibleCard`. |
| [`@jashan-randhawa/fitness-utils`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/fitness-utils) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/fitness-utils) | Multi-entrypoint toolkit: `.` (BMI, BMR, TDEE, macros, CSV export), `./react` (Audio chime & Speech hooks), `./pdf` (Report PDF). |
| [`@jashan-randhawa/ai-nutrition-estimator`](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/ai-nutrition-estimator) | `0.1.0` | [GitHub Packages](https://github.com/Jashan-randhawa/AI-FitnessTracker1/pkgs/npm/ai-nutrition-estimator) | Multimodal nutrition engine supporting NLP text meals, vision image analysis, MET exercise burn, and 5-min TTL cache. |

### Quick Installation via GitHub Packages
Configure your project's `.npmrc`:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```
Then install any package:
```bash
npm install @jashan-randhawa/openrouter-resilient-client
npm install @jashan-randhawa/express-ai-guard
npm install @jashan-randhawa/fitness-utils
```
> 📖 For comprehensive guides, API signatures, and interactive usage examples, explore the **[Wiki: Modular Packages Guide](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki/Modular-Packages)**.

---


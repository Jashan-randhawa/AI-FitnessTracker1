<div align="center">

# ⚡ FitTrack AI

### Intelligent Health, Nutrition & Fitness Operating System

[![Version](https://img.shields.io/badge/Version-v2.6.0-emerald?style=for-the-badge)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/releases)
[![CI](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml/badge.svg)](https://github.com/Jashan-randhawa/AI-FitnessTracker1/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Jashan-randhawa/8daef1b188f84235576ad3707b7aa0ea/raw/tests.json&style=for-the-badge)](docs/testing.md)
[![GitHub Packages](https://img.shields.io/badge/GitHub_Packages-7_Published-2ea44f?style=for-the-badge&logo=github)](docs/packages.md)
[![Security Hardened](https://img.shields.io/badge/CodeQL_Audit-0_Vulnerabilities-brightgreen?style=for-the-badge&logo=dependabot&logoColor=white)](docs/security.md)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

[🚀 **Explore Live Demo**](https://ai-fitness-tracker1.vercel.app) • [📖 **Documentation Index**](docs/README.md) • [🌐 **Official Wiki**](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki)

</div>

---

**FitTrack AI** is a production-grade, context-aware health and fitness operating system designed to turn biometric data into actionable training and nutritional intelligence. Built on Express 5, React 19, and MongoDB Atlas, it integrates multi-turn generative AI coaching (FitBot), multimodal Gemini vision for instant meal logging (Food Snap v2), hands-free gym voice set transcription, and high-performance real-time telemetry into a unified personal wellness platform.

## ✨ Highlights

- 🧠 **Context-Aware AI Coaching:** FitBot leverages server-built, privacy-scoped biometric context, multi-model failover (OpenRouter & Gemini 2.5), and Zod plan schemas.
- 📸 **Food Snap v2 Vision Engine:** Multimodal meal photo recognition with single-roundtrip auto-logging and automatic macronutrient breakdown.
- ⚡ **High-Performance Analytics:** $O(N)$ single-pass daily totals calculation, live midnight rollover hook, and real-time Server-Sent Events (SSE).
- 🎙️ **Workout Studio & Voice Logging:** Hands-free speech-to-metrics set transcription, audio cues, rest timers, and exercise video streaming.
- 🔐 **Hardened Security & Privacy:** Single-flight Refresh Token Rotation (RTR), CSRF/origin checks, rolling 5-password history, secret scrubber, and zero-leakage tarballs.
- 📦 **Decoupled Architecture:** 7 modular TypeScript packages published on GitHub Packages for UI components, calculation utilities, and AI guards.

## 📋 Prerequisites

- **Node.js:** `>= 20.0.0` (Node 22 LTS recommended)
- **Database:** Local MongoDB instance (`mongodb://127.0.0.1:27017/fittrack`) or [MongoDB Atlas](https://www.mongodb.com/atlas) URI
- **AI Keys (Optional for core app):** [OpenRouter API Key](https://openrouter.ai) and/or [Google Gemini API Key](https://aistudio.google.com) for AI coaching & vision

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Jashan-randhawa/AI-FitnessTracker1.git
cd AI-FitnessTracker1
```

### 2. Configure & Run Backend Server

```bash
cd server
npm install

# Copy environment template
cp .env.example .env

# Generate a secure JWT secret: openssl rand -base64 48
# Edit .env to set your JWT_SECRET and MongoDB URI

npm run dev
```
> Server boots on `http://localhost:1337` and seeds initial blog posts automatically.

### 3. Configure & Run Frontend Client

```bash
cd ../client
npm install

# Copy environment template (dev proxy routes /api to http://localhost:1337)
cp .env.example .env

npm run dev
```
> Client launches on `http://localhost:5000` (or Vite allocated port).

### 4. Run Automated Test Suite

```bash
# Backend suite (661 tests via native Node runner)
cd ../server
npm test
npm run test:smoke

# Frontend suite (20 tests via Vitest)
cd ../client
npm test
```

---

## 📖 Documentation

Complete architecture blueprints, API schemas, and deployment guides are maintained in [`docs/`](docs/README.md):

- 🚀 [**Getting Started Guide**](docs/getting-started.md) — Prerequisites, environment variables reference, and local setup.
- 🏗️ [**Architecture & Design**](docs/architecture.md) — System topology, client/server boundaries, Mermaid diagram, and file structure.
- 📡 [**REST API Reference**](docs/api-reference.md) — All endpoints, rate limits, request schemas, and authentication scopes.
- 🔐 [**Security & Compliance**](docs/security.md) — Token rotation, secret generation, sanitization, and CodeQL audit remediation.
- 🧪 [**Testing & CI/CD**](docs/testing.md) — Test breakdown, smoke testing, and GitHub Actions workflow specs.
- 🚢 [**Deployment Guide**](docs/deployment.md) — Production hosting on Vercel, Render, Railway, Fly.io, and Atlas.
- ✨ [**Features & Core Capabilities**](docs/features.md) — Deep dives into AI coaching, analytics, workout studio, and planners.
- 📦 [**Modular Packages Ecosystem**](docs/packages.md) — The 7 decoupled libraries published under `@jashan-randhawa/*`.
- 📋 [**Release Changelog**](docs/changelog.md) — Version milestone history and platform evolution.
- 🤝 [**Contributing Guidelines**](docs/contributing.md) — Coding conventions, git branch workflow, and PR standards.
- 📑 [**Engineering Audits & RFCs**](docs/ENGINEERING_REPORTS.md) — Specialized architectural audit reports and phase records.

For interactive guides and visual walkthroughs, visit our [**Official GitHub Wiki**](https://github.com/Jashan-randhawa/AI-FitnessTracker1/wiki).

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Jashan-randhawa">Jashan Randhawa</a></sub>
</div>

# Contributing to FitTrack AI & Packages

Thank you for your interest in contributing to the FitTrack AI monorepo! This repository contains both the FitTrack AI full-stack application and 7 modular, production-ready npm packages.

## Monorepo Layout

```
AI-FitnessTracker1/
├── apps/
│   ├── client/              # React 19 + Vite + Tailwind CSS frontend
│   └── server/              # Express 4 + MongoDB backend
├── packages/
│   ├── openrouter-resilient-client/       # Resilient OpenRouter client
│   ├── express-ai-guard/                  # Rate limiting & error shielding
│   ├── react-calendar-heatmap-streaks/    # Contribution heatmap & streaks
│   ├── react-workout-tracker/             # Live workout set logger & session hook
│   ├── react-motion-presets/              # Framer Motion stagger, count-up & cards
│   ├── fitness-utils/                     # Fitness math, CSV, Speech & PDF utilities
│   └── ai-nutrition-estimator/            # AI nutrition & activity energy estimator
└── .github/workflows/                     # CI and Automated Release pipelines
```

## Development Workflow

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### 2. Setup
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Jashan-randhawa/AI-FitnessTracker1.git
cd AI-FitnessTracker1
npm install
```

### 3. Building Packages
To build all packages:
```bash
npm run build
```

### 4. Running Tests
To run unit test suites across all packages and apps:
```bash
npm test
```

### 5. Adding Changesets
When making changes to any package, create a changeset:
```bash
npx changeset
```
Follow the interactive prompts to select the packages changed, choose semver bump type (patch, minor, major), and write a summary.

## Code Quality Standards

- **Strict TypeScript**: No `any` types in public exported APIs.
- **Test Coverage**: All pure calculations, resilience retries, and core logic must have unit tests.
- **Clean Packaging**: Verify with `npm pack --dry-run` before release.
- **License**: All code is licensed under the MIT License.

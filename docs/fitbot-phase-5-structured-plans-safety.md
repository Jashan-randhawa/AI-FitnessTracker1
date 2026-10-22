# Phase 5 Implementation Report — Structured AI Outputs, Schema Validation, Client Unification & Safety Guardrails

**Date:** 2026-10-22  
**Status:** Completed & Verified  
**Branch:** `feat/fitbot-phase-5-structured-plans-safety`  
**Reference Task:** FitBot AI Chatbot Master Plan — Phase 5  

---

## 1. Executive Summary

Phase 5 addresses runtime stability, contract enforcement, and clinical safety across all structured AI features in FitTrack. Prior to this phase, AI-generated meal plans and workout routines relied on unchecked TypeScript type assertions (`JSON.parse(...) as DayPlan[]`), leaving the UI vulnerable to fatal React runtime crashes whenever upstream models altered JSON structures. Furthermore, direct, duplicated `fetch` calls were scattered across 5 frontend pages, and explicit medical safety boundaries were missing from the system prompt.

All Phase 5 objectives have been fully implemented, validated, and tested with **zero regressions** and **zero paid dependencies**:
1. **Zod Runtime Schema Validation & Normalization**: Defined matching, robust Zod schemas and extraction pipelines on both server (`server/src/schemas/aiPlans.schema.js`) and client (`client/src/schemas/aiPlans.schema.ts`) for Meal Plans and Activity / Workout Plans.
2. **Defensive Envelope Unwrapping & Parsing**: Extractors effortlessly parse raw JSON, markdown-fenced code blocks (````json ... ````), and wrapper dictionaries (`{ plan: [...] }`, `{ days: [...] }`, `{ mealPlan: [...] }`), automatically calculating missing summary metrics (`totalCalories`, `totalDuration`, `totalCaloriesBurned`).
3. **Upstream Schema-Aware Repair Retry**: Upgraded `aiAssistant.service.js` so that if an AI response fails Zod schema validation, an automatic repair retry is dispatched with targeted diagnostic error feedback.
4. **Unified Frontend AI Client**: Created `client/src/services/aiAssistantClient.ts` to replace scattered raw `fetch` calls across all 5 frontend consumer pages (`AIAssistant.tsx`, `MealPlanner.tsx`, `ActivityPlanner.tsx`, `Weather.tsx`, and `Dashboard.tsx`).
5. **Clinical & Fitness Safety Boundaries**: Integrated strict medical safety guardrails into `server/src/prompts/fitbot.prompt.js`, including safe minimum calorie thresholds (1,200 kcal for females, 1,500 kcal for males), acute pain stoppage directives, and eating disorder safeguards.

---

## 2. Remediated Audit Findings

| Finding ID | Priority | Description | Remediation Summary |
|---|---|---|---|
| **F-03** | P1 (High) | Lack of Runtime Schema Validation on Structured AI Responses | Replaced unsafe `as DayPlan[]` / `as ActivityDayPlan[]` casts with Zod `safeParseMealPlan` and `safeParseActivityPlan`. Added server-side schema verification and targeted repair retries. |
| **F-05** | P1 (High) | Fitness Safety Guardrails & Clinical Boundaries | Added clinical boundaries: minimum calorie safe harbor (<1,000 kcal forbidden), chest pain/acute distress stoppage, eating disorder support resources, and injury disclaimer. |
| **F-06** | P2 (Medium) | Direct `fetch` Invocations Across 5 Frontend Pages | Implemented central `aiAssistantClient.ts` providing typed helpers, JWT injection, base URL resolution, AbortSignal support, and normalized error throwing. |

---

## 3. Architecture & Contracts

### 3.1 Structured Plan Schemas (`aiPlans.schema.js` & `aiPlans.schema.ts`)

- **Meal Plans**:
  - `MealSchema`: Validates `name`, `calories` (coerced non-negative int), `protein`, `carbs`, `fat`, `mealType` (normalized to `breakfast` | `lunch` | `dinner` | `snack`), and `description`.
  - `DayPlanSchema`: Validates `day`, array of `meals` (min 1), and `totalCalories`.
  - Normalization: If `totalCalories` is omitted or 0, it is automatically computed as the sum of all meal calories.
- **Activity & Workout Plans**:
  - `PlannedActivitySchema`: Validates `name`, `type`, `duration` (positive int, max 720m), `caloriesBurned`, `intensity` (`low` | `medium` | `high`), `targetMuscles`, `notes`, `warmup`, and `cooldown`.
  - `ActivityDayPlanSchema`: Validates `day`, array of `activities` (min 1), `totalDuration`, `totalCaloriesBurned`, and `recoveryFocus`.
  - Normalization: Auto-computes aggregate duration and calorie burn from individual activities if missing.

### 3.2 Server-Side Schema Guard & Repair Loop (`aiAssistant.service.js`)

- When `options.expectJson` is true:
  1. Validates candidate text with `validateStructuredOutput(content, planType)`.
  2. If validation fails, logs diagnostic issue and initiates 1 repair completion:
     ```
     Your previous response did not match the required [planType] JSON schema: [validationErrors]. Return ONLY valid, well-formed JSON matching the requested structure without markdown formatting or commentary.
     ```
  3. If repaired output conforms, it is returned seamlessly; if still violating, normalized best-effort data is extracted without crashing.

### 3.3 Clinical Safety Policy (`fitbot.prompt.js`)

- **Minimum Calorie Safe Harbor**: Never recommend or generate daily meal plans below 1,200 kcal for adult females or 1,500 kcal for adult males. Never advocate starvation, dry fasting, or severe caloric deprivation (<1,000 kcal).
- **Acute Pain & Red-Flag Symptoms**: If the user describes sharp chest pain, shortness of breath, dizziness, sudden numbness, or sharp joint swelling during or after exercise, instruct them to stop exercising immediately and seek urgent medical evaluation.
- **Eating Disorder Red Flags**: If queries express obsessive calorie restriction, purging behaviors, guilt over normal eating, or signs of disordered eating, refuse to assist with restrictive regimens and offer compassionate support alongside professional helpline resources.
- **Injuries & Rehabilitation**: Never prescribe specific physical therapy or claim to treat diagnosed injuries; suggest gentle, pain-free active recovery and advise clearance from a certified physical therapist or physician.
- **Supplements & Medications**: Never prescribe medications or advocate dangerous unregulated substances (e.g., anabolic steroids, extreme fat burners, excessive stimulant stacks).

---

## 4. Verification & Test Baseline

### 4.1 Server Test Suite
- Test Suite: `node scripts/ci-guard-email.js && node --test test/*.test.js`
- **Result**: `tests 216 | suites 56 | pass 216 | fail 0`
- Coverage includes 15 new dedicated tests in `test/aiPlans.test.js` covering schema parsing, wrapper unwrapping, repair retries, and clinical boundary compliance.

### 4.2 Client Lint & Production Build
- `npm run lint`: 0 errors, 135 non-blocking warnings (improved from 139).
- `npm run build`: `tsc -b && vite build` built in ~10s with 0 errors. All 5 pages successfully compiled against the new unified client and Zod schemas.

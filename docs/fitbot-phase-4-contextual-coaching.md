# FitBot Phase 4: Contextual Coaching

This records the Phase 4 change: FitBot now answers from server-built fitness context, not from
client-built text. It covers what changed, how the cache was verified, before and after examples,
and what is still open.

## What changed

| Area | Before | After |
|---|---|---|
| Source of profile and daily data | `userContext` string built in `AIAssistant.tsx` from client logs and forwarded to the server | Built on the server from `User`, `FoodLog`, `ActivityLog`, `WaterLog`, and `WorkoutPlan`, scoped to the authenticated user |
| Client `userContext`, `context`, `systemInstruction` | Forwarded into the system prompt | Accepted for compatibility, not forwarded, not trusted |
| Dashboard tip | Sent a client-built "goal, weight, consumed, burned" string | Sends no client context; the server adds it |
| Prompt | v1.3.0 constant, but the file's changelog documented v1.4.0 | v1.5.0. The constant now matches the changelog. This version also carries the v1.4.0 safety rules |
| Interpretation rules | Generic "use context actively" instruction | Rules for unlogged vs zero, weekly-pattern evidence, recent training load, hydration, remaining targets, weather relevance, and missing information |
| Cache key | Messages, JSON flag, model, token ceiling, prompt version | Adds the user scope, so identical messages from different users never share an answer |
| Planner requests (`expectJson`) | No user context | Unchanged. They do not load the fitness context |

### Server context additions

`server/src/services/fitnessContext.service.js` gained:

- **Training load:** `trend.consecutiveTraining` counts consecutive days with logged activity, ending today or yesterday.
- **Evidence flags:** `trend.evidence` marks weekly patterns as sufficient only when enough days are logged (food 4 days, activity 3, water 4).
- **Serialised lines:**
  - remaining calories and protein, or "unknown" when no food is logged, and "over target" when exceeded
  - hydration against the goal, or "no water logged yet"
  - a "Recent training" line
  - an evidence verdict in the seven-day line
- `buildFitnessPromptContext()`: returns text and never throws. A total failure becomes an explicit "unavailable" line.

### Controller

`server/src/controllers/aiAssistant.controller.js`:

- Conversational requests get `<fitness_context>` from the server, using the authenticated user and the validated `X-Timezone`.
- Requests with `expectJson` skip it, so planner contracts are unchanged.
- `cacheScope` is set to `user:<id>` for every request.

## Cache verification

The existing key already included the prompt version and the full messages. Those messages contain the system prompt, which
contains the server context. So a change in the user's data or in the prompt produces a different key.

Phase 4 adds the user scope:

- `computeCacheKey({ ..., scope, promptVersion })`. Tests show:
  - same inputs give the same key
  - a different user gives a different key
  - a different prompt version gives a different key
- `chatWithAssistant` tests show:
  - user B never receives user A's cached answer, even with identical messages and context
  - the same user with unchanged context gets a cache hit
  - a change in logged data is a cache miss
- Controller tests show that two users with the same messages both reach the model.

The cache is still in-process and holds entries for 5 minutes. It is not shared across instances.

## Before and after

The "after" text below is real output from `buildFitnessPromptContext`, run on deterministic fixtures
(timezone Asia/Calcutta, 25 Oct 00:10 local).

### Sparse history (new account, nothing logged)

Before: the client sent a string such as `[User Profile] ...` only when a profile existed. With no logs,
the nutrition and activity lines were omitted, so the model had no explicit statement that nothing was recorded.

After:

```
<fitness_context>
Local time: 2026-10-25 00:10 (Asia/Calcutta).
Profile: none. Not provided: goal, weight, height, age.
Targets: calorie intake 2000 kcal (default), calorie burn 400 kcal (default), protein 150 g (default), carbs 200 g (default), fat 67 g (default), water 2500 ml (default).
Today so far: no food logged; no activity logged; no water logged yet (goal 2500 ml); streak 0 days. Remaining today: unknown, because no food is logged yet.
Recent training: no activity logged in the last 7 days.
Last 7 days (2026-10-19 to 2026-10-25): food logged on 0 days (no average); activity on 0 days (no average); water on 0 days (no average). Evidence for weekly patterns: food insufficient, activity insufficient, water insufficient.
Active workout plan: none.
</fitness_context>
```

### Complete history (goal set, a training run, an active plan)

Before: the client string covered profile and today's totals only. It had no hydration goal comparison, no
remaining targets, no training run, and no plan.

After:

```
<fitness_context>
Local time: 2026-10-25 00:10 (Asia/Calcutta).
Profile: goal lose weight, weight 72 kg, height 178 cm, age 31 years.
Targets: calorie intake 1800 kcal (set), calorie burn 400 kcal (default), protein 130 g (set), carbs 180 g (default), fat 60 g (default), water 2500 ml (set).
Today so far: food 1240 kcal over 3 meals (protein 72 g, carbs 130 g, fat 41 g); no activity logged; water 1500 ml of 2500 ml goal; streak 5 days. Remaining today: 560 kcal left, protein 58 g left.
Recent training: 4 consecutive days with logged activity, through yesterday.
Last 7 days (2026-10-19 to 2026-10-25): food logged on 6 days (average 1715 kcal per logged day); activity on 4 days (average 270 kcal burned per logged day); water on 6 days (average 2000 ml per logged day). Evidence for weekly patterns: food sufficient, activity sufficient, water sufficient.
Active workout plan: "Fat loss circuit" (3 days per week, split full body). Days: Day 1: Full body (45 min, 3 exercises); Day 2: Intervals (30 min, 2 exercises).
</fitness_context>
```

The "Not provided" clause only appears when something is missing. An earlier version printed `Not provided: .`
for a complete profile. A regression test now covers this.

### Expected behaviour under the rules (illustrative, not model output)

These show what the new rules are meant to produce. They are not captured from a live model.

| User asks | Before (client string only) | After (server context + rules) |
|---|---|---|
| "Did I work out today?" | Could guess from history or stay vague | "No activity is logged for today yet. If you trained, add it so I can factor it in." |
| "What can I eat for dinner?" (complete history) | Generic meal ideas | Ideas sized to 560 kcal and 58 g protein left, with no extreme restriction |
| "Should I do a hard session tomorrow?" (4 days in a row, through yesterday) | Could recommend intensity without noting load | Recommends recovery or lower intensity, and respects the plan's schedule |
| "How's my week going?" (2 food days logged) | Could describe a trend from two data points | Says the data is too limited to show a pattern, and asks one short question |

## Safety and privacy checks

- Every clinical safety section of the system prompt is still present, verified by a test that checks each heading.
- The untrusted-data policy covers `<fitness_context>` and `<environment>`. Plan titles are sanitised before they reach the prompt. A test confirms a plan title cannot close the block or inject a tag.
- User identity comes from `req.user`, never from the request body.
- The context contains no user id, no raw documents, and no food names. Only aggregates and plan names appear.
- Memory stays in its own `<coaching_memory>` block and remains bounded at 1,200 characters.
- Rate limits, concurrency caps, truncation, cancellation, and fallback-model behaviour are unchanged. The existing tests for them pass.

## Verification

- `npm test` in `server/`: **406 tests, 0 failures**.
  - 33 new Phase 4 tests in `server/test/fitbotCoaching.test.js`, covering:
    - empty and partial contexts
    - calorie and macro targets
    - training load and evidence
    - failure visibility
    - prompt contract and safety rules
    - cache scope and version
    - cross-user isolation
    - controller behaviour
  - Pinned version checks in two test files (`aiAssistant.test.js`, `openrouter.test.js`) updated from 1.3.0 to 1.5.0.
  - Two environment test assertions tightened so they match the block delimiter, not the tag name, because the new rules mention the tag.
- `client`: `npm run lint` shows 0 errors. I checked the touched files and found no new unused-variable warnings. `npm run build` passes.

## Limitations and open items

- **Prompt size grew.** `FITBOT_SYSTEM_PROMPT` went from 5,274 to 6,558 characters, about 24%. The brief asked for compactness.
  The rules are the main addition. Trimming the older "Your role" and "Guidelines" sections would recover some of the space,
  but I have not made that change.
- **Model behaviour is not tested live.** The tests check that the prompt carries the rules and that the context is correct.
  Whether the model follows them needs a live evaluation against real or fixture accounts.
- **Nine queries per conversational request.** The context builder runs about nine aggregations or lookups on every
  conversational message. This has not been measured under load.
- **Planners do not get the context.** Meal and activity planners still use their page-built prompts with a 70 kg weight default.
  Moving them is a separate change, since their JSON contract needs its own tests.
- **Weather is included only through the Phase 3 environment block,** and only when the request carries it.
- **Duplicate local time.** When both `<fitness_context>` and `<environment>` are present, both state the local time. They agree,
  because both come from the server.
- **Prompt version resolved.** The 1.3.0 constant and the 1.4.0 changelog conflict from Phase 1 is now closed.
- **Commit status.** Not committed or pushed. Awaiting authorisation.

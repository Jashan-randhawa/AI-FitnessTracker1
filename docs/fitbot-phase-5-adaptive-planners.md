# FitBot Phase 5: Adaptive Meal and Activity Planners

This records the Phase 5 change. The meal and activity planners now plan from what the user has
already logged and from their active workout plan, not only from the form they filled in. Plans are
checked after generation against calorie budgets and the training-streak rule. Nothing is committed
or pushed.

## What changed

| Area | Before | After |
|---|---|---|
| Meal planner inputs | Client prompt with goal, weight (70 kg default), and target calories | Client sends the requested target and food preferences. Server supplies remaining calories, today's food names, and the budget |
| Calorie limit on a plan | Prompt wording only ("close to X kcal") | Server budget. Each day's calories are recomputed from the items and checked after generation |
| Activity planner inputs | Client prompt with goal and weight | Client sends focus, level, and equipment. Server supplies the active plan and recent training |
| Streak handling | Not considered | Two or more consecutive training days: Day 1 may not contain high-intensity work |
| Outdoor suggestions | Example prompt started with an outdoor walk | Example is indoor. Outdoor options only when `<environment>` shows suitable conditions |
| Data missing | Planner ran on client-held values | Planner request is refused with 503 if today's totals or the trend cannot be loaded |
| Plan outside limits | Accepted if it passed the schema | One repair attempt, then 422. Never cached, never returned |
| Prompt | v1.5.0 | v1.6.0, with a "Planning with server context" section |

Unchanged: the plan schemas, JSON repair, the save endpoint (`POST /api/workout-plans`), the logging
endpoints (`/api/foodlogs`, `/api/activitylogs`), single-day and multi-day modes, and the saved plan
format.

## Planning context

`server/src/services/plannerContext.service.js` builds on the shared fitness context from Phase 2. It
reuses the same summary, goal and plan code. It adds two things: a calorie budget for the plan, and the
names of today's food (names only, no ids or notes). It reads only and writes nothing.

### Budget rules

| Case | Day 1 budget | Later days |
|---|---|---|
| Nothing logged today | Daily target | Daily target |
| Partly logged | Calories left today, capped at the daily target | Daily target |
| Over target today | Daily target, planned as tomorrow, with no extra meals today | Daily target |
| Under 300 kcal left | Daily target, planned as tomorrow (too little for a full plan) | Daily target |
| Client requested a target | The request lowers the target. A request above the goal is capped at the goal. Values outside 800 to 5000 are ignored | Same |

The 300 kcal threshold is a product choice, not a clinical figure. The code and the prompt use the
same value.

Budgets are upper limits. The post-generation check allows 10% above each budget, matching the
prompt's earlier "±10%" wording.

### Fail-closed behaviour

| Failure | Result |
|---|---|
| Today's totals or the seven-day trend cannot be loaded | Both planners: 503, nothing sent to the model |
| Active plan lookup fails | Activity planner: 503. Meal planner does not use the plan |
| Food lookup fails | Meal planner: 503 |
| Weather missing | Not an error. Planning proceeds without outdoor assumptions |

## Post-generation limits

`server/src/utils/plannerLimits.js` checks each generated plan after schema validation:

- **Meal plans:** each day's calories are summed from its meals. The model's `totalCalories` field is
  ignored. Day 1 is checked against its budget, later days against the daily target.
- **Activity plans:** with two or more consecutive training days, Day 1 may not contain a
  `high`-intensity activity.

Validation runs in `server/src/services/aiAssistant.service.js`:

1. The model answers. If the answer fails the schema or a limit, one repair request goes back. Its
   feedback names the problem: a schema error, or a broken planning limit.
2. A plan that is still outside limits after repair is refused with 422 and is not cached.

Only an upper bound is enforced on calories. A lower bound would depend on sex, which the profile
does not store, and the safe-harbour minimum (1,200 kcal for adult females, 1,500 kcal for adult males)
is a prompt rule. A remaining-calorie plan can still fall short of the minimum when the user has eaten
very little. The prompt tells the model to say so instead of cutting calories to fit a budget. This is
a prompt-level control, not a code-level one.

## Request contract

The existing `POST /api/ai-assistant/chat` endpoint is unchanged in shape. One optional field is added
under `options`:

```json
{
  "messages": [{ "role": "user", "parts": [{ "text": "..." }] }],
  "options": {
    "expectJson": true,
    "planType": "mealPlan",
    "targetCalories": 1500
  }
}
```

- `planType` `mealPlan` or `activityPlan` (or `workoutPlan`) selects the planner context.
- `targetCalories` is a preference. The server caps it at the goal and at calories left today.
- Client `userContext`, `context`, `systemInstruction`, and any weight or goal values in the prompt are
  not used for limits. The server reads the profile from the authenticated user.
- `environment` (Phase 3) is still accepted for outdoor context. The activity page does not send it
  (see limitations).

Error responses for planners:

| Status | Meaning |
|---|---|
| 503 | Fitness data could not be loaded. No model call was made |
| 422 | The plan stayed outside its limits after one repair. Nothing was returned or cached |
| 400 | Invalid messages, as before |

The client shows the error message in its existing toast.

## Prompt example

This is real output from `buildPlannerContext`. The fixture is a user with a 1,800 kcal goal and
1,240 kcal already logged today (Asia/Calcutta, 25 Oct 00:10). Only the planning lines are new. The
lines above them are the Phase 4 context.

```
Planner request: meal plan.
Food logged today (already eaten, not part of the plan): Oats, Dal, Paneer wrap.
Calorie budget: Day 1 (remaining today) 560 kcal; each later day 1800 kcal. These are upper limits.
Remaining macros today: protein 58 g, carbs 50 g, fat 19 g.
```

The activity planner gets the streak line in the same way. For a user who trained on the last three
days (ending today):

```
Planner request: activity plan.
Planning limit: 3 consecutive training days (today), so Day 1 must not include high-intensity activities.
```

The system prompt rules that the model must follow (v1.6.0, excerpt):

```
- When <fitness_context> has planning lines, its calorie budgets are upper limits. Keep each day's meal calories within the stated budget.
- Food already logged today is already eaten. Plan only what is not yet logged.
- Never say or imply that a planned meal was eaten or a planned workout was done.
- When the planning lines show two or more consecutive training days, Day 1 must use low or medium intensity only.
```

These lines are data, not instructions, in the same way as the rest of `<fitness_context>`. Food
names are sanitised and capped (8 names, 40 characters each), so a food name cannot close the block.

## Tests

`server/test/plannerContext.test.js`: 53 tests.

| Group | Covers |
|---|---|
| Budgets | No history, partial, over target, under 300 kcal, exactly 300, requested target lowered, capped, ignored, default target |
| Fail-closed | Totals, trend, plan, and food lookup failures; unknown planType |
| Activity context | Streak limit (3 days), single day (no limit), active plan present, no weather needed |
| Food names | Local-day filter across time zones, tag stripping, length cap, 8-name cap, injected tag, names unavailable |
| Limits | 10% allowance, totals recomputed from items, multi-day caps, high-intensity Day 1 rule, no limits |
| Validation and service | Schema versus constraint classification, repair message, 422 refusal, no caching of refused plans, cache hit for a valid plan, malformed JSON refused |
| Controller | Planner branch used, conversational context not used, requested target passed, 503 with no model call, 422 after repair, client context ignored, no weather still works, no-planType JSON unchanged, conversational chat unchanged |
| Persistence | Source check: no write calls in the planner service, limits module, or controller path |
| Prompt | v1.6.0 changelog and rules present; safe-harbour text kept |

Pinned version assertions were updated from 1.5.0 to 1.6.0 in `openrouter.test.js`,
`aiAssistant.test.js` and `fitbotCoaching.test.js`. The cache-key test that uses 1.5.0 as a "different
version" literal is unchanged.

Existing tests still cover the plan schemas, JSON repair, workout-plan saving, and food and activity
logging (`aiPlans.test.js`, `workoutPlan.test.js`, `summary.test.js`).

## Verification

- `cd server && npm test`: **459 tests, 0 failures** (406 before, plus 53 new).
- `client`: `npm run lint` shows 0 errors and 130 warnings. The three touched files have the same
  warning counts as at HEAD, so no warnings were added. `npm run build` passes.

## Limitations and open items

- **No live model evaluation.** Tests check the context, the limits and the prompt contents. They do
  not show that the model follows the planning rules. A live evaluation is still needed.
- **Activity planner has no weather.** The Weather page keeps no stored observation, and the activity
  planner does not request location. Without `environment`, the planner treats outdoor conditions as
  unknown and offers indoor options. Wiring weather in would need either stored weather or a location
  step, and that is a separate decision.
- **Safe-harbour minimum is a prompt rule.** The code enforces only an upper bound (see Limitations
  above).
- **Extra database reads.** The meal planner adds one food query to the nine or so reads the
  context already makes. This has not been measured.
- **Food query window.** Up to 200 food entries are read before the local-day filter. A day with more
  than 200 entries in that window would show only some names. The calorie total still comes from the
  full summary.
- **Calorie-target control.** The UI's target control still exists. It now acts as a preference the
  server can lower, not as a value the plan must match.
- **The 300 kcal threshold** is a product choice, and the Day 1 "tomorrow" rule changes what a
  single-day plan means for a user who is over target. Both should be reviewed.
- **Planned and completed records stay separate.** No planner path writes to food or activity logs.
  Saving a workout plan and logging an activity remain explicit user actions, as before.

## Commit status

Not committed or pushed. Waiting for authorisation.

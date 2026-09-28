# @jashan-randhawa/react-workout-tracker

An interactive live workout set logger and headless session management hook for strength training, featuring per-set weight & rep entries, animated rest interval countdowns, and completion celebrations.

## Features

- 🏋️ **Live Set Tracking**: Add, check off, edit weight/reps, and delete sets with reactive animations.
- ⏱️ **Auto Rest Interval Timer**: Countdown timer with quick presets (30s, 60s, 90s, 120s) and animated progress bar that activates automatically on set completion.
- 🎉 **Completion Celebration**: Optional confetti celebration trigger upon finishing all sets.
- 🧠 **Headless Hook Included**: `useWorkoutSession` allows developers to build custom workout UIs with built-in volume tracking and state management.

## Installation

```bash
npm install @jashan-randhawa/react-workout-tracker framer-motion canvas-confetti
```

## Quick Start

### Ready-to-Use Component

```tsx
import { WorkoutTracker } from '@jashan-randhawa/react-workout-tracker';

export function GymLogger() {
  return (
    <WorkoutTracker
      defaultExercise="Barbell Bench Press"
      restSeconds={60}
      celebrate={true}
      onFinish={(session) => {
        console.log('Session finished:', session);
      }}
    />
  );
}
```

### Headless Hook

```tsx
import { useWorkoutSession } from '@jashan-randhawa/react-workout-tracker';

function CustomTracker() {
  const {
    exercise,
    sets,
    completedCount,
    totalVolumeKg,
    handleToggleComplete,
    handleAddSet,
  } = useWorkoutSession({
    initialExercise: 'Deadlift',
  });

  return (
    <div>
      <h2>{exercise} (Volume: {totalVolumeKg} kg)</h2>
      {sets.map((s) => (
        <button key={s.id} onClick={() => handleToggleComplete(s.id, !s.completed)}>
          Set {s.setNumber}: {s.weight}kg x {s.reps} {s.completed ? '✓' : '○'}
        </button>
      ))}
      <button onClick={handleAddSet}>Add Set</button>
    </div>
  );
}
```

## Props Table

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultExercise` | `string` | `'Barbell Bench Press'` | Default exercise name |
| `restSeconds` | `number` | `60` | Rest interval duration in seconds |
| `celebrate` | `boolean` | `true` | Trigger confetti celebration upon completion |
| `onFinish` | `(session: WorkoutSessionSummary) => void` | `undefined` | Callback when all sets are completed |
| `onClose` | `() => void` | `undefined` | Close button handler |

## License

MIT © Jashan Randhawa

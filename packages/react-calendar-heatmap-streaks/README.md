# @jashan-randhawa/react-calendar-heatmap-streaks

A responsive, GitHub-style contribution calendar heatmap for React with 4-level color intensity, daily activity tooltips, animated cell interactions, and timezone-accurate current/best streak calculations.

## Features

- 📅 **GitHub-Style Contribution Grid**: Aggregates any arbitrary data array into standard 7-row calendar grid.
- 🔥 **Streak Calculation Engine**: Computes current and historic best active streaks with yesterday-grace handling.
- 🕒 **Timezone-Safe**: Groups entries according to the user's local day boundaries (e.g. entries made at 11:00 PM don't shift to tomorrow).
- 🎨 **Multiple Color Palettes**: Built-in `emerald`, `orange`, `blue`, `purple`, and `slate` themes, plus full custom color map support.
- 📱 **Responsive & Accessible**: Clean horizontal scroll container and ARIA labeling for cell status.
- 💬 **Interactive Animated Tooltips**: Smooth hover animations via optional `framer-motion`.

## Installation

```bash
npm install @jashan-randhawa/react-calendar-heatmap-streaks framer-motion
```

## Quick Start

### Generic Heatmap Component

```tsx
import { Heatmap } from '@jashan-randhawa/react-calendar-heatmap-streaks';

interface WorkoutLog {
  id: string;
  completedAt: string;
  durationMinutes: number;
}

export function WorkoutHeatmap({ workouts }: { workouts: WorkoutLog[] }) {
  return (
    <Heatmap<WorkoutLog>
      data={workouts}
      days={84} // 12 weeks
      getDate={(item) => item.completedAt}
      getValue={(item) => item.durationMinutes}
      thresholds={[0, 20, 45, 75]}
      theme="emerald"
      onSelectDate={(dateStr) => console.log('Selected date:', dateStr)}
    />
  );
}
```

### Standalone Pure Utility

```typescript
import { computeStreaks } from '@jashan-randhawa/react-calendar-heatmap-streaks';

const dates = ['2026-06-01', '2026-06-02', '2026-06-03'];
const { currentStreak, bestStreak, totalActiveDays } = computeStreaks(dates);
```

## Props Table

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `T[]` | Required | Array of data items |
| `getDate` | `(item: T) => string \| Date` | Required | Accessor for item date |
| `getValue` | `(item: T) => number` | `() => 1` | Accessor for value to aggregate |
| `days` | `number` | `84` | Total days in heatmap grid |
| `thresholds` | `[number, number, number, number]` | `[0, 500, 1500, 2500]` | Cutoffs for levels 1, 2, 3, 4 |
| `theme` | `'emerald' \| 'orange' \| 'blue' \| 'purple' \| 'slate'` | `'emerald'` | Color theme |
| `selectedDate` | `string \| null` | `null` | Highlighted date |
| `onSelectDate` | `(dateStr: string) => void` | `undefined` | Date selection callback |

## License

MIT © Jashan Randhawa

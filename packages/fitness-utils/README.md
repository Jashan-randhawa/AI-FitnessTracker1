# @jashan-randhawa/fitness-utils

A framework-agnostic fitness mathematics and browser utility library, split into a zero-dependency core, optional React speech & audio hooks, and an optional PDF report generator.

## Subpath Entry Points

- `@jashan-randhawa/fitness-utils` — Core math (BMI, net calories, macros, MET burn) & RFC 4180 CSV builder. (Zero dependencies)
- `@jashan-randhawa/fitness-utils/react` — React hooks for Web Audio completion chimes and Web Speech recognition & synthesis.
- `@jashan-randhawa/fitness-utils/pdf` — Styled PDF summary report builder using `jspdf` and `jspdf-autotable`.

## Installation

```bash
npm install @jashan-randhawa/fitness-utils
```

Optional peers:
```bash
# If using React hooks:
npm install react

# If using PDF report generator:
npm install jspdf jspdf-autotable
```

## Quick Start

### Core Mathematics & CSV

```typescript
import { calcBMI, bmiCategory, macroPercentages, toCSV, downloadCSV } from '@jashan-randhawa/fitness-utils';

// Calculate BMI & WHO Classification
const bmi = calcBMI(75, 180); // 23.1
const category = bmiCategory(bmi); // "Normal"

// Calculate Calorie Splits
const { carbsPct, proteinPct, fatPct } = macroPercentages(200, 150, 60);

// Export CSV with modern Blob download
const csv = toCSV(['Name', 'Calories'], [['Oatmeal', 300]], {
  filename: 'nutrition.csv',
  download: true,
});
```

### React Hooks (`/react`)

```tsx
import { useSpeechRecognition, useSpeechSynthesis, useCompletionChime } from '@jashan-randhawa/fitness-utils/react';

function Assistant() {
  const { playChime } = useCompletionChime();
  const { isListening, toggleListening } = useSpeechRecognition({
    onResult: (text) => console.log('Transcribed:', text),
  });
  const { speak } = useSpeechSynthesis();

  return (
    <div>
      <button onClick={toggleListening}>{isListening ? 'Stop' : 'Voice Input'}</button>
      <button onClick={() => speak('msg-1', 'Workout complete!')}>Read Aloud</button>
      <button onClick={playChime}>Play Chime</button>
    </div>
  );
}
```

### PDF Report (`/pdf`)

```typescript
import { buildReportPdf } from '@jashan-randhawa/fitness-utils/pdf';

await buildReportPdf({
  user: { username: 'Alex', weight: 75, height: 180 },
  foodLogs: [...],
  activityLogs: [...],
  streak: 14,
});
```

## License

MIT © Jashan Randhawa

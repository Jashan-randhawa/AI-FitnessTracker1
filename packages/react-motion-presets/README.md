# @jashan-randhawa/react-motion-presets

A collection of lightweight Framer Motion animation presets: stagger list variants, rolling number counters, AI streaming text reveal, and collapsible card components with full reduced-motion accessibility support.

## Features

- ⚡ **Orchestrated Stagger Variants**: Pre-tuned container and item springs (`staggerContainer`, `staggerFast`, `staggerItem`, `slideLeft`, `slideRight`, `scaleUp`).
- 🔢 **AnimatedNumber**: Smooth rolling count-up or count-down number animations for stats and dashboards.
- 💬 **StreamingWordReveal**: Typewriter/word-streaming reveal animation tailored for LLM chat responses.
- 📦 **CollapsibleCard**: Animated accordion-style expandable container with rotating chevron.
- ♿ **Accessibility First**: Respects system `prefers-reduced-motion` settings.

## Installation

```bash
npm install @jashan-randhawa/react-motion-presets framer-motion
```

## Quick Start

### Stagger Variants

```tsx
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@jashan-randhawa/react-motion-presets';

export function List({ items }: { items: string[] }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show">
      {items.map((item) => (
        <motion.div key={item} variants={staggerItem}>
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Animated Counter

```tsx
import { AnimatedNumber } from '@jashan-randhawa/react-motion-presets';

<AnimatedNumber value={2450} formatThousands={true} duration={0.8} />
```

### AI Streaming Word Reveal

```tsx
import { StreamingWordReveal } from '@jashan-randhawa/react-motion-presets';

<StreamingWordReveal text="**FitBot**: Here is your 3-day split routine." staggerDelay={0.03} />
```

### Collapsible Card

```tsx
import { CollapsibleCard } from '@jashan-randhawa/react-motion-presets';

<CollapsibleCard title="Workout Routine" subtitle="Leg day" defaultOpen={true}>
  <p>Squats, Lunges, Calf Raises</p>
</CollapsibleCard>
```

## License

MIT © Jashan Randhawa

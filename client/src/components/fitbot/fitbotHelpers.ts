// Shared helpers for the FitBot chat UI (extracted from AIAssistant).
export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}

export interface SpeechRecognitionErrorLike {
  error: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((err: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ── Helper to parse workout routine markdown into structured days ─────────
export const parseMarkdownIntoWorkoutDays = (markdown: string) => {
  const lines = markdown.split("\n");
  const days: Array<{ day: string; focus: string; duration: string; exercises: unknown[] }> = [];
  let currentDay: { day: string; focus: string; duration: string; exercises: unknown[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const dayMatch = trimmed.match(
      /^(?:#+\s*|\*\*)?(Day\s*\d+[^:*]*|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:[:*#\s-]*)(.*)/i
    );
    if (dayMatch) {
      if (currentDay) {
        days.push(currentDay);
      }
      currentDay = {
        day: dayMatch[1].replace(/[*#]/g, "").trim(),
        focus: dayMatch[2] ? dayMatch[2].replace(/[*#]/g, "").trim() : "Workout & Conditioning",
        duration: "45 min",
        exercises: [],
      };
    } else if (
      currentDay &&
      (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed))
    ) {
      const exerciseText = trimmed.replace(/^[-*]|\d+\.\s*/, "").replace(/[*_]/g, "").trim();
      if (exerciseText) {
        currentDay.exercises.push({ name: exerciseText, sets: "3", reps: "10-12" });
      }
    }
  }
  if (currentDay) {
    days.push(currentDay);
  }

  if (days.length === 0) {
    days.push({
      day: "Day 1",
      focus: "Full Body Workout",
      duration: "45 min",
      exercises: [{ name: "Routine as specified in chat", sets: "3", reps: "10" }],
    });
  }

  return days;
};



export const QUICK_ACTIONS = [
  { label: "🥗 Meal Ideas", prompt: "Suggest healthy meal ideas based on my daily calories remaining" },
  { label: "💪 20-min Workout", prompt: "Give me a quick 20-minute home workout with warm-up" },
  { label: "📊 Analyze Today", prompt: "Analyze my calories and activity logs today and give feedback" },
  { label: "💧 Hydration Check", prompt: "How much water should I drink today based on my workouts?" },
  { label: "🎯 Goal Progress", prompt: "Review my fitness goal and recommend the next milestone" },
];

export const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// ── Web Audio API Subtle Chime ─────────────────────────────
export const playCompletionChime = () => {
  try {
    const winAudio = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = winAudio.AudioContext || winAudio.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.035, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Second note: B5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    gain2.gain.setValueAtTime(0.035, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.24);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
};




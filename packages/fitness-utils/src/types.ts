export type BmiCategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese';

export interface MacroPercentages {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
}

export interface CSVExportOptions {
  filename?: string;
  download?: boolean;
}

export interface SpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: unknown) => void;
  continuous?: boolean;
  lang?: string;
}

export interface SpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
  onEnd?: () => void;
}

export interface ChimeOptions {
  frequency1?: number; // Hz (default 659.25 - E5)
  frequency2?: number; // Hz (default 987.77 - B5)
  gain?: number; // volume 0..1 (default 0.035)
}

export interface FitnessReportData {
  user: {
    username?: string;
    email?: string;
    weight?: number;
    height?: number;
    fitnessgoal?: string;
    dailycaloriesintake?: number;
    dailycaloriesburned?: number;
  };
  foodLogs: any[];
  activityLogs: any[];
  streak?: number;
  earnedBadges?: any[];
}

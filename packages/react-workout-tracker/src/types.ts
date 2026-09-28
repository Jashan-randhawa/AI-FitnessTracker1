export interface SetData {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Exercise {
  id?: string;
  name: string;
  defaultWeight?: number;
  defaultReps?: number;
  sets?: SetData[];
}

export interface WorkoutSessionSummary {
  exercise: string;
  sets: SetData[];
  totalCompletedSets: number;
  totalVolumeKg: number;
  durationSeconds?: number;
}

export interface UseWorkoutSessionOptions {
  initialExercise?: string;
  initialSets?: SetData[];
  defaultWeight?: number;
  defaultReps?: number;
  onAllCompleted?: (summary: WorkoutSessionSummary) => void;
}

export interface WorkoutSetRowProps {
  set: SetData;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, fields: Partial<Pick<SetData, 'reps' | 'weight'>>) => void;
}

export interface RestCountdownTimerProps {
  initialSeconds?: number;
  onFinish?: () => void;
  className?: string;
  autoStart?: boolean;
}

export interface WorkoutTrackerProps {
  exercises?: Exercise[] | string;
  defaultExercise?: string;
  restSeconds?: number;
  onFinish?: (session: WorkoutSessionSummary) => void;
  onClose?: () => void;
  celebrate?: boolean;
}

export interface LiveWorkoutTrackerModalProps {
  onClose: () => void;
  defaultExercise?: string;
}

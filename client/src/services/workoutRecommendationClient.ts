import api from '../configs/api';

export interface ExerciseRecommendation {
  exercise: string;
  isLowerBody: boolean;
  estimated1RM: number;
  rolling7DayTonnage: number;
  lastSession: {
    date: string;
    workingWeight: number;
    reps: number;
    avgRpe: number;
    maxRpe: number;
    volume: number;
    hasMissedReps: boolean;
  } | null;
  recommendation: {
    status: 'overload' | 'deload' | 'maintain' | 'baseline';
    targetWeight: number;
    targetReps: number;
    increment: number;
    chip: string;
    reason: string;
  };
}

export interface RecoveryMetrics {
  totalActualCalories: number;
  totalTargetCalories: number;
  rollingCaloricBalance: number;
  dailyDeficitAvg: number;
  steepDeficitDays: number;
  isSteepDeficit: boolean;
  actualProtein: number;
  targetProtein: number;
  proteinAdherence: number;
  recoveryStatus: 'optimal' | 'adequate' | 'impaired';
}

export interface WorkoutRecommendationsResponse {
  success: boolean;
  recovery: RecoveryMetrics;
  recommendations: ExerciseRecommendation[];
}

/**
 * Fetches progressive overload and recovery recommendations for either a specific
 * exercise or the user's active routine.
 */
export const fetchWorkoutRecommendations = async (
  exercise?: string
): Promise<WorkoutRecommendationsResponse> => {
  const params: Record<string, string> = {};
  if (exercise) params.exercise = exercise;

  const res = await api.get<WorkoutRecommendationsResponse>('/api/workouts/recommendations', {
    params,
  });

  return res.data;
};

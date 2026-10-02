export type Category = "all" | "strength" | "cardio" | "yoga" | "hiit" | "mobility";

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  videoId: string;
}

export interface Playlist {
  id: string;
  title: string;
  channel: string;
  category: Category;
  level: "beginner" | "intermediate" | "advanced" | "all levels";
  description: string;
  videoCount: number;
  emoji: string;
  youtubePlaylistId: string;
  thumbnailColor: string;
  searchQuery: string;
}

export interface PunjabiPlaylist {
  id: string;
  title: string;
  artist: string;
  mood: "hype" | "warm-up" | "cool-down" | "pump";
  description: string;
  emoji: string;
  searchQuery: string;
  thumbnailColor: string;
  bpm: string;
  tags: string[];
}

export interface WorkoutSetData {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  rpe?: number;
}

export interface ExerciseEntry {
  name: string;
  sets: number;
  reps?: string | number;
  weight?: string | number;
  notes?: string;
  completedSets?: WorkoutSetData[];
}

export interface WorkoutDayPlan {
  day: string;
  focus: string;
  duration?: string;
  exercises: (string | ExerciseEntry)[];
}

export interface WorkoutPlan {
  _id?: string;
  id?: string;
  userId?: string;
  title: string;
  goal?: string;
  level?: string;
  daysPerWeek?: number;
  split?: string;
  days: WorkoutDayPlan[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

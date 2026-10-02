import type { Category, Playlist, PunjabiPlaylist } from "../types";

export const PLAYLISTS: Playlist[] = [
  { id: "1", title: "Beginner Full Body Strength", channel: "Heather Robertson", category: "strength", level: "beginner", description: "Complete beginner-friendly strength workouts targeting every muscle group with dumbbells.", videoCount: 12, emoji: "🏋️", youtubePlaylistId: "PLt4lS6MZ6JJoFQvfp2RlqDzOFGDJWbm4X", thumbnailColor: "from-rose-500 to-orange-500", searchQuery: "beginner full body strength workout Heather Robertson" },
  { id: "2", title: "30-Day HIIT Challenge", channel: "Sydney Cummings", category: "hiit", level: "intermediate", description: "High-intensity interval training to torch calories and boost your metabolism in 20–30 minutes.", videoCount: 30, emoji: "🔥", youtubePlaylistId: "PLBe8zisRehFz7TF1LBXiqnqxeqQBjm_lS", thumbnailColor: "from-orange-500 to-yellow-500", searchQuery: "30 day HIIT challenge Sydney Cummings" },
  { id: "3", title: "Yoga for Beginners", channel: "Yoga with Adriene", category: "yoga", level: "beginner", description: "Gentle yoga flows for beginners to build flexibility, balance, and mindfulness.", videoCount: 20, emoji: "🧘", youtubePlaylistId: "PLui6Eyny-UzwxbWCWDbTzEwsZnnROBTIL", thumbnailColor: "from-purple-500 to-pink-500", searchQuery: "yoga for beginners Adriene" },
  { id: "4", title: "Cardio Dance Workouts", channel: "POPSUGAR Fitness", category: "cardio", level: "all levels", description: "Fun, high-energy dance cardio sessions that don't feel like a workout.", videoCount: 15, emoji: "💃", youtubePlaylistId: "PLYIBhSL8kELKdUUMkPo93VQKfgBZxlx42", thumbnailColor: "from-pink-500 to-rose-500", searchQuery: "cardio dance workout POPSUGAR" },
  { id: "5", title: "Advanced Strength & Conditioning", channel: "Marcus Filly", category: "strength", level: "advanced", description: "Functional bodybuilding and conditioning for experienced lifters who want to push harder.", videoCount: 18, emoji: "💪", youtubePlaylistId: "PL0eyrZgxdwhxNGMWROCAX26d2G6RWnWLw", thumbnailColor: "from-blue-600 to-indigo-600", searchQuery: "advanced strength conditioning Marcus Filly" },
  { id: "6", title: "Morning Mobility Routine", channel: "Tom Merrick", category: "mobility", level: "all levels", description: "Daily morning stretches and mobility flows to start your day feeling loose and energised.", videoCount: 10, emoji: "🌅", youtubePlaylistId: "PLfMfAebXlJ4GDmW7yHFpyGeDBd1JFz3oF", thumbnailColor: "from-teal-500 to-emerald-500", searchQuery: "morning mobility routine Tom Merrick" },
  { id: "7", title: "No-Equipment HIIT", channel: "MadFit", category: "hiit", level: "beginner", description: "Bodyweight HIIT sessions you can do anywhere — no gym, no equipment needed.", videoCount: 25, emoji: "⚡", youtubePlaylistId: "PLNFHkl7MCHjG75y0gO78y1E7Bp8AXUOLH", thumbnailColor: "from-yellow-500 to-orange-500", searchQuery: "no equipment HIIT workout MadFit" },
  { id: "8", title: "Vinyasa Yoga Flow", channel: "Yoga with Bird", category: "yoga", level: "intermediate", description: "Dynamic vinyasa flows that build strength and flexibility simultaneously.", videoCount: 14, emoji: "🌊", youtubePlaylistId: "PLui6Eyny-UzxHhBhQnFjFlST7h5-HqF23", thumbnailColor: "from-violet-500 to-purple-600", searchQuery: "vinyasa yoga flow intermediate" },
  { id: "9", title: "Running for Beginners", channel: "The Run Experience", category: "cardio", level: "beginner", description: "Step-by-step running plans and technique tutorials to go from couch to 5K.", videoCount: 16, emoji: "🏃", youtubePlaylistId: "PLrkBMnXkCHmQhHsxe1VGPV6vHCUBF83GE", thumbnailColor: "from-emerald-500 to-green-600", searchQuery: "running for beginners couch to 5k" },
  { id: "10", title: "Full Body Stretch & Recovery", channel: "Blogilates", category: "mobility", level: "all levels", description: "Restorative stretching and foam rolling routines for faster muscle recovery.", videoCount: 8, emoji: "🛌", youtubePlaylistId: "PL4RzC6-RO50-ILpg3ioGZxCEQl0fkf_lP", thumbnailColor: "from-sky-400 to-blue-500", searchQuery: "full body stretch recovery Blogilates" },
  { id: "11", title: "Intermediate HIIT & Strength", channel: "Heather Robertson", category: "hiit", level: "intermediate", description: "Challenging combination of HIIT and strength training for intermediate fitness levels.", videoCount: 20, emoji: "🎯", youtubePlaylistId: "PLt4lS6MZ6JJoiSRS7Ow1xfYRHaYGh4OzI", thumbnailColor: "from-red-500 to-rose-600", searchQuery: "HIIT strength workout intermediate Heather Robertson" },
  { id: "12", title: "Cycling & Indoor Cardio", channel: "Global Cycling Network", category: "cardio", level: "intermediate", description: "Indoor cycling workouts and cardio drills to build endurance and leg power.", videoCount: 22, emoji: "🚴", youtubePlaylistId: "PLUkQFGUbQLFzjPmU5n8gUHYbJcOjkBflS", thumbnailColor: "from-cyan-500 to-blue-500", searchQuery: "indoor cycling cardio workout GCN" },
];

export const PUNJABI_PLAYLISTS: PunjabiPlaylist[] = [
  { id: "p1", title: "Bhangra Pump Up", artist: "Diljit Dosanjh & AP Dhillon", mood: "pump", description: "High-energy Bhangra beats to power through your hardest sets. Maximum intensity guaranteed.", emoji: "🔥", searchQuery: "Diljit Dosanjh bhangra workout gym", thumbnailColor: "from-orange-500 to-red-600", bpm: "140–160 BPM", tags: ["bhangra", "high energy", "gym"] },
  { id: "p2", title: "AP Dhillon Hits", artist: "AP Dhillon", mood: "hype", description: "Smooth yet powerful AP Dhillon tracks — perfect for steady-state cardio and endurance runs.", emoji: "💜", searchQuery: "AP Dhillon workout motivation 2024", thumbnailColor: "from-violet-600 to-purple-700", bpm: "120–135 BPM", tags: ["modern", "cardio", "run"] },
  { id: "p3", title: "Warm-Up Vibes", artist: "Sidhu Moosewala Tribute", mood: "warm-up", description: "Melodic Punjabi tracks to get your blood flowing and your mind in the zone before the session.", emoji: "🌅", searchQuery: "Sidhu Moosewala best songs workout", thumbnailColor: "from-amber-400 to-orange-500", bpm: "95–115 BPM", tags: ["warm-up", "melodic", "legend"] },
  { id: "p4", title: "HIIT Bhangra", artist: "Guru Randhawa & Badshah", mood: "hype", description: "Explosive Punjabi pop and bhangra mashups timed perfectly for HIIT intervals and sprints.", emoji: "⚡", searchQuery: "Guru Randhawa Badshah gym HIIT playlist", thumbnailColor: "from-yellow-500 to-orange-600", bpm: "145–165 BPM", tags: ["HIIT", "pop", "intervals"] },
  { id: "p5", title: "Cool-Down Ragas", artist: "Satinder Sartaaj", mood: "cool-down", description: "Soul-soothing Punjabi classical and folk melodies for your post-workout stretch and recovery.", emoji: "🧘", searchQuery: "Satinder Sartaaj relaxing Punjabi songs", thumbnailColor: "from-teal-500 to-cyan-600", bpm: "60–85 BPM", tags: ["cool-down", "folk", "recovery"] },
  { id: "p6", title: "Street Hustle Mix", artist: "Karan Aujla & Shubh", mood: "pump", description: "Raw, gritty Punjabi rap tracks that hit hard — ideal for heavy lifting and strength days.", emoji: "💪", searchQuery: "Karan Aujla Shubh gym rap workout 2024", thumbnailColor: "from-slate-700 to-slate-900", bpm: "130–155 BPM", tags: ["rap", "strength", "lifting"] },
];

export const PUNJABI_MOODS: { key: PunjabiPlaylist["mood"] | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "🎵" },
  { key: "pump", label: "Pump Up", emoji: "🔥" },
  { key: "hype", label: "Hype", emoji: "⚡" },
  { key: "warm-up", label: "Warm-Up", emoji: "🌅" },
  { key: "cool-down", label: "Cool-Down", emoji: "🧘" },
];

export const MOOD_BADGE: Record<string, string> = {
  pump: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40",
  hype: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40",
  "warm-up": "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  "cool-down": "bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40",
};

export const CATEGORIES: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "✨" },
  { key: "strength", label: "Strength", emoji: "🏋️" },
  { key: "cardio", label: "Cardio", emoji: "🏃" },
  { key: "hiit", label: "HIIT", emoji: "🔥" },
  { key: "yoga", label: "Yoga", emoji: "🧘" },
  { key: "mobility", label: "Mobility", emoji: "🌅" },
];

export const LEVELS = ["all levels", "beginner", "intermediate", "advanced"] as const;

export const LEVEL_BADGE: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  intermediate: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  advanced: "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40",
  "all levels": "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40",
};

export const FEATURED_IMAGES: Record<Category, string> = {
  all: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  strength: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
  cardio: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1200&q=80",
  yoga: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  hiit: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1200&q=80",
  mobility: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
};

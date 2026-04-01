import { useState } from "react";
import { useTheme } from "../Context/Themecontext";

// ── Types ──────────────────────────────────────────────────
type Category = "all" | "strength" | "cardio" | "yoga" | "hiit" | "mobility";

interface Playlist {
  id: string;
  title: string;
  channel: string;
  category: Category;
  level: "beginner" | "intermediate" | "advanced" | "all levels";
  description: string;
  videoCount: number;
  emoji: string;
  youtubePlaylistId: string; // YouTube playlist ID for embed
  thumbnailColor: string;    // fallback gradient color
}

// ── Curated Free YouTube Playlists ────────────────────────
// All playlists are from free, public YouTube channels
const PLAYLISTS: Playlist[] = [
  {
    id: "1",
    title: "Beginner Full Body Strength",
    channel: "Heather Robertson",
    category: "strength",
    level: "beginner",
    description: "Complete beginner-friendly strength workouts targeting every muscle group with dumbbells.",
    videoCount: 12,
    emoji: "🏋️",
    youtubePlaylistId: "PLt4lS6MZ6JJoFQvfp2RlqDzOFGDJWbm4X",
    thumbnailColor: "from-rose-500 to-orange-500",
  },
  {
    id: "2",
    title: "30-Day HIIT Challenge",
    channel: "Sydney Cummings Houdyshell",
    category: "hiit",
    level: "intermediate",
    description: "High-intensity interval training to torch calories and boost your metabolism in 20–30 minutes.",
    videoCount: 30,
    emoji: "🔥",
    youtubePlaylistId: "PLBe8zisRehFz7TF1LBXiqnqxeqQBjm_lS",
    thumbnailColor: "from-orange-500 to-yellow-500",
  },
  {
    id: "3",
    title: "Yoga for Beginners",
    channel: "Yoga with Adriene",
    category: "yoga",
    level: "beginner",
    description: "Gentle yoga flows for beginners to build flexibility, balance, and mindfulness.",
    videoCount: 20,
    emoji: "🧘",
    youtubePlaylistId: "PLui6Eyny-UzwxbWCWDbTzEwsZnnROBTIL",
    thumbnailColor: "from-purple-500 to-pink-500",
  },
  {
    id: "4",
    title: "Cardio Dance Workouts",
    channel: "POPSUGAR Fitness",
    category: "cardio",
    level: "all levels",
    description: "Fun, high-energy dance cardio sessions that don't feel like a workout.",
    videoCount: 15,
    emoji: "💃",
    youtubePlaylistId: "PLYIBhSL8kELKdUUMkPo93VQKfgBZxlx42",
    thumbnailColor: "from-pink-500 to-rose-500",
  },
  {
    id: "5",
    title: "Advanced Strength & Conditioning",
    channel: "Marcus Filly",
    category: "strength",
    level: "advanced",
    description: "Functional bodybuilding and conditioning for experienced lifters who want to push harder.",
    videoCount: 18,
    emoji: "💪",
    youtubePlaylistId: "PL0eyrZgxdwhxNGMWROCAX26d2G6RWnWLw",
    thumbnailColor: "from-blue-600 to-indigo-600",
  },
  {
    id: "6",
    title: "Morning Mobility Routine",
    channel: "Tom Merrick",
    category: "mobility",
    level: "all levels",
    description: "Daily morning stretches and mobility flows to start your day feeling loose and energised.",
    videoCount: 10,
    emoji: "🌅",
    youtubePlaylistId: "PLfMfAebXlJ4GDmW7yHFpyGeDBd1JFz3oF",
    thumbnailColor: "from-teal-500 to-emerald-500",
  },
  {
    id: "7",
    title: "No-Equipment HIIT",
    channel: "MadFit",
    category: "hiit",
    level: "beginner",
    description: "Bodyweight HIIT sessions you can do anywhere — no gym, no equipment needed.",
    videoCount: 25,
    emoji: "⚡",
    youtubePlaylistId: "PLNFHkl7MCHjG75y0gO78y1E7Bp8AXUOLH",
    thumbnailColor: "from-yellow-500 to-orange-500",
  },
  {
    id: "8",
    title: "Vinyasa Yoga Flow",
    channel: "Yoga with Bird",
    category: "yoga",
    level: "intermediate",
    description: "Dynamic vinyasa flows that build strength and flexibility simultaneously.",
    videoCount: 14,
    emoji: "🌊",
    youtubePlaylistId: "PLui6Eyny-UzxHhBhQnFjFlST7h5-HqF23",
    thumbnailColor: "from-violet-500 to-purple-600",
  },
  {
    id: "9",
    title: "Running for Beginners",
    channel: "The Run Experience",
    category: "cardio",
    level: "beginner",
    description: "Step-by-step running plans and technique tutorials to go from couch to 5K.",
    videoCount: 16,
    emoji: "🏃",
    youtubePlaylistId: "PLrkBMnXkCHmQhHsxe1VGPV6vHCUBF83GE",
    thumbnailColor: "from-emerald-500 to-green-600",
  },
  {
    id: "10",
    title: "Full Body Stretch & Recovery",
    channel: "Blogilates",
    category: "mobility",
    level: "all levels",
    description: "Restorative stretching and foam rolling routines for faster muscle recovery.",
    videoCount: 8,
    emoji: "🛌",
    youtubePlaylistId: "PL4RzC6-RO50-ILpg3ioGZxCEQl0fkf_lP",
    thumbnailColor: "from-sky-400 to-blue-500",
  },
  {
    id: "11",
    title: "Intermediate HIIT & Strength",
    channel: "Heather Robertson",
    category: "hiit",
    level: "intermediate",
    description: "Challenging combination of HIIT and strength training for intermediate fitness levels.",
    videoCount: 20,
    emoji: "🎯",
    youtubePlaylistId: "PLt4lS6MZ6JJoiSRS7Ow1xfYRHaYGh4OzI",
    thumbnailColor: "from-red-500 to-rose-600",
  },
  {
    id: "12",
    title: "Cycling & Indoor Cardio",
    channel: "Global Cycling Network",
    category: "cardio",
    level: "intermediate",
    description: "Indoor cycling workouts and cardio drills to build endurance and leg power.",
    videoCount: 22,
    emoji: "🚴",
    youtubePlaylistId: "PLUkQFGUbQLFzjPmU5n8gUHYbJcOjkBflS",
    thumbnailColor: "from-cyan-500 to-blue-500",
  },
];

const CATEGORIES: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all",       label: "All",       emoji: "✨" },
  { key: "strength",  label: "Strength",  emoji: "🏋️" },
  { key: "cardio",    label: "Cardio",    emoji: "🏃" },
  { key: "hiit",      label: "HIIT",      emoji: "🔥" },
  { key: "yoga",      label: "Yoga",      emoji: "🧘" },
  { key: "mobility",  label: "Mobility",  emoji: "🌅" },
];

const LEVELS = ["all levels", "beginner", "intermediate", "advanced"] as const;

const LEVEL_STYLE: Record<string, string> = {
  beginner:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced:     "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "all levels": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

// ── Video Player Modal ─────────────────────────────────────
const VideoModal = ({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) => {
  // Search URL — opens YouTube playlist in embedded search
  const embedUrl = `https://www.youtube.com/embed?listType=playlist&list=${playlist.youtubePlaylistId}&rel=0&modestbranding=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{playlist.emoji}</span>
              <h2 className="text-lg font-bold text-white truncate">{playlist.title}</h2>
            </div>
            <p className="text-sm text-slate-400">{playlist.channel} · {playlist.videoCount} videos</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Embedded YouTube Playlist */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={embedUrl}
            title={playlist.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between bg-slate-800/60">
          <p className="text-xs text-slate-500">{playlist.description}</p>
          <a
            href={`https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 ml-4 flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
            Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
};

// ── Playlist Card ──────────────────────────────────────────
const PlaylistCard = ({
  playlist,
  onPlay,
}: {
  playlist: Playlist;
  onPlay: () => void;
}) => (
  <button
    onClick={onPlay}
    className="group text-left w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
  >
    {/* Thumbnail */}
    <div className={`relative h-36 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
      <span className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-300">
        {playlist.emoji}
      </span>
      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" className="ml-1">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
      {/* Video count badge */}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
        {playlist.videoCount} videos
      </div>
    </div>

    {/* Info */}
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2">
          {playlist.title}
        </h3>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_STYLE[playlist.level]}`}>
          {playlist.level}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{playlist.description}</p>
      <div className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-500 shrink-0">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
        </svg>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{playlist.channel}</span>
      </div>
    </div>
  </button>
);

// ── Main Page ──────────────────────────────────────────────
export default function Workouts() {
  const { theme, toggleTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [activeLevel, setActiveLevel] = useState<string>("all levels");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const filtered = PLAYLISTS.filter((p) => {
    const matchCat   = activeCategory === "all" || p.category === activeCategory;
    const matchLevel = activeLevel === "all levels" || p.level === activeLevel || p.level === "all levels";
    const matchSearch = !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.channel.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchLevel && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
      {selectedPlaylist && (
        <VideoModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
      )}

      {/* ── Header ── */}
      <div className="px-6 pt-10 pb-6 max-w-6xl mx-auto flex items-start justify-between border-b border-slate-200 dark:border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workout Videos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Curated free fitness playlists from top YouTube creators</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Playlists</p>
            <p className="text-2xl font-bold text-emerald-400">{filtered.length}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-2 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search playlists or channels…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as Category | "all")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeCategory === key
                  ? "bg-emerald-500 text-black border-emerald-500"
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span>{emoji}</span>{label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer capitalize ${
                activeLevel === level
                  ? `${LEVEL_STYLE[level]} font-semibold`
                  : "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-6xl mx-auto px-6 pb-10 mt-4">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPlay={() => setSelectedPlaylist(playlist)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-slate-100 dark:bg-slate-700/60">🎬</div>
            <p className="text-slate-400 font-semibold">No playlists found</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search term</p>
            <button
              onClick={() => { setActiveCategory("all"); setActiveLevel("all levels"); setSearch(""); }}
              className="mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-500 text-black hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../Context/Themecontext";

// ── Types ──────────────────────────────────────────────────
type Category = "all" | "strength" | "cardio" | "yoga" | "hiit" | "mobility";

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  videoId: string;
}

interface Playlist {
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

// ── ENV ────────────────────────────────────────────────────
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || "";

// ── Curated Playlists ──────────────────────────────────────
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
    searchQuery: "beginner full body strength workout Heather Robertson",
  },
  {
    id: "2",
    title: "30-Day HIIT Challenge",
    channel: "Sydney Cummings",
    category: "hiit",
    level: "intermediate",
    description: "High-intensity interval training to torch calories and boost your metabolism in 20–30 minutes.",
    videoCount: 30,
    emoji: "🔥",
    youtubePlaylistId: "PLBe8zisRehFz7TF1LBXiqnqxeqQBjm_lS",
    thumbnailColor: "from-orange-500 to-yellow-500",
    searchQuery: "30 day HIIT challenge Sydney Cummings",
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
    searchQuery: "yoga for beginners Adriene",
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
    searchQuery: "cardio dance workout POPSUGAR",
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
    searchQuery: "advanced strength conditioning Marcus Filly",
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
    searchQuery: "morning mobility routine Tom Merrick",
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
    searchQuery: "no equipment HIIT workout MadFit",
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
    searchQuery: "vinyasa yoga flow intermediate",
  },
];

const CATEGORIES: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all",      label: "All",      emoji: "✨" },
  { key: "strength", label: "Strength", emoji: "🏋️" },
  { key: "cardio",   label: "Cardio",   emoji: "🏃" },
  { key: "hiit",     label: "HIIT",     emoji: "🔥" },
  { key: "yoga",     label: "Yoga",     emoji: "🧘" },
  { key: "mobility", label: "Mobility", emoji: "🌅" },
];

const LEVEL_BADGE: Record<string, string> = {
  beginner:     "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  intermediate: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  advanced:     "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40",
  "all levels": "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40",
};

// ── RapidAPI YouTube Search Hook ───────────────────────────
function useYouTubeSearch(query: string, enabled: boolean) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !query || !RAPIDAPI_KEY) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    fetch(
      `https://youtube138.p.rapidapi.com/search/?q=${encodeURIComponent(query)}&hl=en&gl=US`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": "youtube138.p.rapidapi.com",
        },
        signal: controller.signal,
      }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const items: YouTubeVideo[] = (data.contents || [])
          .filter((item: any) => item.type === "video" && item.video)
          .slice(0, 8)
          .map((item: any) => ({
            id: item.video.videoId,
            videoId: item.video.videoId,
            title: item.video.title,
            channel: item.video.author?.title || "Unknown",
            thumbnail:
              item.video.thumbnails?.[item.video.thumbnails.length - 1]?.url ||
              `https://i.ytimg.com/vi/${item.video.videoId}/hqdefault.jpg`,
            duration: item.video.lengthText || "",
            viewCount: item.video.stats?.views ? formatViews(item.video.stats.views) : "",
            publishedAt: item.video.publishedTimeText || "",
          }));
        setVideos(items);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, enabled]);

  return { videos, loading, error };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

// ── Animated Background ────────────────────────────────────
const AnimatedBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[100px]"
    />
    <motion.div
      animate={{ scale: [1, 1.5, 1], x: [0, 50, 0], y: [0, 30, 0] }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/3 -left-20 w-80 h-80 bg-violet-500/10 dark:bg-violet-500/10 rounded-full blur-[100px]"
    />
    <motion.div
      animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, -50, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-20 right-1/4 w-64 h-64 bg-rose-500/10 dark:bg-rose-500/10 rounded-full blur-[100px]"
    />
  </div>
);

// ── Video Player Modal ─────────────────────────────────────
const VideoPlayerModal = ({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void; }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
    <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700/60">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="relative" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  </div>
);

// ── Playlist Modal ─────────────────────────────────────────
const PlaylistModal = ({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) => {
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string } | null>(null);
  const hasKey = Boolean(RAPIDAPI_KEY);
  const { videos, loading, error } = useYouTubeSearch(playlist.searchQuery, hasKey);
  const ytUrl = `https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}`;

  return (
    <>
      {playingVideo && (
        <VideoPlayerModal
          videoId={playingVideo.id}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}
      
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-slate-700/60 flex flex-col"
          >
            {/* Header */}
            <div className={`relative h-48 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-between px-8 shrink-0 overflow-hidden`}>
              <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
              <div className="relative z-10">
                <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-full mb-3 backdrop-blur-md bg-black/20 text-white border border-white/20 uppercase tracking-wider`}>
                  {playlist.level}
                </span>
                <h2 className="text-3xl font-black text-white leading-tight drop-shadow-md">{playlist.title}</h2>
                <p className="text-white/80 text-sm mt-1 font-medium">{playlist.channel}</p>
              </div>
              <motion.span 
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="text-8xl opacity-80 z-10 drop-shadow-2xl"
              >
                {playlist.emoji}
              </motion.span>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors z-20"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{playlist.description}</p>
              
              <div className="flex gap-3">
                {[ { label: `${playlist.videoCount} Videos`, icon: "▶" }, { label: playlist.category, icon: "🏷" } ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <span className="opacity-60">{s.icon}</span>
                    <span className="capitalize">{s.label}</span>
                  </div>
                ))}
              </div>

              {hasKey ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Results · YouTube</h3>
                  {loading ? (
                      <div className="flex gap-2 justify-center py-8">
                        {[0, 1, 2].map((i) => (
                          <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} className="w-2 h-2 bg-emerald-500 rounded-full" />
                        ))}
                      </div>
                  ) : error ? (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">{error}</div>
                  ) : (
                    <motion.div variants={{ show: { transition: { staggerChildren: 0.1 }}}} initial="hidden" animate="show" className="space-y-3">
                      {videos.map((v) => (
                        <motion.button
                          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 }}}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          key={v.id}
                          onClick={() => setPlayingVideo({ id: v.videoId, title: v.title })}
                          className="w-full flex gap-4 p-3 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all text-left group"
                        >
                          <div className="relative shrink-0 w-32 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800">
                            <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-emerald-500 transition-colors">{v.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{v.channel}</p>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold mb-2">🎬 Live video search disabled</p>
                  <p className="text-xs text-slate-500">Add your RapidAPI key to see real YouTube videos directly inside the app.</p>
                </div>
              )}

              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={ytUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-500/20"
              >
                Open Full Playlist on YouTube
              </motion.a>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </>
  );
};

// ── Playlist Card ──────────────────────────────────────────
const PlaylistCard = ({ playlist, onPlay }: { playlist: Playlist; onPlay: () => void }) => (
  <motion.button
    layout
    initial={{ opacity: 0, scale: 0.9, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: 20 }}
    whileHover={{ y: -8 }}
    transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
    onClick={onPlay}
    className="group text-left w-full rounded-3xl overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/40 dark:border-slate-700/50 shadow-lg hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300"
  >
    <div className={`relative h-44 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
      <motion.span 
        className="text-7xl opacity-90 group-hover:opacity-100 transition-all duration-500 z-10"
        whileHover={{ scale: 1.2, rotate: 5 }}
      >
        {playlist.emoji}
      </motion.span>

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center z-20">
        <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl translate-y-4 group-hover:translate-y-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#111" className="ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </div>
      </div>
      <div className="absolute top-3 left-3 z-10">
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide bg-white/90 dark:bg-black/50 backdrop-blur-md ${LEVEL_BADGE[playlist.level].split(' ')[1]}`}>
          {playlist.level}
        </span>
      </div>
      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg z-10">
        {playlist.videoCount} videos
      </div>
    </div>

    <div className="p-5">
      <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-2 group-hover:text-emerald-500 transition-colors">{playlist.title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">{playlist.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />{playlist.channel}</span>
      </div>
    </div>
  </motion.button>
);

// ── Search Bar ─────────────────────────────────────────────
const SearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative group max-w-md w-full">
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    <input type="text" placeholder="Search workouts, creators..." value={value} onChange={(e) => onChange(e.target.value)} className="w-full pl-12 pr-4 py-3.5 text-sm rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all backdrop-blur-xl shadow-sm" />
  </div>
);

// ── Main Page ──────────────────────────────────────────────
export default function Workouts() {
  const { theme, toggleTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const filtered = PLAYLISTS.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) || p.channel.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="relative min-h-screen bg-slate-50/50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-300 font-sans">
      <AnimatedBackground />

      {selectedPlaylist && <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />}

      <div className="relative z-10 px-4 sm:px-6 pt-12 pb-8 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl font-black tracking-tight"
            >
              Workout <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">Library</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-slate-500 dark:text-slate-400 mt-2 text-lg"
            >
              Find your perfect routine from top creators.
            </motion.p>
          </div>
          <SearchBar value={search} onChange={setSearch} />
        </motion.div>

        {/* ── Filters ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4 mb-10">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(({ key, label, emoji }) => (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                key={key}
                onClick={() => setActiveCategory(key as Category | "all")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                  activeCategory === key
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/50"
                }`}
              >
                <span>{emoji}</span> {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Grid ── */}
        <motion.div layout className="min-h-[50vh]">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} onPlay={() => setSelectedPlaylist(playlist)} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <div className="w-24 h-24 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center text-4xl mb-6">🤷‍♂️</div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">No workouts found</h3>
                <p className="text-slate-500 mt-2">Try adjusting your filters or search term.</p>
                <button
                  onClick={() => { setActiveCategory("all"); setSearch(""); }}
                  className="mt-6 px-6 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
                >
                  Clear Filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Floating Theme Toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl text-slate-600 dark:text-slate-300 z-50 cursor-pointer"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </motion.button>
    </div>
  );
}

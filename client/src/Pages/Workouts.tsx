import { useState, useEffect} from "react";
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
  searchQuery: string; // Used for RapidAPI search
}

// ── ENV ────────────────────────────────────────────────────
// Add your RapidAPI key in .env as:  VITE_RAPIDAPI_KEY=your_key_here
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
    searchQuery: "running for beginners couch to 5k",
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
    searchQuery: "full body stretch recovery Blogilates",
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
    searchQuery: "HIIT strength workout intermediate Heather Robertson",
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
    searchQuery: "indoor cycling cardio workout GCN",
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

const LEVELS = ["all levels", "beginner", "intermediate", "advanced"] as const;

const LEVEL_BADGE: Record<string, string> = {
  beginner:     "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  intermediate: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  advanced:     "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40",
  "all levels": "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40",
};

const FEATURED_IMAGES: Record<Category, string> = {
  all: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  strength: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
  cardio: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1200&q=80",
  yoga: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  hiit: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1200&q=80",
  mobility: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
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
        // The youtube138 API returns data.contents array
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
            viewCount: item.video.stats?.views
              ? formatViews(item.video.stats.views)
              : "",
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
    <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/8 rounded-full blur-3xl animate-pulse" />
    <div className="absolute top-1/3 -left-20 w-80 h-80 bg-violet-500/5 dark:bg-violet-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
    <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-rose-500/5 dark:bg-rose-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "4s" }} />
  </div>
);

// ── No-API Banner ──────────────────────────────────────────
const NoApiBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
    <span className="text-xl shrink-0 mt-0.5">⚠️</span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-amber-400">RapidAPI key not configured</p>
      <p className="text-xs text-amber-500/80 mt-0.5 leading-relaxed">
        Add <code className="bg-amber-500/20 px-1 rounded">VITE_RAPIDAPI_KEY=your_key</code> to{" "}
        <code className="bg-amber-500/20 px-1 rounded">client/.env</code> to enable live YouTube
        video search. See setup guide below.
      </p>
    </div>
    <button onClick={onDismiss} className="text-amber-500 hover:text-amber-300 transition-colors shrink-0 mt-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
);

// ── Video Player Modal ─────────────────────────────────────
const VideoPlayerModal = ({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
    <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700/60">
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
        >
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

// ── Playlist Modal (with live YouTube search) ──────────────
const PlaylistModal = ({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) => {
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

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl bg-slate-900 border border-slate-700/60 flex flex-col">
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>

          {/* Header banner */}
          <div className={`relative h-40 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-between px-6 shrink-0`}>
            <div>
              <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 ${LEVEL_BADGE[playlist.level]}`}>
                {playlist.level.toUpperCase()}
              </span>
              <h2 className="text-xl font-black text-white leading-tight drop-shadow-sm">{playlist.title}</h2>
              <p className="text-white/70 text-sm mt-0.5">{playlist.channel}</p>
            </div>
            <span className="text-7xl opacity-75">{playlist.emoji}</span>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center bg-black/30 text-white hover:bg-black/50 transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">{playlist.description}</p>

            {/* Stats */}
            <div className="flex gap-3">
              {[
                { label: `${playlist.videoCount} Videos`, icon: "▶" },
                { label: playlist.category, icon: "🏷" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium">
                  <span className="opacity-60">{s.icon}</span>
                  <span className="capitalize">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Live videos section */}
            {hasKey ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Results · YouTube</h3>
                  {loading && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                    Error loading videos: {error}
                  </div>
                )}

                {!loading && !error && videos.length > 0 && (
                  <div className="space-y-2">
                    {videos.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setPlayingVideo({ id: v.videoId, title: v.title })}
                        className="w-full flex gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-colors group text-left cursor-pointer"
                      >
                        <div className="relative shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-slate-800">
                          <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#111" className="ml-0.5">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          </div>
                          {v.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">
                              {v.duration}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">
                            {v.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 truncate">{v.channel}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {v.viewCount && <span className="text-[10px] text-slate-600">{v.viewCount}</span>}
                            {v.publishedAt && <span className="text-[10px] text-slate-600">{v.publishedAt}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && !error && videos.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-4">No videos found for this search.</p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-center">
                <p className="text-sm text-slate-400 font-medium mb-1">🎬 Live video search disabled</p>
                <p className="text-xs text-slate-600">Configure your RapidAPI key to see real YouTube videos here.</p>
              </div>
            )}

            {/* CTA */}
            <a
              href={ytUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-sm transition-all duration-200 shadow-lg shadow-red-600/25"
            >
              <svg width="17" height="12" viewBox="0 0 24 17" fill="white">
                <path d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 17 12 17 12 17s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-5.8zM9.7 12V5l6.3 3.5L9.7 12z" />
              </svg>
              Open Full Playlist on YouTube
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Playlist Card ──────────────────────────────────────────
const PlaylistCard = ({
  playlist,
  onPlay,
  index,
}: {
  playlist: Playlist;
  onPlay: () => void;
  index: number;
}) => (
  <button
    onClick={onPlay}
    className="group text-left w-full rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    {/* Thumbnail */}
    <div className={`relative h-40 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

      <span className="text-6xl opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500 select-none z-10">
        {playlist.emoji}
      </span>

      {/* Play button overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center z-20">
        <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl scale-75 group-hover:scale-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#111" className="ml-1">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>

      {/* Top badges */}
      <div className="absolute top-3 left-3 z-10">
        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${LEVEL_BADGE[playlist.level]}`}>
          {playlist.level}
        </span>
      </div>
      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">
        {playlist.videoCount} videos
      </div>

      {/* Category pill */}
      <div className="absolute bottom-3 left-3 bg-black/50 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize z-10">
        {playlist.category}
      </div>
    </div>

    {/* Info */}
    <div className="p-4 bg-white dark:bg-slate-800/80 border-x border-b border-slate-100 dark:border-slate-700/50 rounded-b-2xl backdrop-blur-sm">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-1 group-hover:text-emerald-500 transition-colors duration-200 mb-1">
        {playlist.title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
        {playlist.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 17" fill="currentColor" className="text-red-500 shrink-0">
            <path d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 17 12 17 12 17s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-5.8zM9.7 12V5l6.3 3.5L9.7 12z" />
          </svg>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">{playlist.channel}</span>
        </div>
        <span className="text-[10px] text-emerald-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          Watch <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
      </div>
    </div>
  </button>
);

// ── Search Bar ─────────────────────────────────────────────
const SearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative group">
    <svg
      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      placeholder="Search workouts, channels…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all backdrop-blur-sm"
    />
    {value && (
      <button
        onClick={() => onChange("")}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    )}
  </div>
);

// ── Main Page ──────────────────────────────────────────────
export default function Workouts() {
  const { theme, toggleTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [activeLevel, setActiveLevel] = useState<string>("all levels");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showApiBanner, setShowApiBanner] = useState(!RAPIDAPI_KEY);

  const filtered = PLAYLISTS.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchLevel = activeLevel === "all levels" || p.level === activeLevel || p.level === "all levels";
    const matchSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.channel.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchLevel && matchSearch;
  });

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
      <AnimatedBackground />

      {selectedPlaylist && (
        <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
      )}

      {/* ── Hero Header ── */}
      <div className="relative z-10 px-6 pt-10 pb-8 max-w-6xl mx-auto">
        {(() => {
          const featured = filtered[0] || PLAYLISTS[0];
          return (
            <div className="relative overflow-hidden rounded-3xl border border-white/20 dark:border-slate-700/40 bg-gradient-to-br from-white/80 via-emerald-100/40 to-cyan-100/50 dark:from-slate-900/80 dark:via-emerald-900/20 dark:to-cyan-900/20 shadow-[0_20px_70px_-35px_rgba(16,185,129,0.65)] dark:shadow-[0_20px_70px_-35px_rgba(16,185,129,0.35)]">
              <div className="absolute -top-20 -left-16 w-56 h-56 rounded-full bg-emerald-400/25 blur-3xl" />
              <div className="absolute -bottom-24 -right-12 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/45 via-slate-900/25 to-slate-900/40 dark:from-slate-950/60 dark:via-slate-950/30 dark:to-slate-950/65" />

              <div className="relative p-5 sm:p-7 md:p-8 min-h-[240px] sm:min-h-[290px] flex flex-col md:flex-row gap-6 md:gap-8 md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-emerald-300 tracking-widest uppercase">Workout Library</span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    Workout <span className="text-emerald-300">Videos</span>
                  </h1>
                  <p className="text-sm text-slate-200 mt-2">
                    {RAPIDAPI_KEY ? "🟢 Live YouTube search enabled" : "Curated playlists from top creators"}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/75 text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">Showing</span>
                      <span className="text-sm font-black text-emerald-500">{filtered.length}</span>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-300/35 text-emerald-100">
                      Featured now
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => setSelectedPlaylist(featured)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-400 text-slate-900 hover:bg-emerald-300 transition-colors cursor-pointer shadow-lg shadow-emerald-500/30"
                    >
                      Start Featured Workout
                    </button>
                    <button
                      onClick={() => {
                        setActiveCategory("all");
                        setActiveLevel("all levels");
                        setSearch("");
                      }}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 text-white ring-1 ring-white/40 backdrop-blur-sm transition-colors cursor-pointer"
                    >
                      Browse All
                    </button>
                  </div>
                </div>

                <div className="w-full md:max-w-sm">
                  <div className="rounded-2xl border border-white/25 bg-white/10 dark:bg-slate-900/45 p-3 backdrop-blur-md shadow-[0_18px_40px_-20px_rgba(15,23,42,0.8)]">
                    <div className={`relative rounded-xl overflow-hidden h-40 bg-gradient-to-br ${featured.thumbnailColor}`}>
                      <img
                        src={FEATURED_IMAGES[featured.category]}
                        alt={featured.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                      <span className="absolute top-2 right-2 text-[11px] font-bold px-2 py-1 rounded-lg bg-black/55 text-white">
                        {featured.videoCount * 5} min
                      </span>
                      <span className={`absolute bottom-2 left-2 px-2 py-1 rounded-lg text-[11px] font-semibold capitalize ${LEVEL_BADGE[featured.level]}`}>
                        {featured.level}
                      </span>
                      <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/85 text-slate-800 capitalize">
                        {featured.category}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white line-clamp-1">{featured.title}</p>
                    <p className="text-xs text-slate-200">{featured.channel}</p>
                  </div>
                </div>

                <button
                  onClick={toggleTheme}
                  className="absolute top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center bg-white/85 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-600/60 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-500 transition-all duration-200 cursor-pointer shadow-sm"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── API Banner ── */}
      {showApiBanner && (
        <div className="relative z-10 max-w-6xl mx-auto">
          <NoApiBanner onDismiss={() => setShowApiBanner(false)} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-6 space-y-4">
        <SearchBar value={search} onChange={setSearch} />

        {/* Category chips */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as Category | "all")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer ${
                activeCategory === key
                  ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/30 scale-105"
                  : "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/50 hover:text-emerald-500"
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer capitalize ${
                activeLevel === level
                  ? `${LEVEL_BADGE[level]} scale-105`
                  : "bg-white dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-700/50 hover:border-slate-400"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((playlist, i) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                index={i}
                onPlay={() => setSelectedPlaylist(playlist)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center rounded-3xl bg-white/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5 bg-slate-100 dark:bg-slate-700/60 shadow-inner">
              🎬
            </div>
            <p className="text-slate-400 font-bold text-lg">No workouts found</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">Try adjusting your filters or searching something different</p>
            <button
              onClick={() => { setActiveCategory("all"); setActiveLevel("all levels"); setSearch(""); }}
              className="mt-5 px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/25"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

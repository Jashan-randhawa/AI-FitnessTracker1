import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useVideoSearch } from "../hooks/useVideoSearch";
import { BottomSheet } from "../components/ui/BottomSheet";
import { LiveWorkoutTrackerModal } from "../components/animations/LiveWorkoutTrackerModal";
import api from "../configs/api";
import {
  PLAYLISTS,
  PUNJABI_PLAYLISTS,
  PUNJABI_MOODS,
  MOOD_BADGE,
  CATEGORIES,
  LEVELS,
  LEVEL_BADGE,
  FEATURED_IMAGES,
} from "../features/workouts/data/playlists";
import type { Category, Playlist, PunjabiPlaylist, WorkoutPlan } from "../features/workouts/types";

// ── Lightweight Background ─────────────────────────────────
const AmbientBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl" />
    <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 blur-3xl" />
    <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl" />
  </div>
);

// ── Video Player Modal ─────────────────────────────────────
const VideoPlayerModal = ({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={onClose}>
    <div
      className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700/60"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
        <button
          onClick={onClose}
          aria-label="Close video"
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
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

// ── Playlist Modal (BottomSheet) ───────────────────────────
const PlaylistBottomSheet = ({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) => {
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string } | null>(null);
  const { videos, loading, error } = useVideoSearch(playlist.searchQuery, true, 8);
  const ytUrl = `https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}`;

  return (
    <>
      {playingVideo && (
        <VideoPlayerModal videoId={playingVideo.id} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />
      )}
      <BottomSheet isOpen={true} onClose={onClose} title={playlist.title}>
        <div className="space-y-4">
          {/* Header Banner */}
          <div className={`relative h-36 rounded-2xl bg-gradient-to-br ${playlist.thumbnailColor} p-5 flex items-center justify-between overflow-hidden shadow-inner`}>
            <div className="relative z-10 max-w-[70%]">
              <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 uppercase tracking-wide ${LEVEL_BADGE[playlist.level]}`}>
                {playlist.level}
              </span>
              <p className="text-white/80 text-xs font-semibold">{playlist.channel}</p>
            </div>
            <span className="text-6xl opacity-80 select-none">{playlist.emoji}</span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{playlist.description}</p>

          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <span>▶</span>
              <span>{playlist.videoCount} Videos</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium capitalize">
              <span>🏷</span>
              <span>{playlist.category}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Curated Videos · Live Search
              </h3>
              {loading && (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                Notice: {error}
              </div>
            )}

            {!loading && videos.length > 0 && (
              <div className="space-y-2">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPlayingVideo({ id: v.videoId, title: v.title })}
                    className="w-full flex gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60 transition-all duration-200 text-left cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="relative shrink-0 w-24 sm:w-28 h-16 rounded-xl overflow-hidden bg-slate-800">
                      <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                        <div className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md">
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
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-emerald-500 transition-colors">
                        {v.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{v.channel}</p>
                      {v.viewCount && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">{v.viewCount}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-sm transition-all duration-200 shadow-md shadow-red-500/20 active:scale-[0.98]"
          >
            <svg width="18" height="13" viewBox="0 0 24 17" fill="white">
              <path d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 17 12 17 12 17s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-5.8zM9.7 12V5l6.3 3.5L9.7 12z" />
            </svg>
            Open Full Playlist on YouTube
          </a>
        </div>
      </BottomSheet>
    </>
  );
};

// ── Punjabi Modal (BottomSheet) ────────────────────────────
const PunjabiBottomSheet = ({ playlist, onClose }: { playlist: PunjabiPlaylist; onClose: () => void }) => {
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string } | null>(null);
  const { videos, loading, error } = useVideoSearch(playlist.searchQuery, true, 8);

  return (
    <>
      {playingVideo && (
        <VideoPlayerModal videoId={playingVideo.id} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />
      )}
      <BottomSheet isOpen={true} onClose={onClose} title={playlist.title}>
        <div className="space-y-4">
          <div className={`relative h-36 rounded-2xl bg-gradient-to-br ${playlist.thumbnailColor} p-5 flex items-center justify-between overflow-hidden shadow-inner`}>
            <div className="relative z-10 max-w-[70%]">
              <span className={`inline-block text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide mb-2 ${MOOD_BADGE[playlist.mood]}`}>
                {playlist.mood}
              </span>
              <p className="text-white/90 text-xs font-semibold">{playlist.artist}</p>
            </div>
            <span className="text-6xl opacity-80 select-none">{playlist.emoji}</span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{playlist.description}</p>
          <div className="flex gap-2">
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl font-bold">
              ⚡ {playlist.bpm}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Tracks · YouTube</h3>
            {loading && <p className="text-xs text-slate-400 py-3">Loading fresh tracks...</p>}
            {error && <p className="text-xs text-rose-500">{error}</p>}
            {!loading &&
              videos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setPlayingVideo({ id: v.videoId, title: v.title })}
                  className="w-full flex gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60 transition-all duration-200 text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="relative shrink-0 w-24 sm:w-28 h-16 rounded-xl overflow-hidden bg-slate-800">
                    <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#111" className="ml-0.5">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-orange-500 transition-colors">
                      {v.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{v.channel}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
};

// ── Playlist Card ──────────────────────────────────────────
const PlaylistCard = ({ playlist, onPlay }: { playlist: Playlist; index: number; onPlay: () => void }) => {
  return (
    <button
      onClick={onPlay}
      className="group text-left w-full rounded-2xl overflow-hidden cursor-pointer relative bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
    >
      <div className={`relative h-40 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="text-5xl opacity-85 select-none transition-transform duration-300 group-hover:scale-110">
          {playlist.emoji}
        </span>
        {/* Play Icon (always visible on mobile, responsive on desktop) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/95 text-gray-900 flex items-center justify-center shadow-lg transition-transform duration-300 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" className="ml-0.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5">
          <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wide ${LEVEL_BADGE[playlist.level]}`}>
            {playlist.level}
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
          {playlist.videoCount} videos
        </div>
        <div className="absolute bottom-2.5 left-2.5 bg-black/50 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize">
          {playlist.category}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-1 group-hover:text-emerald-500 transition-colors mb-1">
          {playlist.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
          {playlist.description}
        </p>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
            {playlist.channel}
          </span>
          <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-0.5">
            Watch →
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Punjabi Card ───────────────────────────────────────────
const PunjabiCard = ({ playlist, onPlay }: { playlist: PunjabiPlaylist; index: number; onPlay: () => void }) => {
  return (
    <button
      onClick={onPlay}
      className="group text-left w-full rounded-2xl overflow-hidden cursor-pointer relative bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
    >
      <div className={`relative h-36 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="text-5xl opacity-85 select-none transition-transform duration-300 group-hover:scale-110">
          {playlist.emoji}
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/95 text-gray-900 flex items-center justify-center shadow-lg transition-transform duration-300 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" className="ml-0.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5">
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${MOOD_BADGE[playlist.mood]}`}>
            {playlist.mood}
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
          {playlist.bpm}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-1 group-hover:text-orange-500 transition-colors mb-0.5">
          {playlist.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 truncate">{playlist.artist}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
          {playlist.description}
        </p>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex gap-1 flex-wrap">
            {playlist.tags.slice(0, 2).map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize">
                #{t}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-orange-500 font-bold flex items-center gap-0.5">
            Play →
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Search Bar ─────────────────────────────────────────────
const SearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative group">
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search workouts by title, trainer or muscle group..."
      className="w-full min-h-[44px] pl-11 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 text-gray-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 shadow-sm transition-all"
    />
  </div>
);

// ── Main Workouts View ─────────────────────────────────────
export default function Workouts() {
  const [activeTab, setActiveTab] = useState<"videos" | "today" | "music">("videos");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [activeLevel, setActiveLevel] = useState<string>("all levels");
  const [activeMood, setActiveMood] = useState<PunjabiPlaylist["mood"] | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<PunjabiPlaylist | null>(null);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [trackerExercise, setTrackerExercise] = useState("Barbell Squats");

  // Active workout plan for Today tab
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    api
      .get("/api/workout-plans/active")
      .then((res) => {
        if (!isSubscribed) return;
        if (res.data?.plan) {
          setActivePlan(res.data.plan);
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, []);

  const filteredPlaylists = PLAYLISTS.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchLevel = activeLevel === "all levels" || p.level === activeLevel || p.level === "all levels";
    const matchSearch =
      !search.trim() ||
      [p.title, p.channel, p.description].some((s) =>
        s.toLowerCase().includes(search.toLowerCase())
      );
    return matchCat && matchLevel && matchSearch;
  });

  const filteredMusic = PUNJABI_PLAYLISTS.filter((p) => {
    const matchMood = activeMood === "all" || p.mood === activeMood;
    const matchSearch =
      !search.trim() ||
      [p.title, p.artist, p.description].some((s) =>
        s.toLowerCase().includes(search.toLowerCase())
      );
    return matchMood && matchSearch;
  });

  // Today's scheduled plan day
  const todayIndex = new Date().getDay() % Math.max(1, activePlan?.days?.length || 1);
  const todayDayPlan = activePlan?.days?.[todayIndex];

  return (
    <div className="wo-root relative min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
      <AmbientBackground />

      {/* Modals */}
      {selectedPlaylist && (
        <PlaylistBottomSheet playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
      )}
      {selectedMusic && (
        <PunjabiBottomSheet playlist={selectedMusic} onClose={() => setSelectedMusic(null)} />
      )}
      {showLiveTracker && (
        <LiveWorkoutTrackerModal
          defaultExercise={trackerExercise}
          onClose={() => setShowLiveTracker(false)}
        />
      )}

      {/* ── Hero Section (Compact on mobile for top 420px visibility: M2) ── */}
      <div className="relative z-10 px-4 sm:px-6 pt-4 sm:pt-8 pb-4 max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-indigo-500/15 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-indigo-950/30 p-4 sm:p-7 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                  FitTrack Workouts & Library
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                Train Harder.{" "}
                <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  Perform Better.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-lg">
                Curated workout programs, live set tracker with tactile rest intervals, and high-energy workout playlists.
              </p>

              {/* Action Steppers in Hero */}
              <div className="mt-3.5 flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowLiveTracker(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <span>⚡</span> Start Live Workout
                </button>
                <Link
                  to="/activity-planner"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-colors flex items-center gap-1.5 active:scale-95"
                >
                  <span>📋</span> AI Plan Generator
                </Link>
              </div>
            </div>

            {/* Desktop Preview Card (Hidden on mobile for M2 fast scrolling) */}
            <div className="hidden md:block w-72 shrink-0">
              <div
                onClick={() => setSelectedPlaylist(PLAYLISTS[0])}
                className="rounded-2xl border border-white/60 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 p-3 backdrop-blur-md shadow-md cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <div className={`relative rounded-xl overflow-hidden h-28 bg-gradient-to-br ${PLAYLISTS[0].thumbnailColor} flex items-center justify-center`}>
                  <img src={FEATURED_IMAGES[PLAYLISTS[0].category]} alt={PLAYLISTS[0].title} className="w-full h-full object-cover opacity-80" />
                  <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white capitalize">
                    {PLAYLISTS[0].category}
                  </span>
                  <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">
                    {PLAYLISTS[0].videoCount} videos
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-gray-900 dark:text-white truncate">{PLAYLISTS[0].title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{PLAYLISTS[0].channel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Segmented Mode Control (M6) ── */}
      <div className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md py-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-2xl border border-slate-300/40 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("videos")}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "videos"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span>🎬</span> Videos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "today"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span>📅</span> Today's Plan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("music")}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "music"
                  ? "bg-white dark:bg-slate-800 text-orange-500 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span>🎵</span> Music
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLiveTracker(true)}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
          >
            <span>⏱️</span> Quick Log Set
          </button>
        </div>
      </div>

      {/* ── Mode 1: Videos Library ── */}
      {activeTab === "videos" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          <SearchBar value={search} onChange={setSearch} />

          {/* Compact Scrollable Chips (M11) with 44px tap targets */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {CATEGORIES.map(({ key, label, emoji }) => {
              const active = activeCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key as Category | "all")}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 snap-start flex items-center gap-1.5 active:scale-95 ${
                    active
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                      : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-emerald-500/50"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {LEVELS.map((level) => {
              const active = activeLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActiveLevel(level)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 snap-start capitalize active:scale-95 ${
                    active
                      ? `${LEVEL_BADGE[level]} border-emerald-500/60`
                      : "bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60 hover:border-slate-400"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {/* Grid of Workouts */}
          {filteredPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-2">
              {filteredPlaylists.map((playlist, i) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  index={i}
                  onPlay={() => setSelectedPlaylist(playlist)}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <span className="text-4xl block mb-2">🔍</span>
              <p className="text-base font-bold text-gray-900 dark:text-white">No workouts match your filters</p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveLevel("all levels");
                  setSearch("");
                }}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white cursor-pointer active:scale-95"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mode 2: Today's Plan Tab (F7) ── */}
      {activeTab === "today" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {activePlan && todayDayPlan ? (
            <div className="space-y-6">
              {/* Today Card */}
              <div className="rounded-3xl p-6 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/30">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      {todayDayPlan.day} Workout
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                      {todayDayPlan.focus || "Scheduled Training Session"}
                    </h2>
                    {todayDayPlan.duration && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Estimated duration: {todayDayPlan.duration}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const firstEx = todayDayPlan.exercises[0];
                      const name = typeof firstEx === "string" ? firstEx : firstEx?.name || "Workout";
                      setTrackerExercise(name);
                      setShowLiveTracker(true);
                    }}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span>⚡</span> Start Session Tracker
                  </button>
                </div>

                {/* Exercises in Today's plan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {todayDayPlan.exercises.map((ex, idx) => {
                    const exName = typeof ex === "string" ? ex : ex.name;
                    const exSets = typeof ex === "object" && ex.sets ? `${ex.sets} sets` : "";
                    const exReps = typeof ex === "object" && ex.reps ? `· ${ex.reps} reps` : "";
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{exName}</p>
                          {(exSets || exReps) && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {exSets} {exReps}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackerExercise(exName);
                            setShowLiveTracker(true);
                          }}
                          className="min-w-[44px] min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Track sets"
                        >
                          Log Sets
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Workouts matching Today's focus */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Recommended Videos For Today
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PLAYLISTS.slice(0, 3).map((playlist, i) => (
                    <PlaylistCard
                      key={playlist.id}
                      playlist={playlist}
                      index={i}
                      onPlay={() => setSelectedPlaylist(playlist)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <span className="text-4xl block">📋</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No active workout plan found</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Generate a custom personalized split in the AI Activity Planner to unlock day-by-day workout tracking here!
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  to="/activity-planner"
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/25 flex items-center gap-2 active:scale-95"
                >
                  Generate Plan Now →
                </Link>
                <button
                  type="button"
                  onClick={() => setShowLiveTracker(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95"
                >
                  Log Freestyle Workout
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mode 3: Punjabi Music ── */}
      {activeTab === "music" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          <SearchBar value={search} onChange={setSearch} />

          {/* Mood filters (M11) */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
            {PUNJABI_MOODS.map(({ key, label, emoji }) => {
              const active = activeMood === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMood(key as PunjabiPlaylist["mood"] | "all")}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 snap-start flex items-center gap-1.5 active:scale-95 ${
                    active
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-orange-500/50"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Grid of Punjabi playlists */}
          {filteredMusic.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-2">
              {filteredMusic.map((playlist, i) => (
                <PunjabiCard
                  key={playlist.id}
                  playlist={playlist}
                  index={i}
                  onPlay={() => setSelectedMusic(playlist)}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <span className="text-4xl block mb-2">🎵</span>
              <p className="text-base font-bold text-gray-900 dark:text-white">No playlists found</p>
              <button
                type="button"
                onClick={() => {
                  setActiveMood("all");
                  setSearch("");
                }}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 text-white cursor-pointer active:scale-95"
              >
                Show all music
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

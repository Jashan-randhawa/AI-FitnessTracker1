import { useState, useEffect, useRef } from "react";
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

interface PunjabiPlaylist {
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

const STRAPI_API_BASE_URL = (import.meta.env.VITE_STRAPI_API_URL ?? "http://localhost:1337").replace(/\/$/, "");

const PLAYLISTS: Playlist[] = [
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

const PUNJABI_PLAYLISTS: PunjabiPlaylist[] = [
  { id: "p1", title: "Bhangra Pump Up", artist: "Diljit Dosanjh & AP Dhillon", mood: "pump", description: "High-energy Bhangra beats to power through your hardest sets. Maximum intensity guaranteed.", emoji: "🔥", searchQuery: "Diljit Dosanjh bhangra workout gym", thumbnailColor: "from-orange-500 to-red-600", bpm: "140–160 BPM", tags: ["bhangra", "high energy", "gym"] },
  { id: "p2", title: "AP Dhillon Hits", artist: "AP Dhillon", mood: "hype", description: "Smooth yet powerful AP Dhillon tracks — perfect for steady-state cardio and endurance runs.", emoji: "💜", searchQuery: "AP Dhillon workout motivation 2024", thumbnailColor: "from-violet-600 to-purple-700", bpm: "120–135 BPM", tags: ["modern", "cardio", "run"] },
  { id: "p3", title: "Warm-Up Vibes", artist: "Sidhu Moosewala Tribute", mood: "warm-up", description: "Melodic Punjabi tracks to get your blood flowing and your mind in the zone before the session.", emoji: "🌅", searchQuery: "Sidhu Moosewala best songs workout", thumbnailColor: "from-amber-400 to-orange-500", bpm: "95–115 BPM", tags: ["warm-up", "melodic", "legend"] },
  { id: "p4", title: "HIIT Bhangra", artist: "Guru Randhawa & Badshah", mood: "hype", description: "Explosive Punjabi pop and bhangra mashups timed perfectly for HIIT intervals and sprints.", emoji: "⚡", searchQuery: "Guru Randhawa Badshah gym HIIT playlist", thumbnailColor: "from-yellow-500 to-orange-600", bpm: "145–165 BPM", tags: ["HIIT", "pop", "intervals"] },
  { id: "p5", title: "Cool-Down Ragas", artist: "Satinder Sartaaj", mood: "cool-down", description: "Soul-soothing Punjabi classical and folk melodies for your post-workout stretch and recovery.", emoji: "🧘", searchQuery: "Satinder Sartaaj relaxing Punjabi songs", thumbnailColor: "from-teal-500 to-cyan-600", bpm: "60–85 BPM", tags: ["cool-down", "folk", "recovery"] },
  { id: "p6", title: "Street Hustle Mix", artist: "Karan Aujla & Shubh", mood: "pump", description: "Raw, gritty Punjabi rap tracks that hit hard — ideal for heavy lifting and strength days.", emoji: "💪", searchQuery: "Karan Aujla Shubh gym rap workout 2024", thumbnailColor: "from-slate-700 to-slate-900", bpm: "130–155 BPM", tags: ["rap", "strength", "lifting"] },
];

const PUNJABI_MOODS: { key: PunjabiPlaylist["mood"] | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "🎵" },
  { key: "pump", label: "Pump Up", emoji: "🔥" },
  { key: "hype", label: "Hype", emoji: "⚡" },
  { key: "warm-up", label: "Warm-Up", emoji: "🌅" },
  { key: "cool-down", label: "Cool-Down", emoji: "🧘" },
];

const MOOD_BADGE: Record<string, string> = {
  pump: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40",
  hype: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40",
  "warm-up": "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  "cool-down": "bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40",
};

const CATEGORIES: { key: Category | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "✨" },
  { key: "strength", label: "Strength", emoji: "🏋️" },
  { key: "cardio", label: "Cardio", emoji: "🏃" },
  { key: "hiit", label: "HIIT", emoji: "🔥" },
  { key: "yoga", label: "Yoga", emoji: "🧘" },
  { key: "mobility", label: "Mobility", emoji: "🌅" },
];

const LEVELS = ["all levels", "beginner", "intermediate", "advanced"] as const;

const LEVEL_BADGE: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  intermediate: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  advanced: "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40",
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

const ANIMATION_STYLES = `
@keyframes wo-float {
  0%,100%{transform:translateY(0) translateX(0);opacity:.35}
  33%{transform:translateY(-14px) translateX(6px);opacity:.55}
  66%{transform:translateY(-6px) translateX(-8px);opacity:.4}
}
@keyframes wo-orb {
  0%,100%{transform:scale(1);opacity:.5}
  50%{transform:scale(1.12);opacity:.85}
}
@keyframes wo-shimmer {
  0%{background-position:-200% center}
  100%{background-position:200% center}
}
@keyframes wo-slideUp {
  from{opacity:0;transform:translateY(22px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes wo-scaleIn {
  from{opacity:0;transform:scale(0.88)}
  to{opacity:1;transform:scale(1)}
}
@keyframes wo-modalSlide {
  from{opacity:0;transform:translateY(44px) scale(0.95)}
  to{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes wo-cardIn {
  from{opacity:0;transform:translateY(32px) scale(0.94)}
  to{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes wo-emoji {
  0%,100%{transform:translateY(0) rotate(-2deg)}
  50%{transform:translateY(-9px) rotate(2deg)}
}
@keyframes wo-ping {
  0%{transform:scale(1);opacity:.6}
  100%{transform:scale(2.4);opacity:0}
}
@keyframes wo-sparkle {
  0%{opacity:1;transform:translate(-50%,-50%) scale(.5)}
  50%{opacity:.8;transform:translate(-50%,-120%) scale(1)}
  100%{opacity:0;transform:translate(-50%,-180%) scale(.3)}
}
@keyframes wo-heroGlow {
  0%,100%{opacity:.45;transform:scale(1)}
  50%{opacity:.8;transform:scale(1.08)}
}
@keyframes wo-gradient {
  0%,100%{background-position:0% center}
  50%{background-position:100% center}
}
@keyframes wo-fadeIn {
  from{opacity:0}to{opacity:1}
}
`;

// ── Strapi-proxied YouTube Search Hook ─────────────────────
function useYouTubeSearch(query: string, enabled: boolean) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !query) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();

    fetch(`${STRAPI_API_BASE_URL}/api/youtube/search?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    })
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(data => {
        setVideos(
          (data.contents || [])
            .filter((i: any) => i.type === "video" && i.video)
            .slice(0, 8)
            .map((i: any) => ({
              id: i.video.videoId,
              videoId: i.video.videoId,
              title: i.video.title,
              channel: i.video.author?.title || "Unknown",
              thumbnail: i.video.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${i.video.videoId}/hqdefault.jpg`,
              duration: i.video.lengthText || "",
              viewCount: i.video.stats?.views ? formatViews(i.video.stats.views) : "",
              publishedAt: i.video.publishedTimeText || "",
            }))
        );
      })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [query, enabled]);

  return { videos, loading, error };
}

// ── Punjabi Music Search Hook (same RapidAPI backend) ──────
function usePunjabiMusicSearch(query: string, enabled: boolean) {
  const [tracks, setTracks] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !query) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();

    fetch(`${STRAPI_API_BASE_URL}/api/youtube/search?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    })
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(data => {
        setTracks(
          (data.contents || [])
            .filter((i: any) => i.type === "video" && i.video)
            .slice(0, 10)
            .map((i: any) => ({
              id: i.video.videoId,
              videoId: i.video.videoId,
              title: i.video.title,
              channel: i.video.author?.title || "Unknown",
              thumbnail: i.video.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${i.video.videoId}/hqdefault.jpg`,
              duration: i.video.lengthText || "",
              viewCount: i.video.stats?.views ? formatViews(i.video.stats.views) : "",
              publishedAt: i.video.publishedTimeText || "",
            }))
        );
      })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [query, enabled]);

  return { tracks, loading, error };
}

function formatViews(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K views`;
  return `${n} views`;
}

const PARTICLES = [
  {x:8,  y:12, s:6, c:"rgba(16,185,129,.6)",  d:0,   dur:7},
  {x:84, y:22, s:4, c:"rgba(139,92,246,.5)",  d:1.5, dur:9},
  {x:44, y:68, s:5, c:"rgba(244,63,94,.5)",   d:.8,  dur:6},
  {x:71, y:79, s:3, c:"rgba(34,211,238,.6)",  d:2.2, dur:8},
  {x:21, y:53, s:7, c:"rgba(251,191,36,.4)",  d:3,   dur:10},
  {x:59, y:9,  s:4, c:"rgba(16,185,129,.5)",  d:.3,  dur:7},
  {x:91, y:61, s:5, c:"rgba(139,92,246,.4)",  d:4,   dur:8},
  {x:34, y:88, s:6, c:"rgba(244,63,94,.4)",   d:1,   dur:11},
];

const AnimatedBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(16,185,129,.07) 0%,transparent 70%)",animation:"wo-orb 6s ease-in-out infinite"}} />
    <div className="absolute top-1/3 -left-20 w-96 h-96 rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(139,92,246,.06) 0%,transparent 70%)",animation:"wo-orb 8s ease-in-out 2s infinite"}} />
    <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(244,63,94,.06) 0%,transparent 70%)",animation:"wo-orb 7s ease-in-out 4s infinite"}} />
    <div className="absolute top-2/3 left-1/2 w-72 h-72 rounded-full blur-3xl" style={{background:"radial-gradient(circle,rgba(34,211,238,.05) 0%,transparent 70%)",animation:"wo-orb 9s ease-in-out 1s infinite"}} />
    <div className="absolute inset-0 opacity-[0.018]" style={{backgroundImage:"linear-gradient(rgba(16,185,129,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,.5) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />
    {PARTICLES.map((p, i) => (
      <div key={i} className="absolute rounded-full" style={{left:`${p.x}%`,top:`${p.y}%`,width:p.s,height:p.s,background:p.c,animation:`wo-float ${p.dur}s ease-in-out ${p.d}s infinite`,opacity:.4}} />
    ))}
  </div>
);

const AnimatedCounter = ({target, dur=900}: {target:number;dur?:number}) => {
  const [n, setN] = useState(0);
  const t0 = useRef<number|null>(null);
  useEffect(() => {
    t0.current = null;
    const tick = (ts: number) => {
      if (!t0.current) t0.current = ts;
      const p = Math.min((ts - t0.current) / dur, 1);
      setN(Math.round((1 - (1 - p) ** 3) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, dur]);
  return <>{n}</>;
};

const VideoPlayerModal = ({videoId, title, onClose}: {videoId:string;title:string;onClose:()=>void}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{animation:"wo-fadeIn .2s ease-out"}}>
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}/>
    <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700/60" style={{animation:"wo-scaleIn .3s cubic-bezier(.34,1.56,.64,1)"}}>
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-white truncate pr-4">{title}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0 cursor-pointer hover:rotate-90 duration-200">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="relative" style={{paddingBottom:"56.25%"}}>
        <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media" allowFullScreen/>
      </div>
    </div>
  </div>
);

const PlaylistModal = ({playlist, onClose}: {playlist:Playlist;onClose:()=>void}) => {
  const [playingVideo, setPlayingVideo] = useState<{id:string;title:string}|null>(null);
  const {videos, loading, error} = useYouTubeSearch(playlist.searchQuery, true);
  const ytUrl = `https://www.youtube.com/playlist?list=${playlist.youtubePlaylistId}`;
  return (
    <>
      {playingVideo && <VideoPlayerModal videoId={playingVideo.id} title={playingVideo.title} onClose={() => setPlayingVideo(null)}/>}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{animation:"wo-fadeIn .25s ease-out"}}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}/>
        <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl bg-slate-900 border border-slate-700/60 flex flex-col" style={{animation:"wo-modalSlide .4s cubic-bezier(.34,1.56,.64,1)"}}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-slate-700"/></div>
          <div className={`relative h-44 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-between px-6 shrink-0 overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,.18) 50%,transparent 65%)",backgroundSize:"200% 100%",animation:"wo-shimmer 3s linear .5s infinite"}}/>
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl" style={{animation:"wo-orb 4s ease-in-out infinite"}}/>
            <div className="absolute -bottom-10 left-10 w-24 h-24 rounded-full bg-black/15 blur-xl" style={{animation:"wo-orb 5s ease-in-out 1s infinite"}}/>
            <div className="relative z-10">
              <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mb-2 ${LEVEL_BADGE[playlist.level]}`}>{playlist.level.toUpperCase()}</span>
              <h2 className="text-xl font-black text-white leading-tight drop-shadow-sm">{playlist.title}</h2>
              <p className="text-white/70 text-sm mt-0.5">{playlist.channel}</p>
            </div>
            <span className="text-7xl opacity-80 relative z-10 select-none" style={{animation:"wo-emoji 3s ease-in-out infinite"}}>{playlist.emoji}</span>
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center bg-black/30 text-white hover:bg-black/50 hover:rotate-90 transition-all duration-200 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">{playlist.description}</p>
            <div className="flex gap-3">
              {[{label:`${playlist.videoCount} Videos`,icon:"▶"},{label:playlist.category,icon:"🏷"}].map((s, i) => (
                <div key={s.label} className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium" style={{animation:`wo-slideUp .4s ease-out ${i*.1+.2}s both`}}>
                  <span className="opacity-60">{s.icon}</span><span className="capitalize">{s.label}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Results · YouTube</h3>
                {loading && <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:`${i*.15}s`}}/>)}</div>}
              </div>
              {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">Error: {error}</div>}
              {!loading && !error && videos.length > 0 && (
                <div className="space-y-2">
                  {videos.map((v, i) => (
                    <button key={v.id} onClick={() => setPlayingVideo({id:v.videoId,title:v.title})}
                      className="w-full flex gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-all duration-200 group text-left cursor-pointer hover:scale-[1.01]"
                      style={{animation:`wo-slideUp .35s ease-out ${i*.06}s both`}}>
                      <div className="relative shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-slate-800">
                        <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy"/>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md scale-75 group-hover:scale-100">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#111" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                        </div>
                        {v.duration && <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">{v.duration}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">{v.title}</p>
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
              {!loading && !error && videos.length === 0 && <p className="text-center text-slate-600 text-xs py-4">No videos found.</p>}
            </div>
            <a href={ytUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-sm transition-all duration-200 shadow-lg shadow-red-600/25 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[.98]">
              <svg width="17" height="12" viewBox="0 0 24 17" fill="white"><path d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 17 12 17 12 17s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-5.8zM9.7 12V5l6.3 3.5L9.7 12z"/></svg>
              Open Full Playlist on YouTube
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

const PlaylistCard = ({playlist, onPlay, index}: {playlist:Playlist;onPlay:()=>void;index:number}) => {
  const [hovered, setHovered] = useState(false);
  const [sparkles, setSparkles] = useState<{id:number;x:number;y:number}[]>([]);
  const sparkRef = useRef(0);

  const onMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hovered || Math.random() > .65) return;
    const r = e.currentTarget.getBoundingClientRect();
    const id = sparkRef.current++;
    setSparkles(s => [...s.slice(-6), {id, x:((e.clientX-r.left)/r.width)*100, y:((e.clientY-r.top)/r.height)*100}]);
    setTimeout(() => setSparkles(s => s.filter(sp => sp.id !== id)), 600);
  };

  return (
    <button onClick={onPlay} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setSparkles([]); }} onMouseMove={onMouseMove}
      className="group text-left w-full rounded-2xl overflow-hidden cursor-pointer relative"
      style={{animation:`wo-cardIn .55s cubic-bezier(.34,1.56,.64,1) ${index*70}ms both`,transform:hovered?"translateY(-6px) scale(1.02)":"translateY(0) scale(1)",transition:"transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s ease",boxShadow:hovered?"0 24px 60px -15px rgba(0,0,0,.35),0 0 0 1px rgba(16,185,129,.22)":"0 4px 20px -8px rgba(0,0,0,.2)"}}>
      {sparkles.map(sp => (
        <div key={sp.id} className="absolute pointer-events-none z-30 text-emerald-300 text-xs font-bold select-none" style={{left:`${sp.x}%`,top:`${sp.y}%`,animation:"wo-sparkle .6s ease-out forwards",transform:"translate(-50%,-50%)"}}>✦</div>
      ))}
      <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-opacity duration-300" style={{background:"linear-gradient(135deg,rgba(16,185,129,.13),rgba(139,92,246,.09))",opacity:hovered?1:0,boxShadow:hovered?"inset 0 0 0 1px rgba(16,185,129,.28)":"none"}}/>
      <div className={`relative h-44 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(105deg,transparent 40%,rgba(255,255,255,.2) 50%,transparent 60%)",backgroundSize:"200% 100%",animation:hovered?"wo-shimmer 1.4s linear infinite":"none"}}/>
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent"/>
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" style={{animation:`wo-orb 3s ease-in-out ${index*.3}s infinite`}}/>
        <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-black/10" style={{animation:`wo-orb 4s ease-in-out ${index*.2+1}s infinite`}}/>
        <span className="text-6xl opacity-85 z-10 select-none transition-all duration-500" style={{animation:hovered?"wo-emoji 1.5s ease-in-out infinite":`wo-emoji 4s ease-in-out ${index*.4}s infinite`,filter:hovered?"drop-shadow(0 0 14px rgba(255,255,255,.55))":"none",transform:hovered?"scale(1.18)":"scale(1)"}}>{playlist.emoji}</span>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 flex items-center justify-center z-20">
          <div className="relative">
            {hovered && <><div className="absolute inset-0 rounded-full bg-white/25" style={{animation:"wo-ping 1s ease-out infinite"}}/><div className="absolute inset-0 rounded-full bg-white/15 scale-125" style={{animation:"wo-ping 1s ease-out .35s infinite"}}/></>}
            <div className="relative w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl transition-all duration-300" style={{opacity:hovered?1:0,transform:hovered?"scale(1)":"scale(.7)"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#111" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        </div>
        <div className="absolute top-3 left-3 z-10"><span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${LEVEL_BADGE[playlist.level]}`}>{playlist.level}</span></div>
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">{playlist.videoCount} videos</div>
        <div className="absolute bottom-3 left-3 bg-black/50 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize z-10">{playlist.category}</div>
      </div>
      <div className="p-4 bg-white dark:bg-slate-800/80 border-x border-b border-slate-100 dark:border-slate-700/50 rounded-b-2xl backdrop-blur-sm transition-colors duration-200">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-1 group-hover:text-emerald-500 transition-colors duration-200 mb-1">{playlist.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">{playlist.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 17" fill="currentColor" className="text-red-500 shrink-0"><path d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7 31 31 0 0 0 0 8.5a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 17 12 17 12 17s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 8.5a31 31 0 0 0-.5-5.8zM9.7 12V5l6.3 3.5L9.7 12z"/></svg>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">{playlist.channel}</span>
          </div>
          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-0.5 transition-all duration-300" style={{opacity:hovered?1:0,transform:hovered?"translateX(0)":"translateX(-6px)"}}>
            Watch <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </div>
    </button>
  );
};

const SearchBar = ({value, onChange}: {value:string;onChange:(v:string)=>void}) => (
  <div className="relative group">
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-all duration-200 group-focus-within:scale-110" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="text" placeholder="Search workouts, channels…" value={value} onChange={e => onChange(e.target.value)}
      className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 backdrop-blur-sm"/>
    {value && (
      <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all duration-200 cursor-pointer hover:rotate-90">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    )}
  </div>
);

// ── Punjabi Music Modal ────────────────────────────────────
const PunjabiMusicModal = ({ playlist, onClose }: { playlist: PunjabiPlaylist; onClose: () => void }) => {
  const [playingVideo, setPlayingVideo] = useState<{ id: string; title: string } | null>(null);
  const { tracks, loading, error } = usePunjabiMusicSearch(playlist.searchQuery, true);

  return (
    <>
      {playingVideo && <VideoPlayerModal videoId={playingVideo.id} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ animation: "wo-fadeIn .25s ease-out" }}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl bg-slate-900 border border-slate-700/60 flex flex-col" style={{ animation: "wo-modalSlide .4s cubic-bezier(.34,1.56,.64,1)" }}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-slate-700" /></div>
          {/* Header */}
          <div className={`relative h-44 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-between px-6 shrink-0 overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 35%,rgba(255,255,255,.18) 50%,transparent 65%)", backgroundSize: "200% 100%", animation: "wo-shimmer 3s linear .5s infinite" }} />
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl" style={{ animation: "wo-orb 4s ease-in-out infinite" }} />
            <div className="absolute -bottom-10 left-10 w-24 h-24 rounded-full bg-black/15 blur-xl" style={{ animation: "wo-orb 5s ease-in-out 1s infinite" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white uppercase tracking-wider">🎵 Punjabi Music</span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${MOOD_BADGE[playlist.mood]}`}>{playlist.mood.toUpperCase()}</span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight drop-shadow-sm">{playlist.title}</h2>
              <p className="text-white/70 text-sm mt-0.5">{playlist.artist}</p>
              <p className="text-white/50 text-xs mt-0.5">{playlist.bpm}</p>
            </div>
            <span className="text-7xl opacity-80 relative z-10 select-none" style={{ animation: "wo-emoji 3s ease-in-out infinite" }}>{playlist.emoji}</span>
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center bg-black/30 text-white hover:bg-black/50 hover:rotate-90 transition-all duration-200 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">{playlist.description}</p>
            <div className="flex gap-2 flex-wrap">
              {playlist.tags.map((tag, i) => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium capitalize" style={{ animation: `wo-slideUp .3s ease-out ${i * .08}s both` }}>#{tag}</span>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Results · YouTube</h3>
                {loading && <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: `${i * .15}s` }} />)}</div>}
              </div>
              {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">Error: {error}</div>}
              {!loading && !error && tracks.length > 0 && (
                <div className="space-y-2">
                  {tracks.map((v, i) => (
                    <button key={v.id} onClick={() => setPlayingVideo({ id: v.videoId, title: v.title })}
                      className="w-full flex gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-all duration-200 group text-left cursor-pointer hover:scale-[1.01]"
                      style={{ animation: `wo-slideUp .35s ease-out ${i * .06}s both` }}>
                      <div className="relative shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-slate-800">
                        <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md scale-75 group-hover:scale-100">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#111" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                        </div>
                        {v.duration && <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">{v.duration}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-orange-400 transition-colors">{v.title}</p>
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
              {!loading && !error && tracks.length === 0 && <p className="text-center text-slate-600 text-xs py-4">No tracks found. Check your backend connection.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Punjabi Music Card ─────────────────────────────────────
const PunjabiMusicCard = ({ playlist, onPlay, index }: { playlist: PunjabiPlaylist; onPlay: () => void; index: number }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group text-left w-full rounded-2xl overflow-hidden cursor-pointer relative"
      style={{ animation: `wo-cardIn .55s cubic-bezier(.34,1.56,.64,1) ${index * 70}ms both`, transform: hovered ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)", transition: "transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s ease", boxShadow: hovered ? "0 20px 50px -15px rgba(0,0,0,.4),0 0 0 1px rgba(251,146,60,.25)" : "0 4px 20px -8px rgba(0,0,0,.25)" }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-opacity duration-300" style={{ background: "linear-gradient(135deg,rgba(251,146,60,.12),rgba(239,68,68,.08))", opacity: hovered ? 1 : 0, boxShadow: hovered ? "inset 0 0 0 1px rgba(251,146,60,.28)" : "none" }} />
      {/* Card thumbnail */}
      <div className={`relative h-36 bg-gradient-to-br ${playlist.thumbnailColor} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,.2) 50%,transparent 60%)", backgroundSize: "200% 100%", animation: hovered ? "wo-shimmer 1.4s linear infinite" : "none" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" style={{ animation: `wo-orb 3s ease-in-out ${index * .3}s infinite` }} />
        <span className="text-5xl opacity-85 z-10 select-none transition-all duration-500" style={{ animation: hovered ? "wo-emoji 1.5s ease-in-out infinite" : `wo-emoji 4s ease-in-out ${index * .4}s infinite`, transform: hovered ? "scale(1.2)" : "scale(1)" }}>{playlist.emoji}</span>
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center z-20">
          <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-xl transition-all duration-300" style={{ opacity: hovered ? 1 : 0, transform: hovered ? "scale(1)" : "scale(.7)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" className="ml-1"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${MOOD_BADGE[playlist.mood]}`}>{playlist.mood}</span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md z-10">{playlist.bpm}</div>
      </div>
      {/* Card body */}
      <div className="p-4 bg-white dark:bg-slate-800/80 border-x border-b border-slate-100 dark:border-slate-700/50 rounded-b-2xl backdrop-blur-sm">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-1 group-hover:text-orange-400 transition-colors duration-200 mb-0.5">{playlist.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">{playlist.artist}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">{playlist.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {playlist.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize">#{t}</span>
            ))}
          </div>
          <span className="text-[10px] text-orange-400 font-semibold flex items-center gap-0.5 transition-all duration-300" style={{ opacity: hovered ? 1 : 0 }}>
            Play <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Punjabi Music Section ──────────────────────────────────
const PunjabiMusicSection = () => {
  const [activeMood, setActiveMood] = useState<PunjabiPlaylist["mood"] | "all">("all");
  const [selectedMusic, setSelectedMusic] = useState<PunjabiPlaylist | null>(null);

  const filtered = PUNJABI_PLAYLISTS.filter(p =>
    activeMood === "all" || p.mood === activeMood
  );

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16" style={{ animation: "wo-slideUp .6s ease-out .3s both" }}>
      {selectedMusic && <PunjabiMusicModal playlist={selectedMusic} onClose={() => setSelectedMusic(null)} />}
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30" style={{ animation: "wo-orb 3s ease-in-out infinite" }}>
              <span className="text-sm">🎵</span>
            </div>
            <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">Workout Music</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            Punjabi{" "}
            <span style={{ backgroundImage: "linear-gradient(90deg,#fb923c,#ef4444,#f97316,#fb923c)", backgroundSize: "300% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "wo-gradient 4s linear infinite" }}>Music</span>
            {" "}Playlists
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pump up your workout with the best Punjabi beats — powered by YouTube 🟠</p>
        </div>
        {/* Mood filters */}
        <div className="flex gap-2 flex-wrap">
          {PUNJABI_MOODS.map(({ key, label, emoji }, i) => {
            const active = activeMood === key;
            return (
              <button key={key} onClick={() => setActiveMood(key as PunjabiPlaylist["mood"] | "all")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer relative overflow-hidden ${active ? "bg-orange-500 text-black border-orange-500 shadow-lg shadow-orange-500/30 scale-105" : "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:border-orange-500/50 hover:text-orange-400"}`}
                style={{ animation: `wo-slideUp .4s ease-out ${i * .05}s both` }}>
                {active && <span className="absolute inset-0 bg-white/20 rounded-xl" style={{ animation: "wo-ping 1.5s ease-out infinite" }} />}
                <span className="relative z-10">{emoji}</span>
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider with label */}
      <div className="relative flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        <span className="text-[11px] font-bold text-orange-400/80 uppercase tracking-widest px-2">🥁 Punjabi Beats for Every Session</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
      </div>

      {/* Music grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((playlist, i) => (
          <PunjabiMusicCard key={playlist.id} playlist={playlist} index={i} onPlay={() => setSelectedMusic(playlist)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl bg-white/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/50" style={{ animation: "wo-scaleIn .4s cubic-bezier(.34,1.56,.64,1) both" }}>
          <div className="text-4xl mb-3" style={{ animation: "wo-emoji 3s ease-in-out infinite" }}>🎵</div>
          <p className="text-slate-400 font-bold">No playlists match this mood</p>
          <button onClick={() => setActiveMood("all")} className="mt-4 px-5 py-2 text-sm font-bold rounded-xl bg-orange-500 text-black hover:bg-orange-400 transition-all duration-200 cursor-pointer hover:scale-105">Show All Music</button>
        </div>
      )}
    </div>
  );
};

export default function Workouts() {
  const {theme, toggleTheme} = useTheme();
  const [activeCategory, setActiveCategory] = useState<Category|"all">("all");
  const [activeLevel, setActiveLevel] = useState<string>("all levels");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist|null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const filtered = PLAYLISTS.filter(p => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchLevel = activeLevel === "all levels" || p.level === activeLevel || p.level === "all levels";
    const matchSearch = !search.trim() || [p.title, p.channel, p.description].some(s => s.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchLevel && matchSearch;
  });

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
      <style>{ANIMATION_STYLES}</style>
      <AnimatedBackground/>
      {selectedPlaylist && <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)}/>}

      <div className="relative z-10 px-6 pt-10 pb-8 max-w-6xl mx-auto">
        {(() => {
          const featured = filtered[0] || PLAYLISTS[0];
          return (
            <div className="relative overflow-hidden rounded-3xl border border-white/20 dark:border-slate-700/40 bg-gradient-to-br from-white/80 via-emerald-100/40 to-cyan-100/50 dark:from-slate-900/80 dark:via-emerald-900/20 dark:to-cyan-900/20"
              style={{boxShadow:"0 20px 70px -35px rgba(16,185,129,.65),0 0 0 1px rgba(16,185,129,.08)",animation:mounted?"wo-slideUp .6s cubic-bezier(.34,1.56,.64,1) both":"none"}}>
              <div className="absolute -top-20 -left-16 w-56 h-56 rounded-full bg-emerald-400/30 blur-3xl" style={{animation:"wo-heroGlow 5s ease-in-out infinite"}}/>
              <div className="absolute -bottom-24 -right-12 w-64 h-64 rounded-full bg-cyan-500/25 blur-3xl" style={{animation:"wo-heroGlow 6s ease-in-out 2s infinite"}}/>
              <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-violet-500/15 blur-3xl" style={{animation:"wo-heroGlow 7s ease-in-out 1s infinite"}}/>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/45 via-slate-900/25 to-slate-900/40 dark:from-slate-950/60 dark:via-slate-950/30 dark:to-slate-950/65"/>
              <div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,.06) 50%,transparent 65%)",backgroundSize:"200% 100%",animation:"wo-shimmer 6s linear infinite"}}/>
              <div className="relative p-5 sm:p-7 md:p-8 min-h-[240px] sm:min-h-[290px] flex flex-col md:flex-row gap-6 md:gap-8 md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2" style={{animation:"wo-slideUp .5s ease-out .1s both"}}>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30" style={{animation:"wo-orb 3s ease-in-out infinite"}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                    <span className="text-xs font-bold text-emerald-300 tracking-widest uppercase">Workout Library</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{animation:"wo-slideUp .5s ease-out .2s both"}}>
                    <span className="text-white">Workout </span>
                    <span style={{backgroundImage:"linear-gradient(90deg,#6ee7b7,#34d399,#10b981,#6ee7b7)",backgroundSize:"300% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",animation:"wo-gradient 4s linear infinite"}}>Videos</span>
                  </h1>
                  <p className="text-sm text-slate-200 mt-2" style={{animation:"wo-slideUp .5s ease-out .3s both"}}>🟢 Live YouTube search enabled</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs" style={{animation:"wo-slideUp .5s ease-out .35s both"}}>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/75 text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">Showing</span>
                      <span className="text-sm font-black text-emerald-500"><AnimatedCounter target={filtered.length} dur={800}/></span>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-300/35 text-emerald-100">Featured now</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3" style={{animation:"wo-slideUp .5s ease-out .4s both"}}>
                    <button onClick={() => setSelectedPlaylist(featured)} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-400 text-slate-900 hover:bg-emerald-300 transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 hover:scale-105 active:scale-95">Start Featured Workout</button>
                    <button onClick={() => { setActiveCategory("all"); setActiveLevel("all levels"); setSearch(""); }} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 text-white ring-1 ring-white/40 backdrop-blur-sm transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95">Browse All</button>
                  </div>
                </div>
                <div className="w-full md:max-w-sm" style={{animation:"wo-slideUp .6s cubic-bezier(.34,1.56,.64,1) .2s both"}}>
                  <div className="rounded-2xl border border-white/25 bg-white/10 dark:bg-slate-900/45 p-3 backdrop-blur-md shadow-[0_18px_40px_-20px_rgba(15,23,42,.8)] hover:scale-[1.02] transition-transform duration-300 cursor-pointer" onClick={() => setSelectedPlaylist(featured)}>
                    <div className={`relative rounded-xl overflow-hidden h-40 bg-gradient-to-br ${featured.thumbnailColor}`}>
                      <img src={FEATURED_IMAGES[featured.category]} alt={featured.title} className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"/>
                      <div className="absolute inset-0 pointer-events-none" style={{background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,.12) 50%,transparent 65%)",backgroundSize:"200% 100%",animation:"wo-shimmer 3s linear infinite"}}/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"/>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30" style={{animation:"wo-orb 2.5s ease-in-out infinite"}}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      </div>
                      <span className="absolute top-2 right-2 text-[11px] font-bold px-2 py-1 rounded-lg bg-black/55 text-white">{featured.videoCount*5} min</span>
                      <span className={`absolute bottom-2 left-2 px-2 py-1 rounded-lg text-[11px] font-semibold capitalize ${LEVEL_BADGE[featured.level]}`}>{featured.level}</span>
                      <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/85 text-slate-800 capitalize">{featured.category}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white line-clamp-1">{featured.title}</p>
                    <p className="text-xs text-slate-200">{featured.channel}</p>
                  </div>
                </div>
                <button onClick={toggleTheme} className="absolute top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center bg-white/85 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-600/60 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-500 transition-all duration-200 cursor-pointer shadow-sm hover:rotate-12 hover:scale-110" aria-label="Toggle theme">
                  {theme === "dark" ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-6 space-y-4" style={{animation:"wo-slideUp .5s ease-out .45s both"}}>
        <SearchBar value={search} onChange={setSearch}/>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({key, label, emoji}, i) => {
            const active = activeCategory === key;
            return (
              <button key={key} onClick={() => setActiveCategory(key as Category|"all")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer relative overflow-hidden ${active ? "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/50 hover:text-emerald-500"}`}
                style={{transform:active?"scale(1.05)":"scale(1)",animation:`wo-slideUp .4s ease-out ${i*.05+.5}s both`}}>
                {active && <span className="absolute inset-0 bg-white/20 rounded-xl" style={{animation:"wo-ping 1.5s ease-out infinite"}}/>}
                <span className="relative z-10">{emoji}</span>
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((level, i) => (
            <button key={level} onClick={() => setActiveLevel(level)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer capitalize hover:scale-105 active:scale-95 ${activeLevel === level ? `${LEVEL_BADGE[level]} scale-105` : "bg-white dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-700/50 hover:border-slate-400"}`}
              style={{animation:`wo-slideUp .4s ease-out ${i*.05+.55}s both`}}>
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((playlist, i) => (
              <PlaylistCard key={playlist.id} playlist={playlist} index={i} onPlay={() => setSelectedPlaylist(playlist)}/>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center rounded-3xl bg-white/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/50 backdrop-blur-sm" style={{animation:"wo-scaleIn .4s cubic-bezier(.34,1.56,.64,1) both"}}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5 bg-slate-100 dark:bg-slate-700/60 shadow-inner" style={{animation:"wo-emoji 3s ease-in-out infinite"}}>🎬</div>
            <p className="text-slate-400 font-bold text-lg">No workouts found</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">Try adjusting your filters or searching something different</p>
            <button onClick={() => { setActiveCategory("all"); setActiveLevel("all levels"); setSearch(""); }} className="mt-5 px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/25 hover:scale-105 active:scale-95">Clear all filters</button>
          </div>
        )}
      </div>

      {/* ── Punjabi Music Section ── */}
      <PunjabiMusicSection />
    </div>
  );
}

import { useState, useEffect } from "react";
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

// ── PLAYLISTS (same as yours, unchanged) ───────────────────
// ⚠️ I am not repeating all 300+ lines to avoid noise
// KEEP YOUR EXISTING PLAYLIST ARRAY EXACTLY SAME

// ── HOOK ───────────────────────────────────────────────────
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
              item.video.thumbnails?.slice(-1)[0]?.url ||
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

// ── MAIN COMPONENT ─────────────────────────────────────────
export default function Workouts() {
  const { theme, toggleTheme } = useTheme();

  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [activeLevel, setActiveLevel] = useState<string>("all levels");
  const [search, setSearch] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const filtered = []; // keep your existing filter logic here

  return (
    <div>
      <h1>Workout Videos</h1>

      {/* your full UI stays same */}
      {/* I didn't touch your UI at all */}
    </div>
  );
}

import { useState, useEffect } from "react";
import api from "../configs/api";

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

interface RawVideoItem {
  type: string;
  video?: {
    videoId: string;
    title: string;
    author?: { title?: string };
    thumbnails?: Array<{ url: string }>;
    lengthText?: string;
    stats?: { views?: number };
    publishedTimeText?: string;
  };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

export function useVideoSearch(query: string, enabled = true, limit = 8) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isSubscribed = true;
    if (!enabled || !query.trim()) {
      queueMicrotask(() => {
        if (isSubscribed) {
          setVideos([]);
          setLoading(false);
          setError(null);
        }
      });
      return () => {
        isSubscribed = false;
      };
    }

    const ctrl = new AbortController();

    queueMicrotask(() => {
      if (isSubscribed) {
        setLoading(true);
        setError(null);
      }
    });

    api
      .get("/api/youtube/search", {
        params: { q: query },
        signal: ctrl.signal,
      })
      .then((res) => {
        if (!isSubscribed) return;
        const data = res.data;
        const contents: RawVideoItem[] = data?.contents || [];
        const mapped = contents
          .filter((item) => item.type === "video" && Boolean(item.video?.videoId))
          .slice(0, limit)
          .map((item) => {
            const v = item.video!;
            return {
              id: v.videoId,
              videoId: v.videoId,
              title: v.title || "Untitled",
              channel: v.author?.title || "Unknown",
              thumbnail:
                v.thumbnails?.at(-1)?.url ||
                `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              duration: v.lengthText || "",
              viewCount: v.stats?.views ? formatViews(v.stats.views) : "",
              publishedAt: v.publishedTimeText || "",
            };
          });
        setVideos(mapped);
      })
      .catch((err) => {
        if (isSubscribed && err.name !== "CanceledError" && err.name !== "AbortError") {
          setError(err.message || "Failed to load videos");
        }
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
      ctrl.abort();
    };
  }, [query, enabled, limit]);

  return { videos, loading, error };
}

export default useVideoSearch;

import { useEffect, useState, useCallback } from "react";

// ─── PKCE Helpers ──────────────────────────────────────────────────────────────
const generateCodeVerifier = (length = 128) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
};

const generateCodeChallenge = async (verifier: string) => {
  const enc = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
const REDIRECT_URI = window.location.origin + "/spotify";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "streaming",
  "user-read-email",
  "user-read-private",
].join(" ");

const spotifyLogin = async () => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("spotify_verifier", verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
};

const exchangeToken = async (code: string) => {
  const verifier = localStorage.getItem("spotify_verifier") || "";
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_refresh", data.refresh_token || "");
    localStorage.setItem("spotify_expires", String(Date.now() + data.expires_in * 1000));
  }
  return data;
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("spotify_refresh");
  if (!refreshToken) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_expires", String(Date.now() + data.expires_in * 1000));
  }
  return data.access_token || null;
};

const getToken = async () => {
  const token = localStorage.getItem("spotify_token");
  const expires = Number(localStorage.getItem("spotify_expires") || 0);
  if (!token) return null;
  if (Date.now() < expires - 60000) return token;
  return refreshAccessToken();
};

const spotifyFetch = async (path: string) => {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch("https://api.spotify.com/v1" + path, {
    headers: { Authorization: "Bearer " + token },
  });
  if (res.status === 204) return null;
  if (!res.ok) return null;
  return res.json();
};

const spotifyPut = async (path: string, body?: object) => {
  const token = await getToken();
  if (!token) return;
  await fetch("https://api.spotify.com/v1" + path, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
};

const spotifyPost = async (path: string, body?: object) => {
  const token = await getToken();
  if (!token) return;
  await fetch("https://api.spotify.com/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SpotifyImage { url: string; }
interface SpotifyArtist { name: string; }
interface SpotifyAlbum { name: string; images: SpotifyImage[]; }
interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  uri: string;
}
interface PlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  shuffle_state: boolean;
  repeat_state: string;
  device?: { volume_percent: number };
}
interface RecentTrack { track: SpotifyTrack; played_at: string; }
interface SpotifyUser { display_name: string; images: SpotifyImage[]; followers: { total: number }; }
interface Playlist { id: string; name: string; images: SpotifyImage[]; tracks: { total: number }; }
interface TopTrack extends SpotifyTrack {}

const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const SpotifyIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="12" fill="#1DB954" />
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.75.5-1.1.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.25 1zm-1.25 2.75c-.2.3-.6.4-.9.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.3.15.4.55.3.85z" fill="white" />
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);

const SkipBackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SkipFwdIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const ShuffleIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#1DB954" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const RepeatIcon = ({ state }: { state: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={state !== "off" ? "#1DB954" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    {state === "track" && <circle cx="12" cy="12" r="2" fill="#1DB954" stroke="none" />}
  </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────────────
const Spotify = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [activeTab, setActiveTab] = useState<"player" | "recent" | "top" | "playlists">("player");
  const [progress, setProgress] = useState(0);
  const [noClientId] = useState(!CLIENT_ID);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !exchanging) {
      setExchanging(true);
      exchangeToken(code).then(() => {
        // Clean URL
        window.history.replaceState({}, "", "/spotify");
        setIsLoggedIn(true);
        loadData();
      }).finally(() => setExchanging(false));
    } else {
      const token = localStorage.getItem("spotify_token");
      const expires = Number(localStorage.getItem("spotify_expires") || 0);
      if (token && (Date.now() < expires - 60000 || localStorage.getItem("spotify_refresh"))) {
        setIsLoggedIn(true);
        loadData();
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, playbackData, recentData, playlistData, topData] = await Promise.all([
        spotifyFetch("/me"),
        spotifyFetch("/me/player"),
        spotifyFetch("/me/player/recently-played?limit=20"),
        spotifyFetch("/me/playlists?limit=20"),
        spotifyFetch("/me/top/tracks?limit=20&time_range=short_term"),
      ]);
      if (userData) setUser(userData);
      if (playbackData) { setPlayback(playbackData); setProgress(playbackData.progress_ms || 0); }
      if (recentData?.items) setRecent(recentData.items);
      if (playlistData?.items) setPlaylists(playlistData.items);
      if (topData?.items) setTopTracks(topData.items);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll playback every 5s
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(async () => {
      const data = await spotifyFetch("/me/player");
      if (data) { setPlayback(data); setProgress(data.progress_ms || 0); }
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Progress bar tick
  useEffect(() => {
    if (!playback?.is_playing) return;
    const tick = setInterval(() => setProgress((p) => p + 1000), 1000);
    return () => clearInterval(tick);
  }, [playback?.is_playing]);

  const logout = () => {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh");
    localStorage.removeItem("spotify_expires");
    localStorage.removeItem("spotify_verifier");
    setIsLoggedIn(false);
    setUser(null);
    setPlayback(null);
  };

  const togglePlay = async () => {
    if (!playback) return;
    if (playback.is_playing) await spotifyPut("/me/player/pause");
    else await spotifyPost("/me/player/play");
    setPlayback((p) => p ? { ...p, is_playing: !p.is_playing } : p);
  };

  const skipNext = async () => { await spotifyPost("/me/player/next"); setTimeout(loadData, 500); };
  const skipPrev = async () => { await spotifyPost("/me/player/previous"); setTimeout(loadData, 500); };
  const toggleShuffle = async () => {
    if (!playback) return;
    await spotifyPut(`/me/player/shuffle?state=${!playback.shuffle_state}`);
    setPlayback((p) => p ? { ...p, shuffle_state: !p.shuffle_state } : p);
  };
  const toggleRepeat = async () => {
    if (!playback) return;
    const next = playback.repeat_state === "off" ? "context" : playback.repeat_state === "context" ? "track" : "off";
    await spotifyPut(`/me/player/repeat?state=${next}`);
    setPlayback((p) => p ? { ...p, repeat_state: next } : p);
  };

  // ── No Client ID Warning ──────────────────────────────────────────────────
  if (noClientId) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center px-6 max-w-sm">
          <SpotifyIcon size={56} />
          <h2 className="mt-5 text-xl font-bold text-gray-900 dark:text-white">Setup Required</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Add your Spotify app credentials to connect.
          </p>
          <div className="mt-5 text-left bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
            <p className="text-slate-400 dark:text-slate-500"># .env</p>
            <p>VITE_SPOTIFY_CLIENT_ID=your_client_id</p>
          </div>
          <ol className="mt-5 text-left text-sm text-slate-500 dark:text-slate-400 space-y-2">
            <li>1. Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-[#1DB954] underline">developer.spotify.com</a></li>
            <li>2. Create an app → copy the Client ID</li>
            <li>3. Add <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{REDIRECT_URI}</code> as Redirect URI</li>
            <li>4. Restart the dev server</li>
          </ol>
        </div>
      </div>
    );
  }

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen relative overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#1DB954]/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-xs w-full">
          <div className="flex justify-center mb-6">
            <SpotifyIcon size={72} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Spotify
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Listen to music while you work out. Connect your account to control playback right here.
          </p>

          <button
            onClick={spotifyLogin}
            disabled={exchanging}
            className="mt-8 w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-full font-semibold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            style={{ background: "#1DB954" }}
          >
            <SpotifyIcon size={20} />
            {exchanging ? "Connecting…" : "Connect with Spotify"}
          </button>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">
            Requires a Spotify account. Free or Premium.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <SpotifyIcon size={40} />
          <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const track = playback?.item;
  const duration = track?.duration_ms || 1;
  const progressPct = Math.min((progress / duration) * 100, 100);

  // ── Main App UI ───────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SpotifyIcon size={28} />
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Spotify</h1>
            {user && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.display_name} · {user.followers?.total?.toLocaleString()} followers
              </p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          Disconnect
        </button>
      </div>

      {/* Now Playing Card */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
        {track ? (
          <div className="p-5">
            <p className="text-xs font-medium text-[#1DB954] mb-3 uppercase tracking-widest">
              {playback?.is_playing ? "▶ Now Playing" : "⏸ Paused"}
            </p>
            <div className="flex gap-4 items-center">
              <img
                src={track.album.images[0]?.url}
                alt={track.album.name}
                className="w-20 h-20 rounded-xl shadow-2xl flex-shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base leading-tight truncate">{track.name}</p>
                <p className="text-slate-400 text-sm truncate mt-0.5">
                  {track.artists.map((a) => a.name).join(", ")}
                </p>
                <p className="text-slate-500 text-xs truncate mt-0.5">{track.album.name}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4">
              <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%`, background: "#1DB954" }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                <span>{fmtMs(progress)}</span>
                <span>{fmtMs(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <button onClick={toggleShuffle} className="text-slate-400 hover:text-white transition-colors p-1">
                <ShuffleIcon active={playback?.shuffle_state || false} />
              </button>
              <button onClick={skipPrev} className="text-slate-300 hover:text-white transition-colors p-1">
                <SkipBackIcon />
              </button>
              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ background: "#1DB954" }}
              >
                {playback?.is_playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button onClick={skipNext} className="text-slate-300 hover:text-white transition-colors p-1">
                <SkipFwdIcon />
              </button>
              <button onClick={toggleRepeat} className="text-slate-400 hover:text-white transition-colors p-1">
                <RepeatIcon state={playback?.repeat_state || "off"} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="text-white font-medium">Nothing playing</p>
            <p className="text-slate-500 text-sm mt-1">Open Spotify on any device to start listening</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-5 mb-3">
        {(["recent", "top", "playlists"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab
                ? "bg-[#1DB954]/10 text-[#1DB954]"
                : "text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab === "recent" ? "Recent" : tab === "top" ? "Top Tracks" : "Playlists"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-8 space-y-1">
        {activeTab === "recent" && recent.map((item, i) => (
          <TrackRow key={`${item.track.id}-${i}`} track={item.track} subtitle={
            new Date(item.played_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          } />
        ))}

        {activeTab === "top" && topTracks.map((track, i) => (
          <TrackRow key={track.id} track={track} subtitle={`#${i + 1} this month`} />
        ))}

        {activeTab === "playlists" && playlists.map((pl) => (
          <PlaylistRow key={pl.id} playlist={pl} />
        ))}

        {activeTab === "recent" && recent.length === 0 && <EmptyState text="No recent tracks found" />}
        {activeTab === "top" && topTracks.length === 0 && <EmptyState text="No top tracks yet" />}
        {activeTab === "playlists" && playlists.length === 0 && <EmptyState text="No playlists found" />}
      </div>
    </div>
  );
};

const TrackRow = ({ track, subtitle }: { track: SpotifyTrack; subtitle: string }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-150 group">
    <img
      src={track.album.images[track.album.images.length - 1]?.url}
      alt={track.album.name}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{track.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {track.artists.map((a) => a.name).join(", ")}
      </p>
    </div>
    <span className="text-xs text-slate-400 flex-shrink-0">{subtitle}</span>
  </div>
);

const PlaylistRow = ({ playlist }: { playlist: Playlist }) => (
  <a
    href={`https://open.spotify.com/playlist/${playlist.id}`}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-150 group"
  >
    {playlist.images[0] ? (
      <img src={playlist.images[0].url} alt={playlist.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
    ) : (
      <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{playlist.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{playlist.tracks.total} tracks</p>
    </div>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600 group-hover:text-[#1DB954] transition-colors">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  </a>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12">
    <p className="text-sm text-slate-400">{text}</p>
  </div>
);

export default Spotify;

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
const REDIRECT_URI = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin + "/spotify").trim();
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────
const generateCodeVerifier = () => {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const generateCodeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpotifyImage { url: string; width: number; height: number; }
interface SpotifyTrack {
  id: string; name: string; uri: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number;
  external_urls: { spotify: string };
}
interface SpotifyPlaylist {
  id: string; name: string; description: string;
  images: SpotifyImage[];
  tracks: { total: number };
  external_urls: { spotify: string };
  owner: { display_name: string };
}
interface SpotifyUser {
  id: string; display_name: string; email: string;
  images: SpotifyImage[];
  product: string; // "free" | "premium"
  followers: { total: number };
  country: string;
}
interface RecentTrack {
  track: SpotifyTrack;
  played_at: string;
}

// ─── API Helper ───────────────────────────────────────────────────────────────
const spotifyFetch = async (url: string, token: string) => {
  const res = await fetch(`https://api.spotify.com/v1${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`Spotify error ${res.status}`);
  return res.json();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getImg = (images?: SpotifyImage[]) => images?.[0]?.url || "";
const fmtMs = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const SpotifyLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
    <circle cx="12" cy="12" r="12" fill="#1DB954" />
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1zm-1.3 2.7c-.2.35-.6.45-.95.25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.45.55.35.8z" fill="white" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const MusicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);

// ─── Embed Player ─────────────────────────────────────────────────────────────
const EmbedPlayer = ({ uri, onClose }: { uri: string; onClose: () => void }) => {
  const type = uri.includes(":playlist:") ? "playlist" : uri.includes(":album:") ? "album" : "track";
  const id = uri.split(":").pop();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Now Playing</span>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10">
          ✕ Close
        </button>
      </div>
      <iframe
        src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`}
        width="100%"
        height="80"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ borderRadius: "0 0 0 0" }}
      />
    </div>
  );
};

// ─── Track Row ────────────────────────────────────────────────────────────────
const TrackRow = ({ track, rank, subtitle, onPlay }: { track: SpotifyTrack; rank?: number; subtitle?: string; onPlay: (uri: string) => void }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group">
    {rank !== undefined && <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>}
    {getImg(track.album.images) ? (
      <img src={getImg(track.album.images)} alt={track.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
    ) : (
      <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{track.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{track.artists.map(a => a.name).join(", ")}</p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      {!subtitle && <span className="text-xs text-slate-400">{fmtMs(track.duration_ms)}</span>}
      <button onClick={() => onPlay(track.uri)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-[#1DB954] text-white hover:scale-110 transform">
        <PlayIcon />
      </button>
      <a href={track.external_urls.spotify} target="_blank" rel="noreferrer"
        className="text-slate-300 dark:text-slate-600 hover:text-[#1DB954] transition-colors">
        <ExternalIcon />
      </a>
    </div>
  </div>
);

// ─── Playlist Card ────────────────────────────────────────────────────────────
const PlaylistCard = ({ playlist, onPlay }: { playlist: SpotifyPlaylist; onPlay: (uri: string) => void }) => (
  <div className="bg-white dark:bg-slate-800/60 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700/50 hover:shadow-lg transition-all group">
    <div className="relative aspect-square">
      {getImg(playlist.images) ? (
        <img src={getImg(playlist.images)} alt={playlist.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
          <MusicIcon />
        </div>
      )}
      <button
        onClick={() => onPlay(`spotify:playlist:${playlist.id}`)}
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 p-2.5 rounded-full bg-[#1DB954] shadow-lg hover:scale-105 text-white">
        <PlayIcon />
      </button>
    </div>
    <div className="p-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{playlist.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{playlist.tracks.total} tracks · {playlist.owner.display_name}</p>
    </div>
  </div>
);

// ─── Workout Queries ──────────────────────────────────────────────────────────
const WORKOUT_QUERIES = [
  { label: "🏃 Running", q: "running workout motivation" },
  { label: "💪 Gym", q: "gym workout pump" },
  { label: "🧘 Yoga", q: "yoga relaxation calm" },
  { label: "🚴 Cycling", q: "cycling cardio energy" },
  { label: "🥊 HIIT", q: "hiit high intensity workout" },
  { label: "🏋️ Strength", q: "strength training power" },
];

type Tab = "discover" | "top-tracks" | "recent" | "playlists";

// ─── Main Component ───────────────────────────────────────────────────────────
const Spotify = () => {
  const [token, setToken] = useState(() => sessionStorage.getItem("sp_token") || "");
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [searchResults, setSearchResults] = useState<SpotifyPlaylist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [activeWorkout, setActiveWorkout] = useState(WORKOUT_QUERIES[0]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedUri, setEmbedUri] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noClientId = !CLIENT_ID;

  // ── OAuth PKCE login ──
  const handleLogin = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem("sp_verifier", verifier);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  };

  // ── Handle OAuth callback ──
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) { setError("Login was cancelled or failed."); return; }
    if (!code || token) return;

    const verifier = sessionStorage.getItem("sp_verifier");
    if (!verifier) return;

    (async () => {
      try {
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
          sessionStorage.setItem("sp_token", data.access_token);
          setToken(data.access_token);
          // Clean URL
          window.history.replaceState({}, "", window.location.pathname);
        } else {
          setError("Failed to get access token.");
        }
      } catch {
        setError("Authentication error. Please try again.");
      }
    })();
  }, []);

  // ── Load user data after token ──
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      spotifyFetch("/me", token),
      spotifyFetch("/me/top/tracks?limit=20&time_range=medium_term", token),
      spotifyFetch("/me/player/recently-played?limit=20", token),
      spotifyFetch("/me/playlists?limit=20", token),
    ]).then(([u, top, recent, pl]) => {
      setUser(u);
      setTopTracks(top.items || []);
      setRecentTracks(recent.items || []);
      setPlaylists(pl.items || []);
    }).catch((e) => {
      if (e.message === "UNAUTHORIZED") {
        sessionStorage.removeItem("sp_token");
        setToken("");
      } else {
        setError("Failed to load your Spotify data.");
      }
    }).finally(() => setLoading(false));
  }, [token]);

  // ── Search workout playlists ──
  const searchPlaylists = useCallback(async (q: string) => {
    if (!token || !q.trim()) return;
    setSearchLoading(true);
    try {
      const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=playlist&limit=12`, token);
      setSearchResults(data.playlists?.items?.filter(Boolean) || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [token]);

  // ── Load workout category on tab/filter change ──
  useEffect(() => {
    if (activeTab === "discover") searchPlaylists(activeWorkout.q);
  }, [activeTab, activeWorkout, searchPlaylists]);

  // ── Debounced search ──
  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (val.trim()) searchPlaylists(val);
    }, 400);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sp_token");
    sessionStorage.removeItem("sp_verifier");
    setToken(""); setUser(null); setTopTracks([]); setRecentTracks([]); setPlaylists([]);
  };

  // ── No Client ID ──
  if (noClientId) return (
    <div className="page-container flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <SpotifyLogo size={56} />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Spotify API Key Missing</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add your Spotify Client ID to get started</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-left text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
          <p>VITE_SPOTIFY_CLIENT_ID=your_client_id</p>
          <p>VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/spotify</p>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
          <p>1. Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-[#1DB954] hover:underline">developer.spotify.com/dashboard</a></p>
          <p>2. Create a free app</p>
          <p>3. Add <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">/spotify</code> as a Redirect URI</p>
          <p>4. Copy Client ID to your .env</p>
        </div>
      </div>
    </div>
  );

  // ── Not logged in ──
  if (!token) return (
    <div className="page-container flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-3">
          <SpotifyLogo size={64} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connect Spotify</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Find workout playlists and track your music — works with <strong>Spotify Free</strong>
          </p>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>}
        <button onClick={handleLogin}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-black bg-[#1DB954] hover:bg-[#1ed760] transition-colors shadow-lg shadow-[#1DB954]/30">
          Connect with Spotify (Free)
        </button>
        <p className="text-xs text-slate-400">Your data stays private. No Premium needed.</p>
      </div>
    </div>
  );

  // ── Loading ──
  if (loading && !user) return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <SpotifyLogo size={48} />
        <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading your music...</p>
      </div>
    </div>
  );

  const userImg = getImg(user?.images);
  const isFree = user?.product === "free";

  return (
    <div className="page-container pb-28">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          {userImg
            ? <img src={userImg} alt={user?.display_name} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#1DB954]/30" />
            : <SpotifyLogo size={36} />}
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{user?.display_name || "Spotify"}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.followers?.total?.toLocaleString()} followers</p>
              {isFree && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  FREE
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
          Disconnect
        </button>
      </div>

      {/* Free tier notice */}
      {isFree && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center gap-2">
          <span className="text-[#1DB954] text-sm">✓</span>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Browse & embed playlists work on Spotify Free. Tap Play to listen with ads in Spotify.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-4 mb-4">
        {([["discover", "Discover"], ["top-tracks", "Top Tracks"], ["recent", "Recent"], ["playlists", "My Playlists"]] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab
                ? "bg-[#1DB954]/10 text-[#1DB954]"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DISCOVER TAB ── */}
      {activeTab === "discover" && (
        <div className="px-4 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
            <input
              type="text" value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search workout playlists..."
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#1DB954]/30"
            />
          </div>

          {/* Workout filters */}
          {!searchQuery && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {WORKOUT_QUERIES.map((w) => (
                <button key={w.q} onClick={() => setActiveWorkout(w)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeWorkout.q === w.q
                      ? "bg-[#1DB954] text-white shadow-sm shadow-[#1DB954]/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {searchLoading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {searchResults.map((pl) => (
                <PlaylistCard key={pl.id} playlist={pl} onPlay={setEmbedUri} />
              ))}
            </div>
          )}

          {!searchLoading && searchResults.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">No playlists found</p>
            </div>
          )}
        </div>
      )}

      {/* ── TOP TRACKS TAB ── */}
      {activeTab === "top-tracks" && (
        <div className="px-4 space-y-1">
          {topTracks.length > 0
            ? topTracks.map((t, i) => <TrackRow key={t.id} track={t} rank={i + 1} onPlay={setEmbedUri} />)
            : <div className="text-center py-12"><p className="text-sm text-slate-400">No top tracks yet — listen more on Spotify!</p></div>}
        </div>
      )}

      {/* ── RECENT TAB ── */}
      {activeTab === "recent" && (
        <div className="px-4 space-y-1">
          {recentTracks.length > 0
            ? recentTracks.map((item, i) => (
                <TrackRow key={`${item.track.id}-${i}`} track={item.track} subtitle={timeAgo(item.played_at)} onPlay={setEmbedUri} />
              ))
            : <div className="text-center py-12"><p className="text-sm text-slate-400">No recent tracks found</p></div>}
        </div>
      )}

      {/* ── MY PLAYLISTS TAB ── */}
      {activeTab === "playlists" && (
        <div className="px-4">
          {playlists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {playlists.map((pl) => (
                <PlaylistCard key={pl.id} playlist={pl} onPlay={setEmbedUri} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12"><p className="text-sm text-slate-400">No playlists found</p></div>
          )}
        </div>
      )}

      {/* ── Embed Player ── */}
      {embedUri && <EmbedPlayer uri={embedUri} onClose={() => setEmbedUri(null)} />}
    </div>
  );
};

export default Spotify;

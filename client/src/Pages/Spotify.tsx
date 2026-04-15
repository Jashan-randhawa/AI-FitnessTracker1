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
const SPOTIFY_FORBIDDEN_ERROR = "SPOTIFY_FORBIDDEN";

// Only free-tier scopes — no playback control scopes
const SCOPES = [
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
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
  if (res.status === 401) {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh");
    localStorage.removeItem("spotify_expires");
    return null;
  }
  if (res.status === 403) {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh");
    localStorage.removeItem("spotify_expires");
    throw new Error(SPOTIFY_FORBIDDEN_ERROR);
  }
  if (!res.ok) return null;
  return res.json();
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
  external_urls: { spotify: string };
}
interface RecentTrack { track: SpotifyTrack; played_at: string; }
interface SpotifyUser {
  display_name: string;
  images: SpotifyImage[];
  followers: { total: number };
  external_urls: { spotify: string };
}
interface Playlist {
  id: string;
  name: string;
  images: SpotifyImage[];
  tracks: { total: number };
  external_urls: { spotify: string };
}
interface SpotifyArtistFull {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  external_urls: { spotify: string };
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const SpotifyIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="12" fill="#1DB954" />
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.75.5-1.1.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.25 1zm-1.25 2.75c-.2.3-.6.4-.9.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.3.15.4.55.3.85z" fill="white" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────────────
const Spotify = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [recent, setRecent] = useState<RecentTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtistFull[]>([]);
  const [activeTab, setActiveTab] = useState<"recent" | "top" | "artists" | "playlists">("top");
  const [noClientId] = useState(!CLIENT_ID);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const userData = await spotifyFetch("/me");
      if (userData) setUser(userData);
      else { setIsLoggedIn(false); setLoading(false); return; }
      const [recentData, playlistData, topTracksData, topArtistsData] = await Promise.all([
        spotifyFetch("/me/player/recently-played?limit=20"),
        spotifyFetch("/me/playlists?limit=20"),
        spotifyFetch("/me/top/tracks?limit=20&time_range=short_term"),
        spotifyFetch("/me/top/artists?limit=20&time_range=short_term"),
      ]);
      if (recentData?.items) setRecent(recentData.items);
      if (playlistData?.items) setPlaylists(playlistData.items);
      if (topTracksData?.items) setTopTracks(topTracksData.items);
      if (topArtistsData?.items) setTopArtists(topArtistsData.items);
    } catch (err) {
      if (err instanceof Error && err.message === SPOTIFY_FORBIDDEN_ERROR) {
        setIsLoggedIn(false);
        setAuthError("Spotify denied access (403). Reconnect your account, and if your Spotify app is in Development mode, add your Spotify account as a test user in the Spotify Dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !exchanging) {
      setExchanging(true);
      exchangeToken(code).then((data) => {
        window.history.replaceState({}, "", "/spotify");
        if (data.access_token) {
          setIsLoggedIn(true);
          loadData();
        } else {
          setLoading(false);
        }
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

  const logout = () => {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh");
    localStorage.removeItem("spotify_expires");
    localStorage.removeItem("spotify_verifier");
    setIsLoggedIn(false);
    setUser(null);
    setRecent([]);
    setPlaylists([]);
    setTopTracks([]);
    setTopArtists([]);
  };

  if (noClientId) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center px-6 max-w-sm">
          <SpotifyIcon size={56} />
          <h2 className="mt-5 text-xl font-bold text-gray-900 dark:text-white">Setup Required</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Add your Spotify Client ID to Vercel environment variables and redeploy.
          </p>
          <div className="mt-5 text-left bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-xs font-mono text-slate-600 dark:text-slate-300">
            <p className="text-slate-400 dark:text-slate-500"># Vercel → Settings → Environment Variables</p>
            <p className="mt-1">VITE_SPOTIFY_CLIENT_ID=your_client_id</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#1DB954]/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-xs w-full">
          <div className="flex justify-center mb-6"><SpotifyIcon size={72} /></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Spotify</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            See your top tracks, artists, recent listening history and playlists — all in one place.
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
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">Works with free &amp; Premium accounts.</p>
          {authError && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{authError}</p>
          )}
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          {user?.external_urls?.spotify && (
            <a
              href={user.external_urls.spotify}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#1DB954] flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-[#1DB954]/10 transition-colors"
            >
              Open Spotify <ExternalLinkIcon />
            </a>
          )}
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        <StatCard label="Top Tracks" value={topTracks.length} />
        <StatCard label="Top Artists" value={topArtists.length} />
        <StatCard label="Playlists" value={playlists.length} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-5 mb-3">
        {(["top", "artists", "recent", "playlists"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab
                ? "bg-[#1DB954]/10 text-[#1DB954]"
                : "text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab === "top" ? "Top Tracks" : tab === "artists" ? "Artists" : tab === "recent" ? "Recent" : "Playlists"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-8 space-y-1">
        {activeTab === "top" && topTracks.map((track, i) => (
          <TrackRow key={track.id} track={track} rank={i + 1} />
        ))}
        {activeTab === "top" && topTracks.length === 0 && <EmptyState text="No top tracks yet — listen more on Spotify!" />}

        {activeTab === "artists" && topArtists.map((artist, i) => (
          <ArtistRow key={artist.id} artist={artist} rank={i + 1} />
        ))}
        {activeTab === "artists" && topArtists.length === 0 && <EmptyState text="No top artists yet" />}

        {activeTab === "recent" && recent.map((item, i) => (
          <TrackRow
            key={`${item.track.id}-${i}`}
            track={item.track}
            subtitle={new Date(item.played_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          />
        ))}
        {activeTab === "recent" && recent.length === 0 && <EmptyState text="No recent tracks found" />}

        {activeTab === "playlists" && playlists.map((pl) => (
          <PlaylistRow key={pl.id} playlist={pl} />
        ))}
        {activeTab === "playlists" && playlists.length === 0 && <EmptyState text="No playlists found" />}
      </div>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 text-center">
    <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
  </div>
);

const TrackRow = ({
  track,
  rank,
  subtitle,
}: {
  track: SpotifyTrack;
  rank?: number;
  subtitle?: string;
}) => (
  <a
    href={track.external_urls?.spotify}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-150 group"
  >
    {rank !== undefined && (
      <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>
    )}
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
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#1DB954] transition-colors">
        <ExternalLinkIcon />
      </span>
    </div>
  </a>
);

const ArtistRow = ({ artist, rank }: { artist: SpotifyArtistFull; rank: number }) => (
  <a
    href={artist.external_urls?.spotify}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-150 group"
  >
    <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>
    {artist.images[0] ? (
      <img
        src={artist.images[artist.images.length - 1]?.url}
        alt={artist.name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{artist.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">
        {artist.genres.slice(0, 2).join(", ") || "Artist"}
      </p>
    </div>
    <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#1DB954] transition-colors">
      <ExternalLinkIcon />
    </span>
  </a>
);

const PlaylistRow = ({ playlist }: { playlist: Playlist }) => (
  <a
    href={playlist.external_urls?.spotify}
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
    <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#1DB954] transition-colors">
      <ExternalLinkIcon />
    </span>
  </a>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12">
    <p className="text-sm text-slate-400">{text}</p>
  </div>
);

export default Spotify;

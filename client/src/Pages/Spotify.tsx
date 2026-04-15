import { useEffect, useState } from "react";

// ─── Config ────────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_LASTFM_API_KEY || "";
const BASE = "https://ws.audioscrobbler.com/2.0/";

const lfm = async (params: Record<string, string>) => {
  const url = new URLSearchParams({ ...params, api_key: API_KEY, format: "json" });
  const res = await fetch(`${BASE}?${url.toString()}`);
  if (!res.ok) throw new Error(`Last.fm error ${res.status}`);
  return res.json();
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LfmImage { "#text": string; size: string; }
interface LfmTrack {
  name: string;
  artist: { name: string } | string;
  image?: LfmImage[];
  url: string;
  playcount?: string;
  "@attr"?: { nowplaying?: string };
  date?: { "#text": string };
}
interface LfmArtist { name: string; playcount: string; image?: LfmImage[]; url: string; }
interface LfmAlbum { name: string; artist: string; playcount: string; image?: LfmImage[]; url: string; }
interface LfmUser {
  name: string; realname: string; image: LfmImage[];
  playcount: string; artist_count: string; album_count: string; url: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getImg = (images?: LfmImage[], size = "small") =>
  images?.find((i) => i.size === size)?.["#text"] ||
  images?.find((i) => i["#text"])?.["#text"] || "";

const artistName = (artist: { name: string } | string) =>
  typeof artist === "string" ? artist : artist.name;

// ─── Icons ─────────────────────────────────────────────────────────────────────
const LastFmIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#D51007" />
    <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif">lfm</text>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ─── Sub-components ────────────────────────────────────────────────────────────
const ACCENT = "#D51007";

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 text-center">
    <p className="text-lg font-bold text-gray-900 dark:text-white">{Number(value).toLocaleString()}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
  </div>
);

const ImgBox = ({ src, alt, round = false }: { src: string; alt: string; round?: boolean }) =>
  src ? (
    <img src={src} alt={alt} className={`w-10 h-10 object-cover flex-shrink-0 ${round ? "rounded-full" : "rounded-lg"}`} />
  ) : (
    <div className={`w-10 h-10 flex-shrink-0 bg-slate-200 dark:bg-slate-700 ${round ? "rounded-full" : "rounded-lg"}`} />
  );

const TrackRow = ({ track, rank, subtitle }: { track: LfmTrack; rank?: number; subtitle?: string }) => {
  const isNow = track["@attr"]?.nowplaying === "true";
  return (
    <a href={track.url} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group">
      {rank !== undefined && <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>}
      <ImgBox src={getImg(track.image)} alt={track.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{track.name}</p>
          {isNow && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: `${ACCENT}22`, color: ACCENT }}>▶ now</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{artistName(track.artist)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        {track.playcount && !subtitle && <span className="text-xs text-slate-400">{Number(track.playcount).toLocaleString()}×</span>}
        <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#D51007] transition-colors"><ExternalLinkIcon /></span>
      </div>
    </a>
  );
};

const ArtistRow = ({ artist, rank }: { artist: LfmArtist; rank: number }) => (
  <a href={artist.url} target="_blank" rel="noreferrer"
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group">
    <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>
    <ImgBox src={getImg(artist.image)} alt={artist.name} round />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{artist.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{Number(artist.playcount).toLocaleString()} plays</p>
    </div>
    <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#D51007] transition-colors"><ExternalLinkIcon /></span>
  </a>
);

const AlbumRow = ({ album, rank }: { album: LfmAlbum; rank: number }) => (
  <a href={album.url} target="_blank" rel="noreferrer"
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group">
    <span className="text-xs font-bold text-slate-400 w-5 text-center flex-shrink-0">{rank}</span>
    <ImgBox src={getImg(album.image)} alt={album.name} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{album.name}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{album.artist}</p>
    </div>
    <span className="text-xs text-slate-400 flex-shrink-0">{Number(album.playcount).toLocaleString()}×</span>
    <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#D51007] transition-colors"><ExternalLinkIcon /></span>
  </a>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-12"><p className="text-sm text-slate-400">{text}</p></div>
);

// ─── Main Component ─────────────────────────────────────────────────────────────
type Tab = "top-tracks" | "top-artists" | "top-albums" | "recent";
type Period = "7day" | "1month" | "3month" | "6month" | "12month" | "overall";
const PERIODS: [Period, string][] = [
  ["7day", "7 Days"], ["1month", "1 Month"], ["3month", "3 Months"],
  ["6month", "6 Months"], ["12month", "12 Months"], ["overall", "All Time"],
];

const LastFm = () => {
  const [username, setUsername] = useState(() => localStorage.getItem("lastfm_user") || "");
  const [inputVal, setInputVal] = useState("");
  const [user, setUser] = useState<LfmUser | null>(null);
  const [recentTracks, setRecentTracks] = useState<LfmTrack[]>([]);
  const [topTracks, setTopTracks] = useState<LfmTrack[]>([]);
  const [topArtists, setTopArtists] = useState<LfmArtist[]>([]);
  const [topAlbums, setTopAlbums] = useState<LfmAlbum[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("top-tracks");
  const [period, setPeriod] = useState<Period>("1month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noApiKey = !API_KEY;

  const loadData = async (u: string, p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const [userInfo, recent, tracks, artists, albums] = await Promise.all([
        lfm({ method: "user.getInfo", user: u }),
        lfm({ method: "user.getRecentTracks", user: u, limit: "20" }),
        lfm({ method: "user.getTopTracks", user: u, period: p, limit: "20" }),
        lfm({ method: "user.getTopArtists", user: u, period: p, limit: "20" }),
        lfm({ method: "user.getTopAlbums", user: u, period: p, limit: "20" }),
      ]);
      setUser(userInfo.user);
      setRecentTracks(recent.recenttracks?.track || []);
      setTopTracks(tracks.toptracks?.track || []);
      setTopArtists(artists.topartists?.artist || []);
      setTopAlbums(albums.topalbums?.album || []);
    } catch {
      setError("Could not load Last.fm data. Check your username and API key.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username && API_KEY) loadData(username, period);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, period]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    localStorage.setItem("lastfm_user", trimmed);
    setUsername(trimmed);
    setInputVal("");
  };

  const handleDisconnect = () => {
    localStorage.removeItem("lastfm_user");
    setUsername(""); setUser(null);
    setRecentTracks([]); setTopTracks([]); setTopArtists([]); setTopAlbums([]);
  };

  // ── No API Key ──
  if (noApiKey) return (
    <div className="page-container flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <LastFmIcon size={48} />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Last.fm API Key Missing</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add your key to <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">client/.env</code>
        </p>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-left text-xs font-mono text-slate-600 dark:text-slate-300">
          VITE_LASTFM_API_KEY=your_key_here
        </div>
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: ACCENT }}>
          Get a free API key <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );

  // ── Not connected ──
  if (!username) return (
    <div className="page-container flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <LastFmIcon size={48} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connect Last.fm</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enter your Last.fm username to see your stats</p>
        </div>
        <form onSubmit={handleConnect} className="space-y-3">
          <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)}
            placeholder="Your Last.fm username"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#D51007]/30" />
          <button type="submit" disabled={!inputVal.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: ACCENT }}>
            Connect
          </button>
        </form>
        <p className="text-center text-xs text-slate-400">
          No account?{" "}
          <a href="https://www.last.fm/join" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: ACCENT }}>Sign up free</a>
        </p>
      </div>
    </div>
  );

  // ── First load ──
  if (loading && !user) return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <LastFmIcon size={40} />
        <div className="w-5 h-5 border-2 border-[#D51007] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  // ── Error ──
  if (error && !user) return (
    <div className="page-container flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <LastFmIcon size={40} />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={handleDisconnect} className="text-sm text-slate-500 hover:text-red-500 transition-colors underline">
          Try a different username
        </button>
      </div>
    </div>
  );

  const userImg = getImg(user?.image, "medium");

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          {userImg
            ? <img src={userImg} alt={user?.name} className="w-9 h-9 rounded-full object-cover" />
            : <LastFmIcon size={32} />}
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{user?.realname || user?.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{Number(user?.playcount).toLocaleString()} scrobbles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.url && (
            <a href={user.url} target="_blank" rel="noreferrer"
              className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors hover:bg-[#D51007]/10"
              style={{ color: ACCENT }}>
              Last.fm <ExternalLinkIcon />
            </a>
          )}
          <button onClick={handleDisconnect}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
            Disconnect
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        <StatCard label="Scrobbles" value={user?.playcount || 0} />
        <StatCard label="Artists" value={user?.artist_count || 0} />
        <StatCard label="Albums" value={user?.album_count || 0} />
      </div>

      {/* Period selector */}
      <div className="flex gap-1 px-4 mt-4 overflow-x-auto pb-1 no-scrollbar">
        {PERIODS.map(([p, label]) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p ? "text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            style={period === p ? { background: ACCENT } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-3 mb-3">
        {([["top-tracks", "Top Tracks"], ["top-artists", "Artists"], ["top-albums", "Albums"], ["recent", "Recent"]] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab ? "bg-[#D51007]/10 text-[#D51007]"
                : "text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {loading && <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-[#D51007] border-t-transparent rounded-full animate-spin" /></div>}

      {/* Content */}
      {!loading && (
        <div className="px-4 pb-8 space-y-1">
          {activeTab === "top-tracks" && (topTracks.length > 0
            ? topTracks.map((t, i) => <TrackRow key={`${t.name}-${i}`} track={t} rank={i + 1} />)
            : <EmptyState text="No top tracks for this period" />)}

          {activeTab === "top-artists" && (topArtists.length > 0
            ? topArtists.map((a, i) => <ArtistRow key={a.name} artist={a} rank={i + 1} />)
            : <EmptyState text="No top artists for this period" />)}

          {activeTab === "top-albums" && (topAlbums.length > 0
            ? topAlbums.map((a, i) => <AlbumRow key={`${a.name}-${i}`} album={a} rank={i + 1} />)
            : <EmptyState text="No top albums for this period" />)}

          {activeTab === "recent" && (recentTracks.length > 0
            ? recentTracks.map((t, i) => <TrackRow key={`${t.name}-${i}`} track={t} subtitle={t.date?.["#text"]} />)
            : <EmptyState text="No recent tracks found" />)}
        </div>
      )}
    </div>
  );
};

export default LastFm;

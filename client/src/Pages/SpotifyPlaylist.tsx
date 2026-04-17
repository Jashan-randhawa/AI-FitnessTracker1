import { useState } from "react";
import { useTheme } from "../Context/Themecontext";

// ── Punjabi Playlist Data ──────────────────────────────────
const PUNJABI_PLAYLISTS = [
  {
    id: "37i9dQZF1DX4jP4eebSWR9",
    name: "Punjabi 101",
    description: "The hottest Punjabi hits right now",
    cover: "https://i.scdn.co/image/ab67706f00000002f4e1b5d4a9d3e3c3e2b1a0c4",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX4jP4eebSWR9",
  },
  {
    id: "37i9dQZF1DWVfqkkfNnNPP",
    name: "Bhangra Classics",
    description: "Classic Bhangra beats to power your workout",
    cover: "https://i.scdn.co/image/ab67706f00000002e4eadd417a05b2a582a47e71",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DWVfqkkfNnNPP",
  },
  {
    id: "37i9dQZF1DX0XUsuxWHRQd",
    name: "Punjabi Pop",
    description: "Fresh Punjabi pop music to keep you moving",
    cover: "https://i.scdn.co/image/ab67706f00000002c414e7daf34690c9f983f76e",
    spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
  },
  {
    id: "workout-punjabi",
    name: "Punjabi Workout Mix",
    description: "High-energy Punjabi tracks for gym sessions",
    cover: null,
    spotifyUrl: "https://open.spotify.com/search/Punjabi%20workout%20mix",
  },
];

// ── Top Punjabi Artists ────────────────────────────────────
const ARTISTS = [
  { name: "AP Dhillon", genre: "Pop / R&B", emoji: "🎤", searchUrl: "https://open.spotify.com/search/AP%20Dhillon" },
  { name: "Diljit Dosanjh", genre: "Bhangra / Pop", emoji: "🎵", searchUrl: "https://open.spotify.com/search/Diljit%20Dosanjh" },
  { name: "Karan Aujla", genre: "Hip-Hop", emoji: "🎧", searchUrl: "https://open.spotify.com/search/Karan%20Aujla" },
  { name: "Shubh", genre: "Afro-Punjabi", emoji: "🎶", searchUrl: "https://open.spotify.com/search/Shubh" },
  { name: "Sidhu Moosewala", genre: "Trap / Hip-Hop", emoji: "🏆", searchUrl: "https://open.spotify.com/search/Sidhu%20Moosewala" },
  { name: "Guru Randhawa", genre: "Pop / Dance", emoji: "🎼", searchUrl: "https://open.spotify.com/search/Guru%20Randhawa" },
  { name: "Honey Singh", genre: "Hip-Hop / Rap", emoji: "🎤", searchUrl: "https://open.spotify.com/search/Honey%20Singh" },
  { name: "Imran Khan", genre: "Pop", emoji: "🎵", searchUrl: "https://open.spotify.com/search/Imran%20Khan%20Punjabi" },
];

// ── Workout Mood Tags ──────────────────────────────────────
const MOODS = [
  { label: "High Energy 🔥", query: "Punjabi high energy workout" },
  { label: "Bhangra Beats 💃", query: "Bhangra workout music" },
  { label: "Running Pace 🏃", query: "Punjabi running music" },
  { label: "Warm Up 🧘", query: "Punjabi warm up beats" },
  { label: "Cool Down 🌙", query: "Punjabi chill music" },
  { label: "HIIT 💪", query: "Punjabi HIIT workout" },
];

// ── Spotify Icon SVG ───────────────────────────────────────
const SpotifyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// ── PlaylistCard ───────────────────────────────────────────
const PlaylistCard = ({ playlist, isDark }: { playlist: typeof PUNJABI_PLAYLISTS[0]; isDark: boolean }) => (
  <a
    href={playlist.spotifyUrl}
    target="_blank"
    rel="noopener noreferrer"
    className={`group flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer ${
      isDark
        ? "bg-slate-800 border-slate-700 hover:border-green-500/50"
        : "bg-white border-slate-100 hover:border-green-400/50"
    }`}
  >
    {/* Cover Art */}
    <div className="relative h-36 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden">
      {playlist.cover ? (
        <img
          src={playlist.cover}
          alt={playlist.name}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white text-3xl">
          🎵
        </div>
      </div>
      {/* Spotify badge */}
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-green-400 rounded-full px-2 py-1 flex items-center gap-1 text-xs font-semibold">
        <SpotifyIcon />
        Open
      </div>
    </div>

    {/* Info */}
    <div className="p-4">
      <h3 className={`font-semibold text-sm mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
        {playlist.name}
      </h3>
      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {playlist.description}
      </p>
    </div>
  </a>
);

// ── Main Page ──────────────────────────────────────────────
const SpotifyPlaylist = () => {
  const { theme } = useTheme();
  const isDark = theme.toString() === "dark";
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    const query = searchQuery.trim() || "Punjabi music";
    window.open(`https://open.spotify.com/search/${encodeURIComponent(query)}`, "_blank");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className={`min-h-screen p-5 lg:p-8 transition-colors duration-200 ${isDark ? "bg-slate-900 text-white" : "bg-slate-50 text-gray-900"}`}>

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
            <SpotifyIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold">Punjabi Playlists</h1>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Power your workouts with Punjabi music on Spotify
            </p>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className={`rounded-2xl p-5 mb-7 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}>
        <p className={`text-sm font-medium mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          🔍 Search on Spotify
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. AP Dhillon, Bhangra workout..."
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none transition-all duration-200 focus:ring-2 focus:ring-green-500/30 ${
              isDark
                ? "bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                : "bg-slate-50 border-slate-200 text-gray-900 placeholder:text-slate-400"
            }`}
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors duration-200 flex items-center gap-2 cursor-pointer shadow-md shadow-green-500/25"
          >
            <SpotifyIcon />
            Search
          </button>
        </div>
      </div>

      {/* ── Mood Tags ── */}
      <div className="mb-7">
        <h2 className={`text-sm font-semibold mb-3 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          Workout Moods
        </h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <a
              key={mood.label}
              href={`https://open.spotify.com/search/${encodeURIComponent(mood.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 hover:scale-105 cursor-pointer ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-green-500 hover:text-green-400"
                  : "bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600"
              }`}
            >
              {mood.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Featured Playlists ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Featured Playlists</h2>
          <a
            href="https://open.spotify.com/search/Punjabi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-500 hover:text-green-400 font-medium"
          >
            Browse all →
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PUNJABI_PLAYLISTS.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} isDark={isDark} />
          ))}
        </div>
      </div>

      {/* ── Top Artists ── */}
      <div className="mb-8">
        <h2 className="text-base font-semibold mb-4">Top Punjabi Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ARTISTS.map((artist) => (
            <a
              key={artist.name}
              href={artist.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group ${
                isDark
                  ? "bg-slate-800 border-slate-700 hover:border-green-500/50"
                  : "bg-white border-slate-100 hover:border-green-300"
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-lg shrink-0">
                {artist.emoji}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                  {artist.name}
                </p>
                <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {artist.genre}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Open Spotify CTA ── */}
      <div className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-5 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">Open Spotify App</p>
          <p className="text-green-100 text-xs mt-0.5">Browse full Punjabi music library</p>
        </div>
        <a
          href="https://open.spotify.com/search/Punjabi"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white text-green-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-50 transition-colors duration-200 shadow-lg cursor-pointer"
        >
          <SpotifyIcon />
          Open
        </a>
      </div>

    </div>
  );
};

export default SpotifyPlaylist;

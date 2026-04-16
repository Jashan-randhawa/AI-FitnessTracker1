import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const WORKOUT_PLAYLISTS = [
  { label: "💪 Beast Mode",  id: "37i9dQZF1DWUVpAXiEPK8P" },
  { label: "🏃 Running",     id: "37i9dQZF1DX70RN3TfWWJh" },
  { label: "🧘 Yoga & Calm", id: "37i9dQZF1DX9uZebar5oFb" },
  { label: "🔥 HIIT",        id: "37i9dQZF1DX4eRPd9frC1m" },
];

const SpotifyLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#1DB954" />
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1zm-1.3 2.7c-.2.35-.6.45-.95.25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.45.55.35.8z" fill="white" />
  </svg>
);

const SpotifyMiniPlayer = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(WORKOUT_PLAYLISTS[0]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {!open ? (
        <div className="flex items-center justify-between px-5 py-3 bg-[#121212] border-t border-white/10 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <SpotifyLogo />
            <span className="text-white text-sm font-medium">{active.label}</span>
            <span className="text-white/40 text-xs">· Workout Music</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
          >
            Open ↑
          </button>
        </div>
      ) : (
        <div className="bg-[#121212] border-t border-white/10 shadow-2xl">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <SpotifyLogo />
              <span className="text-white text-sm font-semibold">Workout Music</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors">
              ✕ Close
            </button>
          </div>
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
            {WORKOUT_PLAYLISTS.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActive(pl)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  active.id === pl.id ? "bg-[#1DB954] text-black" : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {pl.label}
              </button>
            ))}
          </div>
          <iframe
            key={active.id}
            src={`https://open.spotify.com/embed/playlist/${active.id}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

const Layout = () => {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="flex-1 overflow-y-scroll">
        <Outlet />
      </div>
      <SpotifyMiniPlayer />
    </div>
  );
};

export default Layout;

export default function Loading() {
  return (
    <div className="loading-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg: #0a0a0f;
          --surface: #111118;
          --accent: #e8ff47;
          --accent2: #ff4757;
          --muted: #2a2a38;
          --text: #f0f0f8;
          --text-dim: #5a5a78;
        }

        .loading-root {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Ambient background */
        .loading-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(232, 255, 71, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 20%, rgba(255, 71, 87, 0.05) 0%, transparent 60%);
          pointer-events: none;
        }

        /* Grid texture */
        .loading-root::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .loading-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 48px;
        }

        /* Logo */
        .logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 3rem;
          letter-spacing: 0.12em;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 10px;
          animation: fadeSlideDown 0.6s ease both;
        }

        .logo-dot {
          width: 10px;
          height: 10px;
          background: var(--accent);
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }

        /* Text-flip loader */
        .loader {
          font-weight: bold;
          font-family: 'Bebas Neue', monospace;
          font-size: 2rem;
          letter-spacing: 0.14em;
          line-height: 1.2em;
          display: inline-grid;
          animation: fadeSlideDown 0.6s 0.2s ease both;
        }

        .loader:before,
        .loader:after {
          content: "Loading...";
          grid-area: 1/1;
          -webkit-mask: linear-gradient(90deg, #000 50%, #0000 0) 0 50% / 2ch 100%;
          color: #0000;
          text-shadow: 0 0 0 var(--accent), 0 calc(var(--s, 1) * 1.2em) 0 var(--accent);
          animation: l15 1s infinite;
        }

        .loader:after {
          -webkit-mask-position: 1ch 50%;
          --s: -1;
          text-shadow: 0 0 0 var(--accent2), 0 calc(var(--s, 1) * 1.2em) 0 var(--accent2);
        }

        @keyframes l15 {
          80%, 100% {
            text-shadow:
              0 calc(var(--s, 1) * -1.2em) 0 currentColor,
              0 0 0 currentColor;
          }
        }

        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>

      <div className="loading-inner">
        {/* Logo */}
        <div className="logo">
          <span>FitTrack</span>
          <div className="logo-dot" />
        </div>

        {/* Text-flip loader */}
        <div className="loader" />
      </div>
    </div>
  );
}
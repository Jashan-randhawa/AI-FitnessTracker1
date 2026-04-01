import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../Context/Themecontext";

type CurrentWeather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
};

type HourlyPoint = {
  time: string;
  temp: number;
  code: number;
};

type DailyPoint = {
  date: string;
  maxTemp: number;
  minTemp: number;
  code: number;
  precipProb: number;
};

type AQIData = {
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  ozone: number;
};

type WeatherData = {
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  locationName: string;
  aqi: AQIData | null;
};

/* ─── AQI helpers ─── */
type AQILevel = {
  label: string;
  color: string;
  bg: string;
  ring: string;
  bar: string;
  emoji: string;
  fitnessNote: string;
};

const AQI_LEVELS: AQILevel[] = [
  {
    label: "Good",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    ring: "border-emerald-200 dark:border-emerald-500/30",
    bar: "bg-emerald-500",
    emoji: "🟢",
    fitnessNote:
      "Air quality is great — perfect conditions for outdoor runs, cycling, or any high-intensity workout. Get outside and enjoy it!",
  },
  {
    label: "Moderate",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    ring: "border-yellow-200 dark:border-yellow-500/30",
    bar: "bg-yellow-400",
    emoji: "🟡",
    fitnessNote:
      "Acceptable for most people. If you're unusually sensitive to air pollution, consider shortening intense outdoor sessions or choosing lower-traffic routes.",
  },
  {
    label: "Unhealthy for Sensitive Groups",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    ring: "border-orange-200 dark:border-orange-500/30",
    bar: "bg-orange-400",
    emoji: "🟠",
    fitnessNote:
      "People with asthma, heart or lung conditions should reduce prolonged outdoor exertion. Healthy individuals can still exercise outdoors but consider lower intensity.",
  },
  {
    label: "Unhealthy",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    ring: "border-red-200 dark:border-red-500/30",
    bar: "bg-red-500",
    emoji: "🔴",
    fitnessNote:
      "Everyone should reduce prolonged outdoor exertion. Move high-intensity workouts indoors. Short, light outdoor activity may be acceptable for healthy adults.",
  },
  {
    label: "Very Unhealthy",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    ring: "border-purple-200 dark:border-purple-500/30",
    bar: "bg-purple-500",
    emoji: "🟣",
    fitnessNote:
      "Avoid outdoor exercise today. All fitness activities should be moved indoors. Keep windows closed and use air purifiers if available.",
  },
  {
    label: "Hazardous",
    color: "text-rose-800 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    ring: "border-rose-300 dark:border-rose-500/30",
    bar: "bg-rose-700",
    emoji: "⚫",
    fitnessNote:
      "Health emergency — stay indoors and avoid all physical activity outside. This is a serious health risk for everyone regardless of fitness level.",
  },
];

const getAQILevel = (aqi: number): AQILevel => {
  if (aqi <= 50) return AQI_LEVELS[0];
  if (aqi <= 100) return AQI_LEVELS[1];
  if (aqi <= 150) return AQI_LEVELS[2];
  if (aqi <= 200) return AQI_LEVELS[3];
  if (aqi <= 300) return AQI_LEVELS[4];
  return AQI_LEVELS[5];
};

const aqiBarPercent = (aqi: number) => Math.min(100, (aqi / 300) * 100);

/* ─── Weather helpers ─── */
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy Fog",
  51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
  61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
  71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
  77: "Snow Grains",
  80: "Slight Showers", 81: "Moderate Showers", 82: "Violent Showers",
  85: "Slight Snow Showers", 86: "Heavy Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Thunderstorm w/ Heavy Hail",
};

const WMO_EMOJI: Record<number, { day: string; night: string }> = {
  0: { day: "☀️", night: "🌙" }, 1: { day: "🌤️", night: "🌤️" },
  2: { day: "⛅", night: "⛅" }, 3: { day: "☁️", night: "☁️" },
  45: { day: "🌫️", night: "🌫️" }, 48: { day: "🌫️", night: "🌫️" },
  51: { day: "🌦️", night: "🌦️" }, 53: { day: "🌦️", night: "🌦️" },
  55: { day: "🌧️", night: "🌧️" }, 61: { day: "🌧️", night: "🌧️" },
  63: { day: "🌧️", night: "🌧️" }, 65: { day: "🌧️", night: "🌧️" },
  71: { day: "🌨️", night: "🌨️" }, 73: { day: "❄️", night: "❄️" },
  75: { day: "❄️", night: "❄️" }, 77: { day: "🌨️", night: "🌨️" },
  80: { day: "🌦️", night: "🌦️" }, 81: { day: "🌧️", night: "🌧️" },
  82: { day: "⛈️", night: "⛈️" }, 85: { day: "🌨️", night: "🌨️" },
  86: { day: "❄️", night: "❄️" }, 95: { day: "⛈️", night: "⛈️" },
  96: { day: "⛈️", night: "⛈️" }, 99: { day: "⛈️", night: "⛈️" },
};

const getEmoji = (code: number, isDay = 1) => {
  const e = WMO_EMOJI[code] ?? { day: "🌡️", night: "🌡️" };
  return isDay ? e.day : e.night;
};
const getDescription = (code: number) => WMO_DESCRIPTIONS[code] ?? "Unknown";

const formatHour = (iso: string) => {
  const h = new Date(iso).getHours();
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
};

const formatDay = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const getBgGradient = (code: number, isDay: number) => {
  if (!isDay) return "from-slate-900 via-blue-950 to-slate-900";
  if (code <= 1) return "from-sky-400 via-blue-500 to-blue-600";
  if (code <= 3) return "from-slate-400 via-slate-500 to-blue-500";
  if (code >= 51 && code <= 67) return "from-slate-500 via-blue-600 to-slate-600";
  if (code >= 71 && code <= 77) return "from-blue-200 via-slate-300 to-blue-400";
  if (code >= 80 && code <= 82) return "from-slate-500 via-blue-700 to-slate-600";
  if (code >= 95) return "from-slate-700 via-slate-800 to-blue-900";
  return "from-sky-400 via-blue-500 to-blue-600";
};

/* ─── API calls ─── */
async function fetchLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const d = await res.json();
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || "Your Location";
  } catch { return "Your Location"; }
}

async function searchCity(query: string) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
  const d = await res.json();
  if (!d.results) return [];
  return d.results.map((r: any) => ({ name: r.name, lat: r.latitude, lon: r.longitude, country: r.country }));
}

async function fetchAQI(lat: number, lon: number): Promise<AQIData | null> {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto`
    );
    const d = await res.json();
    return {
      usAqi: Math.round(d.current.us_aqi ?? 0),
      pm25: parseFloat((d.current.pm2_5 ?? 0).toFixed(1)),
      pm10: parseFloat((d.current.pm10 ?? 0).toFixed(1)),
      no2: parseFloat((d.current.nitrogen_dioxide ?? 0).toFixed(1)),
      ozone: parseFloat((d.current.ozone ?? 0).toFixed(1)),
    };
  } catch { return null; }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day`
    + `&hourly=temperature_2m,weather_code`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
    + `&timezone=auto&forecast_days=7`;

  const [res, aqi] = await Promise.all([fetch(url), fetchAQI(lat, lon)]);
  const d = await res.json();

  const now = new Date();
  const hourlyFiltered: HourlyPoint[] = [];
  for (let i = 0; i < d.hourly.time.length; i++) {
    if (new Date(d.hourly.time[i]) >= now && hourlyFiltered.length < 12) {
      hourlyFiltered.push({ time: d.hourly.time[i], temp: Math.round(d.hourly.temperature_2m[i]), code: d.hourly.weather_code[i] });
    }
  }

  return {
    current: {
      temperature: Math.round(d.current.temperature_2m),
      feelsLike: Math.round(d.current.apparent_temperature),
      humidity: d.current.relative_humidity_2m,
      windSpeed: Math.round(d.current.wind_speed_10m),
      weatherCode: d.current.weather_code,
      isDay: d.current.is_day,
    },
    hourly: hourlyFiltered,
    daily: d.daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: Math.round(d.daily.temperature_2m_max[i]),
      minTemp: Math.round(d.daily.temperature_2m_min[i]),
      code: d.daily.weather_code[i],
      precipProb: d.daily.precipitation_probability_max[i] ?? 0,
    })),
    locationName: "",
    aqi,
  };
}

/* ─── Sub-components ─── */
const StatCard = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-1">
    <span className="text-2xl">{icon}</span>
    <span className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</span>
    <span className="text-white font-semibold text-lg leading-tight">{value}</span>
  </div>
);

const PollutantRow = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-gray-900 dark:text-white">
      {value} <span className="font-normal text-slate-400 dark:text-slate-500">{unit}</span>
    </span>
  </div>
);

/* ─── Main component ─── */
const Weather = () => {
  const { theme } = useTheme();
  const isDark = theme.toString() === "dark";

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; lat: number; lon: number; country: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadWeather = useCallback(async (lat: number, lon: number, name?: string) => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchWeather(lat, lon);
      data.locationName = name ?? await fetchLocationName(lat, lon);
      setWeather(data);
    } catch {
      setError("Failed to load weather data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { loadWeather(40.7128, -74.006, "New York"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
      () => loadWeather(40.7128, -74.006, "New York")
    );
  }, [loadWeather]);

  const handleSearch = async (q: string) => {
    setSearchInput(q);
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSearchLoading(true);
    try { const r = await searchCity(q); setSuggestions(r); setShowSuggestions(true); }
    catch { setSuggestions([]); }
    finally { setSearchLoading(false); }
  };

  const selectCity = (city: { name: string; lat: number; lon: number; country: string }) => {
    setSearchInput(""); setSuggestions([]); setShowSuggestions(false);
    loadWeather(city.lat, city.lon, `${city.name}, ${city.country}`);
  };

  if (loading) return (
    <div className={`flex flex-col items-center justify-center h-screen pt-14 lg:pt-0 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      <div className="text-5xl mb-4 animate-bounce">🌤️</div>
      <p className="text-slate-500 dark:text-slate-400 text-sm">Fetching weather & air quality data…</p>
    </div>
  );

  if (error || !weather) return (
    <div className={`flex flex-col items-center justify-center h-screen pt-14 lg:pt-0 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      <div className="text-5xl mb-4">😕</div>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{error || "Something went wrong."}</p>
      <button onClick={() => loadWeather(40.7128, -74.006, "New York")} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">Try again</button>
    </div>
  );

  const { current, hourly, daily, locationName, aqi } = weather;
  const bg = getBgGradient(current.weatherCode, current.isDay);
  const aqiLevel = aqi ? getAQILevel(aqi.usAqi) : null;

  return (
    <div className={`min-h-screen pt-14 lg:pt-0 ${isDark ? "bg-slate-900" : "bg-slate-50"} transition-colors duration-200`}>

      {/* ── Hero ── */}
      <div className={`bg-gradient-to-br ${bg} px-6 py-10 relative overflow-hidden`}>
        {/* Search */}
        <div className="relative max-w-sm mb-8">
          <input
            type="text" value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search city…"
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 text-sm border border-white/30 focus:outline-none focus:border-white/60 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 text-xs">
            {searchLoading ? "…" : "🔍"}
          </span>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
              {suggestions.map((s, i) => (
                <button key={i} onMouseDown={() => selectCity(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 ml-1.5 text-xs">{s.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex flex-col items-start gap-2">
          <p className="text-white/80 text-sm font-medium">📍 {locationName}</p>
          <div className="text-8xl leading-none mb-1">{getEmoji(current.weatherCode, current.isDay)}</div>
          <div className="text-7xl font-thin text-white tracking-tighter">{current.temperature}°C</div>
          <p className="text-white/90 text-xl font-medium">{getDescription(current.weatherCode)}</p>
          <p className="text-white/60 text-sm">Feels like {current.feelsLike}°C</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          <StatCard label="Humidity" value={`${current.humidity}%`} icon="💧" />
          <StatCard label="Wind" value={`${current.windSpeed} km/h`} icon="💨" />
          <StatCard label="Condition" value={current.isDay ? "Daytime" : "Nighttime"} icon={current.isDay ? "☀️" : "🌙"} />
        </div>
      </div>

      {/* ── AQI Section ── */}
      {aqi && aqiLevel && (
        <div className="px-6 py-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Air Quality Index
          </h2>

          {/* AQI card */}
          <div className={`rounded-2xl border p-5 ${aqiLevel.bg} ${aqiLevel.ring} mb-3`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-2xl">{aqiLevel.emoji}</span>
                  <span className={`text-xl font-bold ${aqiLevel.color}`}>{aqi.usAqi}</span>
                </div>
                <p className={`text-sm font-semibold ${aqiLevel.color}`}>{aqiLevel.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">US AQI</p>
              </div>

              {/* AQI scale */}
              <div className="flex flex-col gap-1.5 items-end">
                <div className="w-32 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 via-red-500 via-purple-500 to-rose-800 relative overflow-hidden">
                  <div
                    className="absolute top-0 right-0 h-full bg-black/20 rounded-full transition-all duration-500"
                    style={{ width: `${100 - aqiBarPercent(aqi.usAqi)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">0 — Good · 300+ Hazardous</span>
              </div>
            </div>

            {/* Pollutants */}
            <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl px-4 py-1 backdrop-blur-sm">
              <PollutantRow label="PM2.5 (Fine Particles)" value={aqi.pm25} unit="µg/m³" />
              <PollutantRow label="PM10 (Coarse Particles)" value={aqi.pm10} unit="µg/m³" />
              <PollutantRow label="Nitrogen Dioxide (NO₂)" value={aqi.no2} unit="µg/m³" />
              <PollutantRow label="Ozone (O₃)" value={aqi.ozone} unit="µg/m³" />
            </div>
          </div>

          {/* Fitness note */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-lg">
              🏃
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Outdoor Exercise Advice
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {aqiLevel.fitnessNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hourly forecast ── */}
      <div className="px-6 pb-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Hourly Forecast
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {hourly.map((h, i) => (
            <div key={i} className="shrink-0 flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 min-w-[72px]">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{i === 0 ? "Now" : formatHour(h.time)}</span>
              <span className="text-2xl">{getEmoji(h.code)}</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{h.temp}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7-day forecast ── */}
      <div className="px-6 pb-8">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          7-Day Forecast
        </h2>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-50 dark:divide-slate-700">
          {daily.map((d, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-medium text-gray-900 dark:text-white w-32 shrink-0">
                {i === 0 ? "Today" : formatDay(d.date)}
              </span>
              <span className="text-xl">{getEmoji(d.code)}</span>
              <span className="text-xs text-blue-500 dark:text-blue-400 w-14 text-center">
                {d.precipProb > 0 ? `💧 ${d.precipProb}%` : ""}
              </span>
              <div className="flex items-center gap-2 text-sm shrink-0">
                <span className="text-slate-400 dark:text-slate-500">{d.minTemp}°</span>
                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                    style={{ width: `${Math.min(100, Math.max(20, ((d.maxTemp - d.minTemp) / 20) * 100))}%` }} />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{d.maxTemp}°</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          Powered by Open-Meteo & Open-Meteo Air Quality · Free & No API Key Required
        </p>
      </div>
    </div>
  );
};

export default Weather;

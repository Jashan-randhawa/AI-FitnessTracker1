import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../Context/Themecontext";

/* ─── Open-Meteo (free, no API key required) ─── */
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/* ─── Types ─── */
type CurrentWeather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDir: string;
  windGust: number;
  uvIndex: number;
  uvPhrase: string;
  visibility: number;
  pressure: number;
  cloudCover: number;
  phrase: string;
  iconCode: number;
  isDayTime: boolean;
  past24HourRain: number;
};

type HourlyPoint = {
  time: string;       // ISO string
  temp: number;
  phrase: string;
  iconCode: number;
  isDayTime: boolean;
  precipProb: number;
};

type DailyPoint = {
  date: string;
  maxTemp: number;
  minTemp: number;
  phrase: string;
  iconCode: number;
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
  emoji: string;
  fitnessNote: string;
};

const AQI_LEVELS: AQILevel[] = [
  {
    label: "Good",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    ring: "border-emerald-200 dark:border-emerald-500/30",
    emoji: "🟢",
    fitnessNote: "Air quality is great — perfect conditions for outdoor runs, cycling, or any high-intensity workout!",
  },
  {
    label: "Moderate",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    ring: "border-yellow-200 dark:border-yellow-500/30",
    emoji: "🟡",
    fitnessNote: "Acceptable for most people. Sensitive individuals may want to shorten intense outdoor sessions.",
  },
  {
    label: "Unhealthy for Sensitive Groups",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    ring: "border-orange-200 dark:border-orange-500/30",
    emoji: "🟠",
    fitnessNote: "People with asthma or heart conditions should reduce outdoor exertion. Healthy individuals can still exercise at lower intensity.",
  },
  {
    label: "Unhealthy",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    ring: "border-red-200 dark:border-red-500/30",
    emoji: "🔴",
    fitnessNote: "Everyone should reduce prolonged outdoor exertion. Move high-intensity workouts indoors.",
  },
  {
    label: "Very Unhealthy",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    ring: "border-purple-200 dark:border-purple-500/30",
    emoji: "🟣",
    fitnessNote: "Avoid outdoor exercise today. All fitness activities should be moved indoors.",
  },
  {
    label: "Hazardous",
    color: "text-rose-800 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    ring: "border-rose-300 dark:border-rose-500/30",
    emoji: "⚫",
    fitnessNote: "Health emergency — stay indoors and avoid all physical activity outside.",
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

/* ─── Open-Meteo WMO weather code → emoji / phrase ─── */
// Codes: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WMO_ICON_EMOJI: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  56: "🌧️", 57: "🌧️",
  61: "🌦️", 63: "🌧️", 65: "🌧️",
  66: "🌧️", 67: "🌨️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WMO_PHRASE: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

const getIconEmoji = (code: number) => WMO_ICON_EMOJI[code] ?? "🌡️";
const getPhrase = (code: number) => WMO_PHRASE[code] ?? "Unknown";

const getBgGradient = (iconCode: number, isDayTime: boolean) => {
  if (!isDayTime) return "from-slate-900 via-blue-950 to-slate-900";
  if (iconCode === 0 || iconCode === 1) return "from-sky-400 via-blue-500 to-blue-600";
  if (iconCode === 2 || iconCode === 3) return "from-slate-400 via-slate-500 to-blue-500";
  if (iconCode === 45 || iconCode === 48) return "from-slate-500 via-slate-600 to-slate-700";
  if (iconCode >= 51 && iconCode <= 67) return "from-slate-500 via-blue-600 to-slate-600";
  if ((iconCode >= 71 && iconCode <= 77) || iconCode === 85 || iconCode === 86)
    return "from-blue-200 via-slate-300 to-blue-400";
  if (iconCode >= 80 && iconCode <= 82) return "from-slate-500 via-blue-600 to-slate-600";
  if (iconCode >= 95) return "from-slate-700 via-slate-800 to-slate-900";
  return "from-sky-400 via-blue-500 to-blue-600";
};

/* ─── Wind degrees → compass direction ─── */
const degToCompass = (deg: number) => {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
};

/* ─── UV index → phrase (EPA scale) ─── */
const uvPhrase = (uv: number) => {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very High";
  return "Extreme";
};

const formatHour = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/* ─── API helpers ─── */
async function fetchLocationName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const d = await res.json();
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || "Your Location";
  } catch {
    return "Your Location";
  }
}

type PlaceSuggestion = { name: string; lat: number; lon: number };

async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    );
    const d: { display_name: string; lat: string; lon: string }[] = await res.json();
    return d.map((p) => ({
      name: p.display_name,
      lat: parseFloat(p.lat),
      lon: parseFloat(p.lon),
    }));
  } catch {
    return [];
  }
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
  } catch {
    return null;
  }
}

async function fetchOpenMeteoWeather(
  lat: number,
  lon: number
): Promise<{ current: CurrentWeather; hourly: HourlyPoint[]; daily: DailyPoint[] }> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "auto",
    forecast_days: "7",
    past_days: "1",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "surface_pressure",
      "cloud_cover",
      "weather_code",
      "is_day",
      "visibility",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability", "is_day", "uv_index", "visibility"].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "weather_code",
      "precipitation_probability_max",
      "uv_index_max",
      "precipitation_sum",
    ].join(","),
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`);
  const data = await res.json();

  const nowHourIndex: number = data.hourly.time.findIndex((t: string) => t === data.current.time) ?? 0;
  const uvNow = data.hourly.uv_index?.[nowHourIndex] ?? 0;
  const visibilityKm = (data.current.visibility ?? data.hourly.visibility?.[nowHourIndex] ?? 10000) / 1000;

  // Yesterday's total precipitation, from the past_days=1 window (index 0 of daily arrays).
  const past24HourRain = data.daily.precipitation_sum?.[0] ?? 0;

  const current: CurrentWeather = {
    temperature: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    humidity: data.current.relative_humidity_2m,
    windSpeed: Math.round(data.current.wind_speed_10m),
    windDir: degToCompass(data.current.wind_direction_10m),
    windGust: Math.round(data.current.wind_gusts_10m),
    uvIndex: Math.round(uvNow),
    uvPhrase: uvPhrase(uvNow),
    visibility: parseFloat(visibilityKm.toFixed(1)),
    pressure: Math.round(data.current.surface_pressure),
    cloudCover: data.current.cloud_cover,
    phrase: getPhrase(data.current.weather_code),
    iconCode: data.current.weather_code,
    isDayTime: data.current.is_day === 1,
    past24HourRain: Math.round(past24HourRain * 10) / 10,
  };

  // Next 12 hours starting from the current hour (skip the "yesterday" padding from past_days=1).
  const startIdx = nowHourIndex >= 0 ? nowHourIndex : data.hourly.time.findIndex((t: string) => new Date(t) >= new Date());
  const hourly: HourlyPoint[] = data.hourly.time
    .slice(startIdx, startIdx + 12)
    .map((t: string, i: number) => {
      const idx = startIdx + i;
      return {
        time: t,
        temp: Math.round(data.hourly.temperature_2m[idx]),
        phrase: getPhrase(data.hourly.weather_code[idx]),
        iconCode: data.hourly.weather_code[idx],
        isDayTime: data.hourly.is_day[idx] === 1,
        precipProb: Math.round(data.hourly.precipitation_probability[idx] ?? 0),
      };
    });

  // Daily arrays include 1 "yesterday" entry first because of past_days=1; skip it, take next 7.
  const daily: DailyPoint[] = data.daily.time.slice(1, 8).map((d: string, i: number) => {
    const idx = i + 1;
    return {
      date: d,
      maxTemp: Math.round(data.daily.temperature_2m_max[idx]),
      minTemp: Math.round(data.daily.temperature_2m_min[idx]),
      phrase: getPhrase(data.daily.weather_code[idx]),
      iconCode: data.daily.weather_code[idx],
      precipProb: Math.round(data.daily.precipitation_probability_max[idx] ?? 0),
    };
  });

  return { current, hourly, daily };
}

async function fetchAllWeather(lat: number, lon: number): Promise<WeatherData> {
  const [{ current, hourly, daily }, aqi, locationName] = await Promise.all([
    fetchOpenMeteoWeather(lat, lon),
    fetchAQI(lat, lon),
    fetchLocationName(lat, lon),
  ]);
  return { current, hourly, daily, aqi, locationName };
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

/* ─── AI response renderer ─── */
const WeatherAIResponse = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const applyInline = (raw: string): React.ReactNode[] =>
    raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return part;
    });

  const flushList = (key: string) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key} className="space-y-1.5 my-2">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{applyInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const t = line.trim();
    const bullet = t.match(/^[-•]\s+(.+)/);
    if (bullet) { listItems.push(bullet[1]); return; }
    flushList(`l${idx}`);
    if (!t) { elements.push(<div key={`s${idx}`} className="h-1" />); return; }
    elements.push(<p key={`p${idx}`} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{applyInline(t)}</p>);
  });
  flushList("end");
  return <div className="space-y-0.5">{elements}</div>;
};

/* ─── Main component ─── */
const Weather = () => {
  const { theme } = useTheme();
  const isDark = theme.toString() === "dark";

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiWorkoutSuggestion = async (w: WeatherData) => {
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, "");
      const token = localStorage.getItem("token");
      const prompt = `Weather in ${w.locationName}: ${w.current.phrase}, ${w.current.temperature}°C, feels like ${w.current.feelsLike}°C, humidity ${w.current.humidity}%, wind ${w.current.windSpeed} km/h, UV index ${w.current.uvIndex} (${w.current.uvPhrase}).${w.aqi ? ` Air Quality AQI: ${w.aqi.usAqi}.` : ""} Suggest 3 specific workouts perfectly suited for these conditions today. For each, include: name, duration, intensity, and why it's ideal for this weather. Be concise and practical.`;
      const res = await fetch(`${STRAPI_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) throw new Error(`AI assistant: ${res.status}`);
      const data = await res.json();
      setAiSuggestion(data.reply || "Could not generate suggestions.");
    } catch {
      setAiSuggestion("Failed to get AI suggestions. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const loadWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAllWeather(lat, lon);
      setWeather(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load weather data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const [locationNotice, setLocationNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const requestLocation = useCallback(() => {
    setSearchOpen(false);
    if (!navigator.geolocation) {
      setLocationNotice("Your browser doesn't support location access — showing New Delhi.");
      loadWeather(28.6139, 77.209);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracyKm = pos.coords.accuracy / 1000;
        // Browsers without a GPS chip (most laptops/desktops) resolve location via
        // Wi-Fi/IP lookup, which can easily be off by several km — surface that instead
        // of silently presenting a possibly-wrong location as exact.
        setLocationNotice(
          accuracyKm > 2
            ? `This location is approximate (±${accuracyKm.toFixed(1)} km, no GPS available). Search below to set it exactly.`
            : ""
        );
        loadWeather(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        // GeolocationPositionError codes: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        const reason =
          err.code === 1
            ? "Location access was denied — enable it in your browser/site settings, then retry."
            : err.code === 2
            ? "Your device couldn't determine a location — check GPS/network and retry."
            : "Getting your location timed out — retry when you have a better signal.";
        setLocationNotice(`${reason} Showing New Delhi for now — or search for your city below.`);
        loadWeather(28.6139, 77.209);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [loadWeather]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const chooseSearchResult = (place: PlaceSuggestion) => {
    setLocationNotice("");
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    loadWeather(place.lat, place.lon);
  };

  if (loading) return (
    <div className={`flex flex-col items-center justify-center h-screen ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      <div className="text-5xl mb-4 animate-bounce">🌤️</div>
      <p className="text-slate-500 dark:text-slate-400 text-sm">Fetching weather from Open-Meteo…</p>
    </div>
  );

  if (error || !weather) return (
    <div className={`flex flex-col items-center justify-center h-screen ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      <div className="text-5xl mb-4">😕</div>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{error || "Something went wrong."}</p>
      <button
        onClick={requestLocation}
        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
      >
        Retry
      </button>
    </div>
  );

  const { current, hourly, daily, locationName, aqi } = weather;
  const bg = getBgGradient(current.iconCode, current.isDayTime);
  const aqiLevel = aqi ? getAQILevel(aqi.usAqi) : null;

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-900" : "bg-slate-50"} transition-colors duration-200`}>

      {/* ── Hero / Current ── */}
      <div className={`bg-gradient-to-br ${bg} px-6 py-10 relative overflow-hidden`}>
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <p className="text-white/80 text-sm font-medium">📍 {locationName}</p>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="text-white/70 hover:text-white text-xs underline cursor-pointer"
            >
              {searchOpen ? "Cancel" : "Not right? Set location"}
            </button>
          </div>

          {searchOpen && (
            <div className="w-full max-w-xs relative">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for your city…"
                className="w-full rounded-lg bg-white/20 placeholder-white/60 text-white text-sm px-3 py-2 outline-none focus:bg-white/30"
              />
              {(searching || searchResults.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {searching && (
                    <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
                  )}
                  {!searching &&
                    searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => chooseSearchResult(r)}
                        className="block w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        {r.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {locationNotice && (
            <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 text-xs text-white/90">
              <span>{locationNotice}</span>
              <button
                onClick={requestLocation}
                className="underline shrink-0 hover:text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
          <div className="text-8xl leading-none mb-1">{getIconEmoji(current.iconCode)}</div>
          <div className="text-7xl font-thin text-white tracking-tighter">{current.temperature}°C</div>
          <p className="text-white/90 text-xl font-medium">{current.phrase}</p>
          <p className="text-white/60 text-sm">Feels like {current.feelsLike}°C</p>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          <StatCard label="Humidity" value={`${current.humidity}%`} icon="💧" />
          <StatCard label="Wind" value={`${current.windSpeed} km/h ${current.windDir}`} icon="💨" />
          <StatCard label="Gust" value={`${current.windGust} km/h`} icon="🌬️" />
          <StatCard label="UV Index" value={`${current.uvIndex} · ${current.uvPhrase}`} icon="☀️" />
          <StatCard label="Visibility" value={`${current.visibility} km`} icon="👁️" />
          <StatCard label="Pressure" value={`${current.pressure} mb`} icon="🔵" />
        </div>

        {/* Rain summary badge */}
        {current.past24HourRain > 0 && (
          <div className="mt-4 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-white text-sm">
            🌧️ {current.past24HourRain} mm rain in last 24 hrs
          </div>
        )}

        {/* Cloud cover bar */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-white/60 text-xs uppercase tracking-wide">Cloud cover</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${current.cloudCover}%` }} />
          </div>
          <span className="text-white/80 text-xs font-medium">{current.cloudCover}%</span>
        </div>
      </div>

      {/* ── AQI Section (Open-Meteo, free) ── */}
      {aqi && aqiLevel && (
        <div className="px-6 py-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Air Quality Index
          </h2>
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
            <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl px-4 py-1 backdrop-blur-sm">
              <PollutantRow label="PM2.5 (Fine Particles)" value={aqi.pm25} unit="µg/m³" />
              <PollutantRow label="PM10 (Coarse Particles)" value={aqi.pm10} unit="µg/m³" />
              <PollutantRow label="Nitrogen Dioxide (NO₂)" value={aqi.no2} unit="µg/m³" />
              <PollutantRow label="Ozone (O₃)" value={aqi.ozone} unit="µg/m³" />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-lg">
              🏃
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Outdoor Exercise Advice</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{aqiLevel.fitnessNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hourly Forecast ── */}
      <div className="px-6 pb-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Hourly Forecast
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {hourly.map((h, i) => (
            <div
              key={i}
              className="shrink-0 flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 min-w-[72px]"
            >
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {i === 0 ? "Now" : formatHour(h.time)}
              </span>
              <span className="text-2xl">{getIconEmoji(h.iconCode)}</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{h.temp}°</span>
              {h.precipProb > 0 && (
                <span className="text-[10px] text-blue-500 dark:text-blue-400">💧{h.precipProb}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 7-Day Forecast ── */}
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
              <span className="text-xl">{getIconEmoji(d.iconCode)}</span>
              <span className="text-xs text-blue-500 dark:text-blue-400 w-14 text-center">
                {d.precipProb > 0 ? `💧 ${d.precipProb}%` : ""}
              </span>
              <div className="flex items-center gap-2 text-sm shrink-0">
                <span className="text-slate-400 dark:text-slate-500">{d.minTemp}°</span>
                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                    style={{ width: `${Math.min(100, Math.max(20, ((d.maxTemp - d.minTemp) / 20) * 100))}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{d.maxTemp}°</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          Powered by Open-Meteo
        </p>
      </div>

      {/* ── AI Workout Suggestion ── */}
      <div className="px-6 pb-10">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          AI Workout Suggestion
        </h2>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-4 flex items-start gap-3 border-b border-slate-50 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">🤖</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">FitBot Weather Analysis</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                AI picks workouts matched to today's exact conditions in {locationName}
              </p>
            </div>
          </div>

          <div className="p-4">
            {!aiSuggestion && !aiLoading && (
              <button
                onClick={() => fetchAiWorkoutSuggestion(weather!)}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>✨</span> Get AI Workout Plan for Today's Weather
              </button>
            )}

            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Analyzing conditions…</p>
              </div>
            )}

            {aiSuggestion && !aiLoading && (
              <div className="space-y-3">
                <WeatherAIResponse text={aiSuggestion} />
                <button
                  onClick={() => fetchAiWorkoutSuggestion(weather!)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  ↻ Regenerate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Weather;

/**
 * Local calendar-day helpers for the summary API. The browser's timezone is
 * the one sent as X-Timezone, so day keys here match the server's buckets.
 */

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** YYYY-MM-DD for `date` in the browser's timezone. */
export const localDayKey = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/** Adds whole days to a YYYY-MM-DD key (calendar arithmetic, timezone-free). */
export const addDaysKey = (key: string, n: number): string => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Converts a YYYY-MM-DD key to the `toDateString()` form used by dailyTotals. */
export const keyToDateString = (key: string): string =>
  new Date(`${key}T12:00:00`).toDateString();

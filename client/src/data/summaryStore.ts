import { useEffect, useSyncExternalStore } from "react";
import axios from "axios";
import api from "../configs/api";
import { browserTimeZone } from "../utils/localDay";

/**
 * Cached access to the server's day and range summaries.
 *
 * Every mounted view reads the same entries. Any change (a list setter in
 * AppContext, or a live "change" event from the server) bumps the revision,
 * and each view refetches the entries it uses. A response that arrives after
 * a newer invalidation is ignored, so an older answer can never overwrite a
 * newer one.
 */

export interface BadgeState {
  id: string;
  earned: boolean;
  current: number;
  target: number;
}

export interface DaySummary {
  timezone: string;
  date: string;
  isToday: boolean;
  goals: {
    calorieLimit: number;
    calorieBurnGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatGoal: number;
    waterGoal: number;
  };
  food: { calories: number; protein: number; carbs: number; fat: number; meals: number };
  activity: { burnedKcal: number; minutes: number; count: number };
  waterMl: number;
  streak: number;
  lifetime: { foodCount: number; activityCount: number };
  badges: BadgeState[];
}

export interface DayRow {
  date: string;
  food: { calories: number; protein: number; carbs: number; fat: number; meals: number };
  activity: { burnedKcal: number; minutes: number; count: number };
  waterMl: number;
}

export interface RangeSummary {
  timezone: string;
  from: string;
  to: string;
  goals: DaySummary["goals"];
  days: DayRow[];
}

export interface SummaryEntry<T> {
  status: "loading" | "ready" | "error";
  data?: T;
  error?: string;
  revision: number;
}

let revision = 0;
const cache = new Map<string, SummaryEntry<unknown>>();
const inFlight = new Map<string, { revision: number; promise: Promise<void> }>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getRevision = () => revision;

/** Marks every cached summary as stale; mounted views refetch what they use. */
export const invalidateSummaries = () => {
  revision += 1;
  emit();
};

/** Drops all cached summaries (on logout). */
export const clearSummaries = () => {
  cache.clear();
  inFlight.clear();
  revision += 1;
  emit();
};

const load = <T,>(key: string, url: string): Promise<void> => {
  const pending = inFlight.get(key);
  if (pending && pending.revision === revision) return pending.promise;

  const started = revision;
  const previous = cache.get(key);
  cache.set(key, { status: "loading", data: previous?.data, revision: started });
  emit();

  const promise = api
    .get<T>(url)
    .then(({ data }) => {
      const current = cache.get(key);
      // Ignore results that a newer load has superseded.
      if (current && current.revision > started) return;
      cache.set(key, { status: "ready", data, revision: started });
    })
    .catch((err: unknown) => {
      const current = cache.get(key);
      if (current && current.revision > started) return;
      const errorMessage = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message || err.message
        : "Could not load summary";
      cache.set(key, {
        status: "error",
        data: previous?.data,
        error: errorMessage,
        revision: started,
      });
    })
    .finally(() => {
      const pendingNow = inFlight.get(key);
      if (pendingNow && pendingNow.revision === started) inFlight.delete(key);
      emit();
    });

  inFlight.set(key, { revision: started, promise });
  return promise;
};

/**
 * Reads a cached summary and loads or refreshes it when it is missing or stale.
 * Pass null for either argument to skip loading (for example, when logged out).
 */
const useSummary = <T,>(key: string | null, url: string | null) => {
  const currentRevision = useSyncExternalStore(subscribe, getRevision, getRevision);
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) as SummaryEntry<T> | undefined) ?? null : null),
    () => null
  );

  useEffect(() => {
    if (!key || !url) return;
    const existing = cache.get(key);
    if (!existing || existing.revision !== revision) {
      void load<T>(key, url);
    }
  }, [key, url, currentRevision]);

  return {
    data: entry?.data,
    status: key && url ? entry?.status ?? "loading" : "idle",
    error: entry?.error,
  } as { data: T | undefined; status: "idle" | "loading" | "ready" | "error"; error?: string };
};

export const useDaySummary = (date: string | null) => {
  const tz = browserTimeZone();
  return useSummary<DaySummary>(
    date ? `day:${tz}:${date}` : null,
    date ? `/api/summary/day?date=${encodeURIComponent(date)}` : null
  );
};

export const useRangeSummary = (from: string | null, to: string | null) => {
  const tz = browserTimeZone();
  const ready = Boolean(from && to);
  return useSummary<RangeSummary>(
    ready ? `range:${tz}:${from}:${to}` : null,
    ready ? `/api/summary/range?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}` : null
  );
};

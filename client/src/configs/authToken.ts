// In-memory access token storage (short-lived 15m JWT).
// Never persisted to localStorage or sessionStorage.
let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

/**
 * One-time migration helper: if an old localStorage or sessionStorage token exists,
 * uses it once for session recovery, then immediately purges it from storage.
 */
const migrateLegacyToken = (): string | null => {
  try {
    if (typeof window !== "undefined") {
      const legacy = localStorage.getItem(TOKEN_KEY) || sessionStorage?.getItem(TOKEN_KEY);
      if (legacy) {
        inMemoryAccessToken = legacy;
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage?.removeItem(TOKEN_KEY);
        return legacy;
      }
    }
  } catch {
    // Ignore storage access errors (e.g. sandboxed iframe or strict private browsing)
  }
  return null;
};

export const getAuthToken = (): string | null => {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }
  return migrateLegacyToken();
};

export const getRefreshToken = (): string | null => {
  if (inMemoryRefreshToken) {
    return inMemoryRefreshToken;
  }
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage?.getItem(REFRESH_TOKEN_KEY);
      if (stored) {
        inMemoryRefreshToken = stored;
        return stored;
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
};

export const setRefreshToken = (token: string): void => {
  inMemoryRefreshToken = token;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage errors
  }
};

export const clearRefreshToken = (): void => {
  inMemoryRefreshToken = null;
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage?.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const hasAuthToken = (): boolean => Boolean(getAuthToken());

export const setAuthToken = (jwt: string, refreshToken?: string): void => {
  inMemoryAccessToken = jwt;
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage?.removeItem(TOKEN_KEY);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
    }
  } catch {
    // Ignore storage errors
  }
};

export const clearAuthToken = (): void => {
  inMemoryAccessToken = null;
  clearRefreshToken();
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage?.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

// For raw fetch() calls, which bypass the axios interceptor in configs/api.ts.
export const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

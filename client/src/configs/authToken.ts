// In-memory access token storage (short-lived 15m JWT).
// Never persisted to localStorage or sessionStorage.
let inMemoryAccessToken: string | null = null;

const TOKEN_KEY = "token";

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

export const hasAuthToken = (): boolean => Boolean(getAuthToken());

export const setAuthToken = (jwt: string): void => {
  inMemoryAccessToken = jwt;
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage?.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const clearAuthToken = (): void => {
  inMemoryAccessToken = null;
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

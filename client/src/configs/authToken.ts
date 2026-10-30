// Single place that touches the stored session token. Everything else in the
// client goes through these helpers, so the storage mechanism can change (for
// example to an httpOnly cookie) without editing every page.
const TOKEN_KEY = "token";

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const hasAuthToken = (): boolean => Boolean(getAuthToken());

export const setAuthToken = (jwt: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, jwt);
  } catch {
    // Ignore localStorage write quota/security errors
  }
};

export const clearAuthToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore localStorage write quota/security errors
  }
};

// For raw fetch() calls, which bypass the axios interceptor in configs/api.ts.
export const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, setAuthToken, clearAuthToken, hasAuthToken, authHeaders } from '../configs/authToken';

describe('authToken helper unit tests', () => {
  beforeEach(() => {
    clearAuthToken();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores, detects, and retrieves valid auth token in memory without touching storage', () => {
    expect(hasAuthToken()).toBe(false);
    expect(getAuthToken()).toBeNull();
    expect(authHeaders()).toEqual({});

    setAuthToken('test-jwt-token-xyz');
    expect(hasAuthToken()).toBe(true);
    expect(getAuthToken()).toBe('test-jwt-token-xyz');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer test-jwt-token-xyz' });

    // Confirm token is strictly in memory and NOT in browser storage
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('clears token cleanly from memory and storage', () => {
    setAuthToken('temp-jwt');
    expect(getAuthToken()).toBe('temp-jwt');

    clearAuthToken();
    expect(hasAuthToken()).toBe(false);
    expect(getAuthToken()).toBeNull();
    expect(authHeaders()).toEqual({});
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('migrates legacy token from localStorage once and deletes it immediately', () => {
    clearAuthToken();
    localStorage.setItem('token', 'legacy-jwt-from-old-storage');

    // First call to getAuthToken should retrieve and migrate it
    expect(hasAuthToken()).toBe(true);
    expect(getAuthToken()).toBe('legacy-jwt-from-old-storage');

    // Storage must be purged immediately
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();

    // Subsequent retrieval returns the in-memory token
    expect(getAuthToken()).toBe('legacy-jwt-from-old-storage');
  });

  it('safely handles localStorage throwing SecurityError or QuotaExceededError', () => {
    clearAuthToken();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    // None of these should throw uncaught exceptions
    expect(() => setAuthToken('jwt')).not.toThrow();
    expect(getAuthToken()).toBe('jwt'); // In-memory store succeeds
    expect(hasAuthToken()).toBe(true);
    expect(() => clearAuthToken()).not.toThrow();
    expect(getAuthToken()).toBeNull();
  });
});

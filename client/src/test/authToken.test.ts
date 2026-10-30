import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, setAuthToken, clearAuthToken, hasAuthToken, authHeaders } from '../configs/authToken';

describe('authToken helper unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores, detects, and retrieves valid auth token', () => {
    expect(hasAuthToken()).toBe(false);
    expect(getAuthToken()).toBeNull();
    expect(authHeaders()).toEqual({});

    setAuthToken('test-jwt-token-xyz');
    expect(hasAuthToken()).toBe(true);
    expect(getAuthToken()).toBe('test-jwt-token-xyz');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer test-jwt-token-xyz' });
  });

  it('clears token cleanly', () => {
    setAuthToken('temp-jwt');
    expect(getAuthToken()).toBe('temp-jwt');

    clearAuthToken();
    expect(hasAuthToken()).toBe(false);
    expect(getAuthToken()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it('safely handles localStorage throwing SecurityError or QuotaExceededError', () => {
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
    expect(() => getAuthToken()).not.toThrow();
    expect(getAuthToken()).toBeNull();
    expect(hasAuthToken()).toBe(false);
    expect(() => clearAuthToken()).not.toThrow();
  });
});

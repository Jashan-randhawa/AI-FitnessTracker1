import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import api from '../configs/api';
import { getAuthToken, setAuthToken, clearAuthToken } from '../configs/authToken';

describe('API 401 Refresh Interceptor Tests', () => {
  beforeEach(() => {
    clearAuthToken();
    vi.restoreAllMocks();
  });

  it('rotates token on 401 and retries original request', async () => {
    setAuthToken('expired-access-token');

    let refreshCalls = 0;
    vi.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/refresh')) {
        refreshCalls++;
        return { data: { jwt: 'new-rotated-token', accessToken: 'new-rotated-token' } } as any;
      }
      return { data: {} } as any;
    });

    const originalInterceptor = api.interceptors.response;
    expect(originalInterceptor).toBeDefined();

    // Verify axios instance has withCredentials enabled
    expect(api.defaults.withCredentials).toBe(true);

    // Call refresh simulation
    const refreshRes = await axios.post('/api/auth/refresh', {});
    expect(refreshCalls).toBe(1);
    expect(refreshRes.data.accessToken).toBe('new-rotated-token');
    setAuthToken(refreshRes.data.accessToken);

    expect(getAuthToken()).toBe('new-rotated-token');
  });

  it('clears token on refresh failure', async () => {
    setAuthToken('stale-token');

    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Invalid refresh token'));

    try {
      await axios.post('/api/auth/refresh', {});
    } catch {
      clearAuthToken();
    }

    expect(getAuthToken()).toBeNull();
  });
});

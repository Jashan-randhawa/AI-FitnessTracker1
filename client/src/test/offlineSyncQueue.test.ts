import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  removeOfflineMutation,
  replayOfflineQueue,
} from '../utils/offlineSyncQueue';
import api from '../configs/api';

vi.mock('../configs/api', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
    error: vi.fn(),
  },
}));

describe('offlineSyncQueue unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  it('enqueues a mutation into fallback storage and retrieves it', async () => {
    const item = await enqueueOfflineMutation({
      endpoint: '/api/activitylogs',
      method: 'POST',
      data: { name: 'Pushups', duration: 15 },
      description: 'Pushups workout',
    });

    expect(item.id).toMatch(/^mut-/);
    expect(item.endpoint).toBe('/api/activitylogs');
    expect(item.method).toBe('POST');

    const queue = await getOfflineQueue();
    expect(queue.length).toBeGreaterThanOrEqual(1);
    expect(queue.some((q) => q.id === item.id)).toBe(true);
  });

  it('removes a mutation from the queue by ID', async () => {
    const item = await enqueueOfflineMutation({
      endpoint: '/api/foodlogs',
      method: 'POST',
      data: { name: 'Oatmeal', calories: 350 },
    });

    await removeOfflineMutation(item.id);
    const queue = await getOfflineQueue();
    expect(queue.some((q) => q.id === item.id)).toBe(false);
  });

  it('replays queued mutations via API when online', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 'srv-123', name: 'Deadlift' },
    });

    const item = await enqueueOfflineMutation({
      endpoint: '/api/activitylogs',
      method: 'POST',
      data: { name: 'Deadlift', duration: 30 },
    });

    const callback = vi.fn();
    const count = await replayOfflineQueue(callback);

    expect(count).toBeGreaterThanOrEqual(1);
    expect(api.post).toHaveBeenCalledWith('/api/activitylogs', item.data);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id }),
      expect.objectContaining({ id: 'srv-123' })
    );

    const remaining = await getOfflineQueue();
    expect(remaining.some((q) => q.id === item.id)).toBe(false);
  });

  it('aborts replay when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    await enqueueOfflineMutation({
      endpoint: '/api/activitylogs',
      method: 'POST',
      data: { name: 'Running' },
    });

    const count = await replayOfflineQueue();
    expect(count).toBe(0);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('removes invalid mutations on 4xx client errors (excluding 429) to prevent queue poisoning', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 400, data: { error: 'Validation failed: calories must be positive' } },
    });

    const item = await enqueueOfflineMutation({
      endpoint: '/api/foodlogs',
      method: 'POST',
      data: { name: 'Bad Food', calories: -100 },
    });

    const count = await replayOfflineQueue();
    expect(count).toBe(0);

    const remaining = await getOfflineQueue();
    expect(remaining.some((q) => q.id === item.id)).toBe(false);
  });
});

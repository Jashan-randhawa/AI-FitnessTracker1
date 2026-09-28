import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOpenRouterClient,
  isTransient,
  extractCleanJson,
  OpenRouterError,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
} from '../src/index';

describe('openrouter-resilient-client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('isTransient', () => {
    it('identifies 429 and 5xx as transient', () => {
      expect(isTransient(429)).toBe(true);
      expect(isTransient(500)).toBe(true);
      expect(isTransient(502)).toBe(true);
      expect(isTransient(503)).toBe(true);
      expect(isTransient(504)).toBe(true);
    });

    it('identifies 400, 401, 403, 404 as non-transient', () => {
      expect(isTransient(400)).toBe(false);
      expect(isTransient(401)).toBe(false);
      expect(isTransient(403)).toBe(false);
      expect(isTransient(404)).toBe(false);
    });

    it('identifies network / abort errors as transient', () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      expect(isTransient(null, abortErr)).toBe(true);

      const connErr = new Error('reset');
      (connErr as any).code = 'ECONNRESET';
      expect(isTransient(null, connErr)).toBe(true);

      const timeoutErr = new Error('timeout');
      (timeoutErr as any).code = 'ETIMEDOUT';
      expect(isTransient(null, timeoutErr)).toBe(true);
    });
  });

  describe('extractCleanJson', () => {
    it('extracts JSON from standard raw string', () => {
      expect(extractCleanJson('{"calories": 250, "protein": 30}')).toEqual({
        calories: 250,
        protein: 30,
      });
    });

    it('extracts JSON from fenced markdown blocks', () => {
      const fenced = '```json\n{"calories": 300}\n```';
      expect(extractCleanJson(fenced)).toEqual({ calories: 300 });

      const generic = '```\n[{"name": "squat"}]\n```';
      expect(extractCleanJson(generic)).toEqual([{ name: 'squat' }]);
    });

    it('strips <think> tags before extracting JSON', () => {
      const text = '<think>I should calculate...</think>\n{"result": "ok"}';
      expect(extractCleanJson(text)).toEqual({ result: 'ok' });
    });

    it('returns null for non-JSON text', () => {
      expect(extractCleanJson('This is definitely not JSON')).toBeNull();
      expect(extractCleanJson('')).toBeNull();
    });
  });

  describe('Client chat completions', () => {
    it('throws error if API key is not configured', async () => {
      const client = createOpenRouterClient({ apiKey: '' });
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow('OpenRouter API key not configured');
    });

    it('retries on 429 and succeeds on subsequent attempt', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('Rate limit exceeded', { status: 429 });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hello after retry!' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = createOpenRouterClient({
        apiKey: 'test-key',
        maxRetries: 2,
      });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        title: 'Retry Test',
      });

      expect(callCount).toBe(2);
      expect(result.text).toBe('Hello after retry!');
      expect(result.usage.total_tokens).toBe(15);
    });

    it('does NOT retry on 401 Unauthorized', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return new Response('Invalid API Key', { status: 401 });
      });

      const client = createOpenRouterClient({
        apiKey: 'bad-key',
        maxRetries: 2,
        fallbackModel: '',
      });

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Hello' }] })
      ).rejects.toThrow();

      // Should not retry on 401, so callCount is 1
      expect(callCount).toBe(1);
    });

    it('switches to fallback model when primary model fails', async () => {
      const calls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation(async (_url, opts: any) => {
        const body = JSON.parse(opts.body);
        calls.push(body.model);

        if (body.model === 'primary-model') {
          return new Response('Primary model overloaded', { status: 503 });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Fallback model response' } }],
          }),
          { status: 200 }
        );
      });

      const client = createOpenRouterClient({
        apiKey: 'test-key',
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        maxRetries: 1,
        maxFallbackRetries: 1,
      });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Help' }],
      });

      expect(result.text).toBe('Fallback model response');
      expect(calls).toContain('primary-model');
      expect(calls).toContain('fallback-model');
      expect(result.model).toBe('fallback-model');
    });

    it('aborts on timeout and throws 503 when all retries fail', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (_url, opts: any) => {
        return new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const client = createOpenRouterClient({
        apiKey: 'test-key',
        timeoutMs: 50,
        maxRetries: 1,
        fallbackModel: '', // disable fallback to test exhaustion
      });

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'Slow' }] })
      ).rejects.toThrowError(OpenRouterError);
    });
  });
});

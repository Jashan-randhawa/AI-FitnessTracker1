const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isTransient,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  chatCompletionDetailed,
  extractAndValidateContent,
  createTimeoutError,
  createClientAbortError,
  createMalformedResponseError,
  createEmptyResponseError,
} = require('../src/services/openrouter.service');
const { extractCleanJson, buildFitBotPrompt } = require('../src/services/aiAssistant.service');
const { FITBOT_SYSTEM_PROMPT, PROMPT_VERSION } = require('../src/prompts/fitbot.prompt');

describe('OpenRouter Service & Prompt Configuration Tests', () => {
  it('correctly identifies transient errors for exponential retry', () => {
    // 429 rate limit is transient
    assert.equal(isTransient(429, null), true);

    // 500, 502, 503, 504 server errors are transient
    assert.equal(isTransient(500, null), true);
    assert.equal(isTransient(502, null), true);
    assert.equal(isTransient(503, null), true);
    assert.equal(isTransient(504, null), true);

    // 400 bad request, 401 unauthorized, 403, 404, 422 are NOT transient
    assert.equal(isTransient(400, null), false);
    assert.equal(isTransient(401, null), false);
    assert.equal(isTransient(403, null), false);
    assert.equal(isTransient(404, null), false);
    assert.equal(isTransient(422, null), false);

    // Network timeout or connection reset errors are transient
    const timeoutErr = createTimeoutError(5000);
    assert.equal(isTransient(null, timeoutErr), true);

    const netErr = new Error('network failure');
    netErr.code = 'ECONNRESET';
    assert.equal(isTransient(null, netErr), true);

    // Explicit client cancellation is NEVER transient
    const clientErr = createClientAbortError();
    assert.equal(isTransient(null, clientErr), false);
  });

  it('defines primary model and fallback model defaults', () => {
    assert.ok(DEFAULT_MODEL);
    assert.ok(DEFAULT_FALLBACK_MODEL);
    assert.notEqual(DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL);
  });

  it('extractCleanJson extracts valid JSON from markdown code fences or raw text', () => {
    const rawJson = '{"day": "Day 1", "activities": []}';
    const fencedJson = '```json\n{"day": "Day 1", "activities": []}\n```';
    const fencedWithoutLang = '```\n[{"name": "running"}]\n```';

    assert.deepEqual(extractCleanJson(rawJson), { day: 'Day 1', activities: [] });
    assert.deepEqual(extractCleanJson(fencedJson), { day: 'Day 1', activities: [] });
    assert.deepEqual(extractCleanJson(fencedWithoutLang), [{ name: 'running' }]);

    // Unparseable text returns null
    assert.equal(extractCleanJson('Not JSON at all'), null);
  });

  it('buildFitBotPrompt correctly injects user context and maintains prompt version', () => {
    const promptModule = require('../src/prompts/fitbot.prompt');
    assert.equal(promptModule.PROMPT_VERSION, '1.7.0');

    const basicPrompt = promptModule.buildFitBotPrompt();
    assert.ok(basicPrompt.includes('You are FitBot'));

    const contextualPrompt = promptModule.buildFitBotPrompt('Goal: Fat loss, Calories consumed: 1200');
    assert.ok(contextualPrompt.includes('Goal: Fat loss'));
    assert.ok(contextualPrompt.includes('User context:'));
  });
});

describe('Phase 4: Provider Response Envelope Validation Tests', () => {
  it('extracts valid text content from choices[0].message.content string', () => {
    const data = {
      choices: [
        {
          message: {
            content: '  Eat 120g of protein daily.  ',
          },
        },
      ],
    };
    const content = extractAndValidateContent(data);
    assert.equal(content, 'Eat 120g of protein daily.');
  });

  it('extracts valid text content from content block array', () => {
    const data = {
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: 'Drink 2L of water' },
              { type: 'text', text: ' and stretch daily.' },
            ],
          },
        },
      ],
    };
    const content = extractAndValidateContent(data);
    assert.equal(content, 'Drink 2L of water and stretch daily.');
  });

  it('rejects provider payload missing choices array with MalformedProviderResponseError', () => {
    assert.throws(
      () => extractAndValidateContent({ id: 'resp-1' }),
      /missing choices array/
    );
  });

  it('rejects provider payload with empty choices array', () => {
    assert.throws(
      () => extractAndValidateContent({ choices: [] }),
      /missing choices array/
    );
  });

  it('rejects provider payload with missing message object', () => {
    assert.throws(
      () => extractAndValidateContent({ choices: [{ finish_reason: 'stop' }] }),
      /missing message object/
    );
  });

  it('rejects provider response with empty string content as EmptyModelResponseError', () => {
    assert.throws(
      () => extractAndValidateContent({ choices: [{ message: { content: '   ' } }] }),
      /empty content/
    );
  });

  it('rejects provider response containing error envelope even if HTTP 200', () => {
    assert.throws(
      () => extractAndValidateContent({ error: { message: 'Provider internal quota exceeded', code: 429 } }),
      /OpenRouter Error: Provider internal quota exceeded/
    );
  });
});

describe('Phase 4: Provider Resilience, Retries, Fallback & Token Metrics', () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  it('primary model succeeds on first attempt', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';

    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'Great workout advice!' } }],
          usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
        }),
    });

    try {
      const res = await chatCompletionDetailed({
        messages: [{ role: 'user', content: 'Workout?' }],
        title: 'Test',
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        returnUsage: true,
        fetchFn: fakeFetch,
      });

      assert.equal(res.content, 'Great workout advice!');
      assert.equal(res.model, 'primary-model');
      assert.equal(res.fallbackUsed, false);
      assert.equal(res.attempts, 1);
      assert.equal(res.usage.total_tokens, 40);
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });

  it('retries on transient 500 error and succeeds on second attempt', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';
    let callCount = 0;

    const fakeFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          headers: new Headers(),
          text: async () => 'Internal Server Error',
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: 'Recovered response!' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
      };
    };

    try {
      const res = await chatCompletionDetailed({
        messages: [{ role: 'user', content: 'Hello' }],
        title: 'Retry Test',
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        returnUsage: true,
        fetchFn: fakeFetch,
      });

      assert.equal(res.content, 'Recovered response!');
      assert.equal(res.attempts, 2);
      assert.equal(res.fallbackUsed, false);
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });

  it('switches to fallback model when primary model exhausts retries', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';
    let primaryAttempts = 0;
    let fallbackAttempts = 0;

    const fakeFetch = async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.model === 'primary-model') {
        primaryAttempts++;
        return {
          ok: false,
          status: 503,
          headers: new Headers(),
          text: async () => 'Primary Unavailable',
        };
      }
      fallbackAttempts++;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: 'Fallback model response!' } }],
            usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
          }),
      };
    };

    try {
      const res = await chatCompletionDetailed({
        messages: [{ role: 'user', content: 'Advice?' }],
        title: 'Fallback Test',
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        returnUsage: true,
        fetchFn: fakeFetch,
      });

      assert.equal(res.content, 'Fallback model response!');
      assert.equal(res.model, 'fallback-model');
      assert.equal(res.fallbackUsed, true);
      assert.ok(primaryAttempts >= 3, 'Primary should have executed initial + 2 retries');
      assert.equal(fallbackAttempts, 1);
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });

  it('fails immediately without retrying or fallback on 401 Unauthorized', async () => {
    process.env.OPENROUTER_API_KEY = 'invalid-key';
    let callCount = 0;

    const fakeFetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => 'Unauthorized: Invalid API Key',
      };
    };

    try {
      await assert.rejects(
        chatCompletionDetailed({
          messages: [{ role: 'user', content: 'Hi' }],
          title: 'Auth Test',
          model: 'primary-model',
          fallbackModel: 'fallback-model',
          fetchFn: fakeFetch,
        }),
        (err) => err.status === 401 || err.status === 503
      );

      // Must NOT attempt fallback on bad credentials
      assert.equal(callCount, 1, 'Must fail on first attempt without retries or fallback on 401');
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });

  it('aborts immediately without retrying or fallback on client cancellation', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';
    const abortController = new AbortController();
    abortController.abort(new Error('User clicked Stop'));

    let fetchCalled = false;
    const fakeFetch = async () => {
      fetchCalled = true;
      return { ok: true, status: 200, text: async () => '{}' };
    };

    try {
      await assert.rejects(
        chatCompletionDetailed({
          messages: [{ role: 'user', content: 'Hi' }],
          title: 'Abort Test',
          signal: abortController.signal,
          fetchFn: fakeFetch,
        }),
        (err) => err.isClientAbort === true && err.name === 'AbortError'
      );

      assert.equal(fetchCalled, false, 'Fetch must not be called when signal is already aborted');
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });

  it('truthfully reports null usage tokens when provider omits usage metadata', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';

    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'No usage provided' } }],
          // usage field deliberately omitted
        }),
    });

    try {
      const res = await chatCompletionDetailed({
        messages: [{ role: 'user', content: 'Hi' }],
        title: 'Usage Test',
        returnUsage: true,
        fetchFn: fakeFetch,
      });

      assert.equal(res.usage.prompt_tokens, null);
      assert.equal(res.usage.completion_tokens, null);
      assert.equal(res.usage.total_tokens, null);
    } finally {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  });
});

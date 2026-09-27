const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isTransient, DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL } = require('../src/services/openrouter.service');
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

    // 400 bad request, 401 unauthorized, 404 not found are NOT transient
    assert.equal(isTransient(400, null), false);
    assert.equal(isTransient(401, null), false);
    assert.equal(isTransient(404, null), false);

    // Network timeout or connection reset errors are transient
    const timeoutErr = new Error('timed out');
    timeoutErr.name = 'AbortError';
    assert.equal(isTransient(null, timeoutErr), true);

    const netErr = new Error('network failure');
    netErr.code = 'ECONNRESET';
    assert.equal(isTransient(null, netErr), true);
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
    assert.equal(promptModule.PROMPT_VERSION, '1.2.0');

    const basicPrompt = promptModule.buildFitBotPrompt();
    assert.ok(basicPrompt.includes('You are FitBot'));

    const contextualPrompt = promptModule.buildFitBotPrompt('Goal: Fat loss, Calories consumed: 1200');
    assert.ok(contextualPrompt.includes('Goal: Fat loss'));
    assert.ok(contextualPrompt.includes('User context:'));
  });
});

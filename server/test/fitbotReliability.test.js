const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isTransient, chatCompletionDetailed } = require('../src/services/openrouter.service');
const { chat } = require('../src/controllers/aiAssistant.controller');

describe('FitBot Reliability: Pure Message History Transformation Logic', () => {
  // Pure helper implementations matching client/src/utils/fitbotHistory.ts
  const getValidMessages = (messages) => messages.filter((m) => !m.isError && m.text?.trim().length > 0);

  const getRetryContext = (messages) => {
    const valid = getValidMessages(messages);
    let userIdx = -1;
    for (let i = valid.length - 1; i >= 0; i--) {
      if (valid[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return null;
    return {
      prompt: valid[userIdx].text,
      precedingHistory: valid.slice(0, userIdx),
    };
  };

  const getRegenerateContext = (messages) => {
    const valid = getValidMessages(messages);
    if (valid.length < 2) return null;
    const lastMsg = valid[valid.length - 1];
    if (lastMsg.role !== 'assistant') return null;

    let userIdx = -1;
    for (let i = valid.length - 2; i >= 0; i--) {
      if (valid[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return null;

    return {
      prompt: valid[userIdx].text,
      precedingHistory: valid.slice(0, userIdx),
      trimmedMessages: valid.slice(0, valid.length - 1),
    };
  };

  it('getRetryContext identifies the failed user turn and excludes error bubbles', () => {
    const messages = [
      { id: '1', role: 'user', text: 'Turn 1 user', timestamp: new Date() },
      { id: '2', role: 'assistant', text: 'Turn 1 assistant', timestamp: new Date() },
      { id: '3', role: 'user', text: 'Turn 2 failed user prompt', timestamp: new Date() },
      { id: '4', role: 'assistant', text: 'Network connection failed', timestamp: new Date(), isError: true },
    ];

    const ctx = getRetryContext(messages);
    assert.ok(ctx);
    assert.equal(ctx.prompt, 'Turn 2 failed user prompt');
    assert.equal(ctx.precedingHistory.length, 2);
    assert.equal(ctx.precedingHistory[0].text, 'Turn 1 user');
    assert.equal(ctx.precedingHistory[1].text, 'Turn 1 assistant');
    // Verifies no error bubble in preceding history
    assert.ok(!ctx.precedingHistory.some((m) => m.isError));
  });

  it('getRegenerateContext trims the last assistant answer and retrieves the associated prompt', () => {
    const messages = [
      { id: '1', role: 'user', text: 'Suggest 3 core exercises', timestamp: new Date() },
      { id: '2', role: 'assistant', text: '1. Planks 2. Crunches 3. Leg raises', timestamp: new Date() },
    ];

    const ctx = getRegenerateContext(messages);
    assert.ok(ctx);
    assert.equal(ctx.prompt, 'Suggest 3 core exercises');
    assert.equal(ctx.precedingHistory.length, 0);
    // UI trimmed messages removes only the last assistant message
    assert.equal(ctx.trimmedMessages.length, 1);
    assert.equal(ctx.trimmedMessages[0].text, 'Suggest 3 core exercises');
  });

  it('getRegenerateContext preserves earlier multi-turn history', () => {
    const messages = [
      { id: '1', role: 'user', text: 'My goal is weight loss', timestamp: new Date() },
      { id: '2', role: 'assistant', text: 'Great, what is your current weight?', timestamp: new Date() },
      { id: '3', role: 'user', text: 'I weigh 80kg', timestamp: new Date() },
      { id: '4', role: 'assistant', text: 'Understood, your maintenance is ~2200 kcal', timestamp: new Date() },
    ];

    const ctx = getRegenerateContext(messages);
    assert.ok(ctx);
    assert.equal(ctx.prompt, 'I weigh 80kg');
    assert.equal(ctx.precedingHistory.length, 2);
    assert.equal(ctx.precedingHistory[1].text, 'Great, what is your current weight?');
    assert.equal(ctx.trimmedMessages.length, 3);
  });
});

describe('FitBot Reliability: Cancellation & Stale Response Protection', () => {
  it('isTransient returns false when error has isClientAbort or non-timeout AbortError', () => {
    const clientAbortErr = new Error('Client aborted request');
    clientAbortErr.name = 'AbortError';
    clientAbortErr.isClientAbort = true;

    assert.equal(isTransient(null, clientAbortErr), false, 'Client explicit cancel must never be marked transient');

    const manualAbortErr = new Error('The user aborted a request');
    manualAbortErr.name = 'AbortError';
    assert.equal(isTransient(null, manualAbortErr), false, 'Manual user abort must not be marked transient');

    // Timeout AbortError remains transient for bounded retry
    const timeoutErr = new Error('OpenRouter request timed out after 15000ms');
    timeoutErr.name = 'AbortError';
    assert.equal(isTransient(null, timeoutErr), true, 'Timeout AbortError remains transient for bounded retry');
  });

  it('chatCompletionDetailed rejects immediately when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('User pressed Stop'));

    await assert.rejects(
      async () => {
        await chatCompletionDetailed({
          messages: [{ role: 'user', content: 'Hello' }],
          title: 'Test Stop',
          signal: controller.signal,
        });
      },
      (err) => {
        assert.equal(err.name, 'AbortError');
        assert.equal(err.isClientAbort, true);
        return true;
      }
    );
  });

  it('chat controller suppresses writing response when client disconnected (res.writableEnded)', async () => {
    const req = {
      body: { messages: [{ role: 'user', content: 'What is hydration?' }] },
      user: { id: 'test-user-id' },
      on: () => {},
      removeListener: () => {},
    };

    let written = false;
    const res = {
      writableEnded: true, // Simulates client connection already closed
      headersSent: true,
      status() {
        written = true;
        return this;
      },
      json() {
        written = true;
        return this;
      },
    };

    await chat(req, res, () => {});

    assert.equal(written, false, 'Controller must not attempt writing response to already closed connection');
  });
});

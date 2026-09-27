const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../src/utils/logger');

describe('Structured Logger & Secret Scrubber Tests', () => {
  it('scrubs passwords, tokens, API keys, and secrets from objects', () => {
    const rawData = {
      username: 'jashan',
      password: 'SuperSecretPassword123!',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayload.signature',
      apiKey: 'sk-or-v1-abcdef1234567890',
      nested: {
        authorization: 'Bearer secret_access_token_abc123',
        openrouter_api_key: 'sk-or-real-key',
        safeProperty: 'fitness goal',
      },
      list: [
        { secret: 'verysecret' },
        { activity: 'running' },
      ],
    };

    const scrubbed = logger.scrubSecrets(rawData);

    assert.equal(scrubbed.username, 'jashan');
    assert.equal(scrubbed.password, '[REDACTED]');
    assert.equal(scrubbed.token, '[REDACTED]');
    assert.equal(scrubbed.apiKey, '[REDACTED]');
    assert.equal(scrubbed.nested.authorization, '[REDACTED]');
    assert.equal(scrubbed.nested.openrouter_api_key, '[REDACTED]');
    assert.equal(scrubbed.nested.safeProperty, 'fitness goal');
    assert.equal(scrubbed.list[0].secret, '[REDACTED]');
    assert.equal(scrubbed.list[1].activity, 'running');
  });

  it('redacts standalone Bearer token strings and JWT strings', () => {
    const bearerString = 'Bearer 12345abcdef67890';
    assert.equal(logger.scrubSecrets(bearerString), 'Bearer [REDACTED]');

    const jwtString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    assert.equal(logger.scrubSecrets(jwtString), '[REDACTED_JWT]');
  });
});

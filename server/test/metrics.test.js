const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const metrics = require('../src/utils/metrics');
const app = require('../src/app');

describe('Prometheus Metrics Registry Unit Tests', () => {
  beforeEach(() => {
    metrics.reset();
    metrics.registerDefaults();
  });

  it('increments counters with labels and generates Prometheus formatted output', () => {
    metrics.increment('password_reset_requests_total', { outcome: 'sent' });
    metrics.increment('password_reset_requests_total', { outcome: 'sent' });
    metrics.increment('password_reset_requests_total', { outcome: 'locked' });

    const output = metrics.getPrometheusFormat();

    assert.ok(output.includes('# HELP password_reset_requests_total'));
    assert.ok(output.includes('# TYPE password_reset_requests_total counter'));
    assert.ok(output.includes('password_reset_requests_total{outcome="sent"} 2'));
    assert.ok(output.includes('password_reset_requests_total{outcome="locked"} 1'));
  });

  it('records histogram observations with buckets, sum, and count', () => {
    metrics.observe('password_reset_email_duration_seconds', {}, 0.35);
    metrics.observe('password_reset_email_duration_seconds', {}, 1.2);

    const output = metrics.getPrometheusFormat();

    assert.ok(output.includes('# HELP password_reset_email_duration_seconds'));
    assert.ok(output.includes('# TYPE password_reset_email_duration_seconds histogram'));
    assert.ok(output.includes('password_reset_email_duration_seconds_bucket{le="0.5"} 1'));
    assert.ok(output.includes('password_reset_email_duration_seconds_bucket{le="2.5"} 2'));
    assert.ok(output.includes('password_reset_email_duration_seconds_bucket{le="+Inf"} 2'));
    assert.ok(output.includes('password_reset_email_duration_seconds_count 2'));
  });

  it('sets gauge values and reflects in output', () => {
    metrics.set('password_reset_active_lockouts', {}, 3);
    const output = metrics.getPrometheusFormat();

    assert.ok(output.includes('# TYPE password_reset_active_lockouts gauge'));
    assert.ok(output.includes('password_reset_active_lockouts 3'));
  });

  it('returns JSON representation of metrics', () => {
    metrics.increment('password_reset_requests_total', { outcome: 'sent' });
    const json = metrics.getMetricsJSON();

    assert.ok(json.counters['password_reset_requests_total{outcome="sent"}']);
    assert.equal(json.counters['password_reset_requests_total{outcome="sent"}'], 1);
  });
});

describe('Metrics HTTP Endpoint Integration Tests', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    if (!server) {
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const address = server.address();
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    }
    metrics.reset();
    metrics.registerDefaults();
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  it('GET /metrics returns 200 with Prometheus content-type in open mode', async () => {
    const originalToken = process.env.METRICS_TOKEN;
    delete process.env.METRICS_TOKEN;

    try {
      metrics.increment('password_reset_requests_total', { outcome: 'sent' });
      const res = await fetch(`${baseUrl}/metrics`);
      const text = await res.text();

      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('text/plain'));
      assert.ok(text.includes('password_reset_requests_total{outcome="sent"} 1'));
    } finally {
      process.env.METRICS_TOKEN = originalToken;
    }
  });

  it('GET /api/metrics returns 200 via API gateway router', async () => {
    const originalToken = process.env.METRICS_TOKEN;
    delete process.env.METRICS_TOKEN;

    try {
      const res = await fetch(`${baseUrl}/api/metrics`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type').includes('text/plain'));
    } finally {
      process.env.METRICS_TOKEN = originalToken;
    }
  });

  it('GET /metrics enforces token authentication when METRICS_TOKEN is set', async () => {
    const originalToken = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = 'secure-secret-metrics-token-123';

    try {
      // 1. Missing token -> 401
      const unauthedRes = await fetch(`${baseUrl}/metrics`);
      assert.equal(unauthedRes.status, 401);

      // 2. Wrong token -> 401
      const badTokenRes = await fetch(`${baseUrl}/metrics`, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      assert.equal(badTokenRes.status, 401);

      // 3. Valid Bearer header -> 200
      const validHeaderRes = await fetch(`${baseUrl}/metrics`, {
        headers: { Authorization: 'Bearer secure-secret-metrics-token-123' },
      });
      assert.equal(validHeaderRes.status, 200);

      // 4. Valid query token -> 200
      const validQueryRes = await fetch(`${baseUrl}/metrics?token=secure-secret-metrics-token-123`);
      assert.equal(validQueryRes.status, 200);
    } finally {
      process.env.METRICS_TOKEN = originalToken;
    }
  });
});

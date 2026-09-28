const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

describe('Health and Request-ID Middleware Tests', () => {
  it('GET /api/health returns status ok with uptime and database status when DB is connected', async () => {
    const mongoose = require('mongoose');
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    let statusCode = null;
    let responseBody = null;

    const req = {
      method: 'GET',
      url: '/api/health',
      headers: {},
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
      on() {},
    };

    try {
      const healthLayer = app._router.stack.find(
        (layer) => layer.route && layer.route.path === '/api/health'
      );
      assert.ok(healthLayer, 'Health route layer should exist');

      await healthLayer.route.stack[0].handle(req, res, () => {});

      assert.equal(statusCode ?? res.statusCode, 200);
      assert.equal(responseBody.status, 'ok');
      assert.equal(responseBody.database, 'connected');
      assert.ok(typeof responseBody.uptime === 'number');
      assert.ok(responseBody.timestamp);
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    }
  });

  it('GET /api/health returns 503 degraded when DB is disconnected in non-test mode', async () => {
    const mongoose = require('mongoose');
    const originalReadyState = mongoose.connection.readyState;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

    let statusCode = null;
    let responseBody = null;

    const req = {
      method: 'GET',
      url: '/api/health',
      headers: {},
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
      on() {},
    };

    try {
      const healthLayer = app._router.stack.find(
        (layer) => layer.route && layer.route.path === '/api/health'
      );

      await healthLayer.route.stack[0].handle(req, res, () => {});

      assert.equal(statusCode, 503);
      assert.equal(responseBody.status, 'degraded');
      assert.equal(responseBody.database, 'disconnected');
    } finally {
      process.env.NODE_ENV = originalEnv;
      Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    }
  });

  it('requestId middleware generates UUID when X-Request-Id is not provided', () => {
    const requestIdMiddleware = require('../src/middleware/requestId');
    const req = { headers: {} };
    const res = {
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
    };
    let nextCalled = false;

    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
    assert.ok(req.id);
    assert.equal(res.headers['X-Request-Id'], req.id);
    assert.match(req.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('requestId middleware preserves existing incoming X-Request-Id', () => {
    const requestIdMiddleware = require('../src/middleware/requestId');
    const req = { headers: { 'x-request-id': 'client-test-req-123' } };
    const res = {
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
    };

    requestIdMiddleware(req, res, () => {});

    assert.equal(req.id, 'client-test-req-123');
    assert.equal(res.headers['X-Request-Id'], 'client-test-req-123');
  });
});

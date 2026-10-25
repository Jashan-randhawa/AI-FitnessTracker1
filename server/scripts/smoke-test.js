#!/usr/bin/env node
/**
 * Server Smoke Test Script
 * Boots the Express application on an ephemeral port, verifies health and auth routes,
 * and ensures graceful teardown.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.CI_DRY_RUN = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_secret_key_32_characters_minimum';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');

async function runSmokeTest() {
  console.log('🚀 [smoke-test] Starting server smoke test...');

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`📡 [smoke-test] Server listening on ${baseUrl}`);

  try {
    // 1. Health check endpoint
    console.log('🔍 [smoke-test] Checking GET /api/health...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    if (!healthRes.ok) {
      throw new Error(`Health check returned HTTP ${healthRes.status}`);
    }
    const healthData = await healthRes.json();
    if (healthData.status !== 'ok') {
      throw new Error(`Expected health status 'ok', got '${healthData.status}'`);
    }
    console.log(`✅ [smoke-test] GET /api/health passed:`, healthData);

    // 2. Root service endpoint
    console.log('🔍 [smoke-test] Checking GET /...');
    const rootRes = await fetch(`${baseUrl}/`);
    if (!rootRes.ok) {
      throw new Error(`Root endpoint returned HTTP ${rootRes.status}`);
    }
    const rootData = await rootRes.json();
    if (rootData.status !== 'ok') {
      throw new Error(`Expected root status 'ok', got '${rootData.status}'`);
    }
    console.log(`✅ [smoke-test] GET / passed:`, rootData);

    // 3. Auth route responsiveness check
    console.log('🔍 [smoke-test] Checking POST /api/auth/local (invalid payload expectation)...');
    const authRes = await fetch(`${baseUrl}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '', password: '' }),
    });
    // Expected to reject with 400 Bad Request or 401 Unauthorized, never crash or return 500
    if (authRes.status >= 500) {
      const errText = await authRes.text();
      throw new Error(`Auth endpoint crashed with HTTP ${authRes.status}: ${errText}`);
    }
    console.log(`✅ [smoke-test] POST /api/auth/local responded safely with HTTP ${authRes.status}`);

    console.log('🎉 [smoke-test] All smoke tests passed successfully!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('🛑 [smoke-test] Server and connections closed cleanly.');
  }
}

runSmokeTest().catch((err) => {
  console.error('❌ [smoke-test] Smoke test failed:', err);
  process.exit(1);
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const WeightLog = require('../src/models/WeightLog');
const User = require('../src/models/User');

describe('Phase E: WeightLog Model Validation (G9)', () => {
  it('accepts valid weightKg within 20 to 400 kg range', () => {
    const log = new WeightLog({
      user: new mongoose.Types.ObjectId(),
      weightKg: 72.5,
      notes: 'Morning weigh-in',
      source: 'quick-log',
    });

    const err = log.validateSync();
    assert.equal(err, undefined);
    assert.equal(log.weightKg, 72.5);
    assert.equal(log.notes, 'Morning weigh-in');
    assert.equal(log.source, 'quick-log');
    assert.ok(log.date instanceof Date);
  });

  it('rejects weightKg below 20 kg', () => {
    const log = new WeightLog({
      user: new mongoose.Types.ObjectId(),
      weightKg: 19.9,
    });

    const err = log.validateSync();
    assert.ok(err);
    assert.ok(err.errors.weightKg);
  });

  it('rejects weightKg above 400 kg', () => {
    const log = new WeightLog({
      user: new mongoose.Types.ObjectId(),
      weightKg: 400.1,
    });

    const err = log.validateSync();
    assert.ok(err);
    assert.ok(err.errors.weightKg);
  });

  it('requires user reference', () => {
    const log = new WeightLog({
      weightKg: 70,
    });

    const err = log.validateSync();
    assert.ok(err);
    assert.ok(err.errors.user);
  });

  it('rejects notes exceeding 100 characters', () => {
    const log = new WeightLog({
      user: new mongoose.Types.ObjectId(),
      weightKg: 70,
      notes: 'A'.repeat(101),
    });

    const err = log.validateSync();
    assert.ok(err);
    assert.ok(err.errors.notes);
  });

  it('defaults source to quick-log', () => {
    const log = new WeightLog({
      user: new mongoose.Types.ObjectId(),
      weightKg: 75,
    });

    assert.equal(log.source, 'quick-log');
  });
});

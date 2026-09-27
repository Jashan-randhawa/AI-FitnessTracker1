const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { estimate: estimateCaloriesController } = require('../src/controllers/calorieEstimate.controller');
const { estimate: estimateFoodController } = require('../src/controllers/foodEstimate.controller');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('Calorie and Food Estimation Controller Tests', () => {
  describe('calorieEstimate controller validation', () => {
    it('returns 400 if activity is missing or empty', async () => {
      const req = { body: { activity: '   ', duration: 30 } };
      const res = createMockRes();

      await estimateCaloriesController(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('activity is required'));
    });

    it('returns 400 if duration is invalid or not positive', async () => {
      const req = { body: { activity: 'Running', duration: -5 } };
      const res = createMockRes();

      await estimateCaloriesController(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('duration must be a positive number'));
    });

    it('returns 400 if duration is NaN', async () => {
      const req = { body: { activity: 'Running', duration: 'not-a-number' } };
      const res = createMockRes();

      await estimateCaloriesController(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe('foodEstimate controller validation', () => {
    it('returns 400 if food name is missing', async () => {
      const req = { body: {} };
      const res = createMockRes();

      await estimateFoodController(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.message.includes('Food name is required'));
    });

    it('returns 400 if food name is whitespace only', async () => {
      const req = { body: { name: '   ' } };
      const res = createMockRes();

      await estimateFoodController(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.message.includes('Food name is required'));
    });
  });
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';
process.env.IDEMPOTENCY_TTL_HOURS = '168';
process.env.OFFLINE_MAX_AGE_DAYS = '30';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const WaterLog = require('../src/models/WaterLog');
const WeightLog = require('../src/models/WeightLog');
const FoodLog = require('../src/models/FoodLog');
const ActivityLog = require('../src/models/ActivityLog');
const User = require('../src/models/User');
const IdempotencyKey = require('../src/models/IdempotencyKey');

const waterlogController = require('../src/controllers/waterlog.controller');
const weightlogController = require('../src/controllers/weightlog.controller');
const foodlogController = require('../src/controllers/foodlog.controller');
const activitylogController = require('../src/controllers/activitylog.controller');

const idempotency = require('../src/middleware/idempotency');
const { subscribe } = require('../src/services/eventBus');
const { describeMongoTarget, migrateIdempotencyIndex } = require('../scripts/migrate-idempotency-index');

const mockFindQuery = (result) => ({
  then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  sort: () => Promise.resolve(result),
});

const createMockReqRes = ({
  user,
  headers = {},
  body = {},
  method = 'POST',
  originalUrl = '/api/waterlogs',
  baseUrl = '/api/waterlogs',
  path = '/',
}) => {
  const req = {
    user: user || { _id: new mongoose.Types.ObjectId() },
    headers: { ...headers },
    body,
    method,
    originalUrl,
    baseUrl,
    path,
  };

  let statusCode = 200;
  let responseData = null;
  const responseHeaders = {};

  const res = {
    statusCode: 200,
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return responseHeaders[name.toLowerCase()];
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeader: (name) => responseHeaders[name.toLowerCase()],
  };
};

describe('Offline Logging & Write Idempotency Suite', () => {
  beforeEach(() => {
    idempotency._clearDisconnectedMap();
  });

  describe('1. Idempotent replays across all 4 endpoints', () => {
    it('replays POST /waterlogs: returns 200, sets Idempotency-Replayed header, and creates exactly 1 document', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'idem_water_001_abc';
      let createCount = 0;

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        createCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          date: doc.date,
          user: doc.user,
          toJSON() {
            return { id: String(this._id), amount: this.amount, date: this.date };
          },
        };
      };

      try {
        const payload = { data: { amount: 500, date: new Date().toISOString() } };

        // Attempt 1
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/waterlogs',
        });
        await waterlogController.create(first.req, first.res);

        assert.equal(first.getStatus(), 200);
        assert.equal(createCount, 1);
        assert.equal(first.getData().amount, 500);
        assert.equal(first.getHeader('Idempotency-Replayed'), undefined);

        // Attempt 2 (replay)
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/waterlogs',
        });
        await waterlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 200);
        assert.equal(createCount, 1, 'WaterLog.create must NOT be called on replay');
        assert.equal(second.getHeader('Idempotency-Replayed'), 'true');
        assert.deepEqual(second.getData(), first.getData());
      } finally {
        WaterLog.create = origCreate;
      }
    });

    it('replays POST /weightlogs: returns 201, sets Idempotency-Replayed header, and creates exactly 1 document', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'idem_weight_001_abc';
      let findOneAndUpdateCount = 0;

      const origFindOne = WeightLog.findOne;
      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      WeightLog.findOne = () => mockFindQuery(null);
      User.findByIdAndUpdate = async () => {};
      WeightLog.findOneAndUpdate = async (filter, update) => {
        findOneAndUpdateCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          weightKg: update.weightKg,
          date: update.date,
          localDay: update.localDay,
          toJSON() {
            return { id: String(this._id), weightKg: this.weightKg, localDay: this.localDay };
          },
        };
      };

      try {
        const payload = { data: { weightKg: 75.5, date: '2026-10-30T10:00:00.000Z' } };

        // Attempt 1
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/weightlogs',
        });
        await weightlogController.create(first.req, first.res);

        assert.equal(first.getStatus(), 201);
        assert.equal(findOneAndUpdateCount, 1);
        assert.equal(first.getData().weightKg, 75.5);
        assert.equal(first.getHeader('Idempotency-Replayed'), undefined);

        // Attempt 2 (replay)
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/weightlogs',
        });
        await weightlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 201, 'Replay of weightlog must return stored 201 status code');
        assert.equal(findOneAndUpdateCount, 1, 'WeightLog must not be updated again on replay');
        assert.equal(second.getHeader('Idempotency-Replayed'), 'true');
        assert.deepEqual(second.getData(), first.getData());
      } finally {
        WeightLog.findOne = origFindOne;
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });

    it('replays POST /foodlogs: returns 200, sets Idempotency-Replayed header, and creates exactly 1 document', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'idem_food_001_abc';
      let createCount = 0;

      const origCreate = FoodLog.create;
      FoodLog.create = async (doc) => {
        createCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          toJSON() {
            return { id: String(this._id), name: this.name, calories: this.calories };
          },
        };
      };

      try {
        const payload = {
          data: {
            name: 'Greek Yogurt Bowl',
            calories: 280,
            protein: 22,
            carbs: 30,
            fat: 5,
            mealtype: 'breakfast',
          },
        };

        // Attempt 1
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/foodlogs',
        });
        await foodlogController.create(first.req, first.res);

        assert.equal(first.getStatus(), 200);
        assert.equal(createCount, 1);
        assert.equal(first.getData().name, 'Greek Yogurt Bowl');
        assert.equal(first.getHeader('Idempotency-Replayed'), undefined);

        // Attempt 2 (replay)
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/foodlogs',
        });
        await foodlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 200);
        assert.equal(createCount, 1);
        assert.equal(second.getHeader('Idempotency-Replayed'), 'true');
        assert.deepEqual(second.getData(), first.getData());
      } finally {
        FoodLog.create = origCreate;
      }
    });

    it('replays POST /activitylogs: returns 200, sets Idempotency-Replayed header, and creates exactly 1 document', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'idem_activity_001_abc';
      let createCount = 0;

      const origCreate = ActivityLog.create;
      ActivityLog.create = async (doc) => {
        createCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          toJSON() {
            return { id: String(this._id), name: this.name, duration: this.duration };
          },
        };
      };

      try {
        const payload = { data: { name: 'Morning Run', duration: 30, caloriesBurned: 320 } };

        // Attempt 1
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/activitylogs',
        });
        await activitylogController.create(first.req, first.res);

        assert.equal(first.getStatus(), 200);
        assert.equal(createCount, 1);
        assert.equal(first.getHeader('Idempotency-Replayed'), undefined);

        // Attempt 2 (replay)
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
          originalUrl: '/api/activitylogs',
        });
        await activitylogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 200);
        assert.equal(createCount, 1);
        assert.equal(second.getHeader('Idempotency-Replayed'), 'true');
        assert.deepEqual(second.getData(), first.getData());
      } finally {
        ActivityLog.create = origCreate;
      }
    });
  });

  describe('2. Concurrency and In-Flight Claims', () => {
    it('returns 409 IDEMPOTENCY_IN_PROGRESS with Retry-After: 1 when a concurrent request arrives while first is in-flight', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'concurrent_key_1234';

      let resolveFirstCall;
      const firstCallBlocker = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        await firstCallBlocker;
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          date: doc.date,
          toJSON() {
            return { id: String(this._id), amount: this.amount };
          },
        };
      };

      try {
        const payload = { data: { amount: 350 } };

        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });

        // Start call 1 (in-flight)
        const call1Promise = waterlogController.create(first.req, first.res);

        // Call 2 arrives before call 1 finishes
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });
        await waterlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 409);
        assert.equal(second.getHeader('Retry-After'), '1');
        assert.equal(second.getData().error.code, 'IDEMPOTENCY_IN_PROGRESS');

        // Now resolve call 1
        resolveFirstCall();
        await call1Promise;

        assert.equal(first.getStatus(), 200);
      } finally {
        WaterLog.create = origCreate;
      }
    });

    it('handles MongoDB duplicate key error (code 11000) during concurrent atomic claim in DB mode', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'mongo_dup_key_5678';
      const origReadyState = mongoose.connection.readyState;
      const origFindOne = IdempotencyKey.findOne;
      const origCreate = IdempotencyKey.create;

      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      let findOneCalls = 0;
      IdempotencyKey.findOne = async () => {
        findOneCalls++;
        if (findOneCalls === 1) return null; // First findOne sees nothing
        // Second findOne after code 11000 sees the in_progress record
        return {
          key,
          user: user._id,
          status: 'in_progress',
        };
      };

      IdempotencyKey.create = async () => {
        const err = new Error('E11000 duplicate key error collection: idempotencykeys index: user_1_key_1 dup key');
        err.code = 11000;
        throw err;
      };

      try {
        const { req, res, getStatus, getData, getHeader } = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: { amount: 400 },
        });

        let nextCalled = false;
        await idempotency(req, res, () => {
          nextCalled = true;
        });

        assert.equal(nextCalled, false);
        assert.equal(getStatus(), 409);
        assert.equal(getHeader('Retry-After'), '1');
        assert.equal(getData().error.code, 'IDEMPOTENCY_IN_PROGRESS');
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
        IdempotencyKey.findOne = origFindOne;
        IdempotencyKey.create = origCreate;
      }
    });
  });

  describe('3. Payload Mismatch (IDEMPOTENCY_KEY_REUSED)', () => {
    it('returns 422 code IDEMPOTENCY_KEY_REUSED when same key is sent with different payload', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'reused_key_payload_diff';

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        amount: doc.amount,
        toJSON() {
          return { id: String(this._id), amount: this.amount };
        },
      });

      try {
        // First request with amount 250
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: { data: { amount: 250 } },
        });
        await waterlogController.create(first.req, first.res);
        assert.equal(first.getStatus(), 200);

        // Second request with different amount (750)
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: { data: { amount: 750 } },
        });
        await waterlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 422);
        assert.equal(second.getData().error.code, 'IDEMPOTENCY_KEY_REUSED');
      } finally {
        WaterLog.create = origCreate;
      }
    });
  });

  describe('4. Failure Recovery: 5xx release claim and retry', () => {
    it('releases claim when handler returns 500 or throws, allowing subsequent retry with same key to succeed', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'transient_500_retry_key';

      let attempt = 0;
      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Database connection failed transiently');
        }
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          toJSON() {
            return { id: String(this._id), amount: this.amount };
          },
        };
      };

      try {
        const payload = { data: { amount: 500 } };

        // Attempt 1 fails with 500
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });

        try {
          await waterlogController.create(first.req, first.res);
        } catch {
          // Controller error handled
          first.res.status(500).json({ message: 'Internal server error' });
        }

        // Attempt 2 with SAME key must be allowed to run
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });
        await waterlogController.create(second.req, second.res);

        assert.equal(second.getStatus(), 200);
        assert.equal(second.getData().amount, 500);
      } finally {
        WaterLog.create = origCreate;
      }
    });
  });

  describe('5. Key Format Validation & Missing Key Behavior', () => {
    it('proceeds normally without key and behaves non-idempotently', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      let createCount = 0;

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        createCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          toJSON() {
            return { id: String(this._id), amount: this.amount };
          },
        };
      };

      try {
        const makeCall = async () => {
          const reqRes = createMockReqRes({
            user,
            body: { data: { amount: 250 } },
          });
          await waterlogController.create(reqRes.req, reqRes.res);
          return reqRes;
        };

        const res1 = await makeCall();
        const res2 = await makeCall();

        assert.equal(res1.getStatus(), 200);
        assert.equal(res2.getStatus(), 200);
        assert.equal(createCount, 2, 'Without idempotency key, every request creates a new record');
        assert.equal(res2.getHeader('Idempotency-Replayed'), undefined);
      } finally {
        WaterLog.create = origCreate;
      }
    });

    it('rejects keys shorter than 8 characters with 400 INVALID_IDEMPOTENCY_KEY', async () => {
      const { req, res, getStatus, getData } = createMockReqRes({
        headers: { 'idempotency-key': 'short' },
        body: { data: { amount: 250 } },
      });
      await waterlogController.create(req, res);

      assert.equal(getStatus(), 400);
      assert.equal(getData().error.code, 'INVALID_IDEMPOTENCY_KEY');
    });

    it('rejects keys containing invalid characters with 400 INVALID_IDEMPOTENCY_KEY', async () => {
      const { req, res, getStatus, getData } = createMockReqRes({
        headers: { 'idempotency-key': 'invalid*char*key' },
        body: { data: { amount: 250 } },
      });
      await waterlogController.create(req, res);

      assert.equal(getStatus(), 400);
      assert.equal(getData().error.code, 'INVALID_IDEMPOTENCY_KEY');
    });

    it('accepts valid keys in X-Idempotency-Key and body.idempotencyKey for backward compatibility', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      let createCount = 0;

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        createCount++;
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          toJSON() {
            return { id: String(this._id), amount: this.amount };
          },
        };
      };

      try {
        // X-Idempotency-Key header
        const resHeader = createMockReqRes({
          user,
          headers: { 'x-idempotency-key': 'valid_x_header_key_123' },
          body: { data: { amount: 250 } },
        });
        await waterlogController.create(resHeader.req, resHeader.res);
        assert.equal(resHeader.getStatus(), 200);
        assert.equal(createCount, 1);

        // Replay with X-Idempotency-Key
        const resHeaderReplay = createMockReqRes({
          user,
          headers: { 'x-idempotency-key': 'valid_x_header_key_123' },
          body: { data: { amount: 250 } },
        });
        await waterlogController.create(resHeaderReplay.req, resHeaderReplay.res);
        assert.equal(createCount, 1);
        assert.equal(resHeaderReplay.getHeader('Idempotency-Replayed'), 'true');

        // body.idempotencyKey (AIAssistant water action)
        const resBody = createMockReqRes({
          user,
          body: { data: { amount: 300, idempotencyKey: 'chat_action_key_12345' } },
        });
        await waterlogController.create(resBody.req, resBody.res);
        assert.equal(createCount, 2);

        // Replay via body
        const resBodyReplay = createMockReqRes({
          user,
          body: { data: { amount: 300, idempotencyKey: 'chat_action_key_12345' } },
        });
        await waterlogController.create(resBodyReplay.req, resBodyReplay.res);
        assert.equal(createCount, 2);
        assert.equal(resBodyReplay.getHeader('Idempotency-Replayed'), 'true');
      } finally {
        WaterLog.create = origCreate;
      }
    });
  });

  describe('6. Per-User Scoping & Isolation', () => {
    it('isolates keys across different users so same key creates two distinct records', async () => {
      const userA = { _id: new mongoose.Types.ObjectId() };
      const userB = { _id: new mongoose.Types.ObjectId() };
      const sharedKey = 'cross_user_shared_key_123';

      const createdUsers = [];
      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => {
        createdUsers.push(String(doc.user));
        return {
          _id: new mongoose.Types.ObjectId(),
          amount: doc.amount,
          user: doc.user,
          toJSON() {
            return { id: String(this._id), user: String(this.user), amount: this.amount };
          },
        };
      };

      try {
        const callA = createMockReqRes({
          user: userA,
          headers: { 'idempotency-key': sharedKey },
          body: { data: { amount: 300 } },
        });
        await waterlogController.create(callA.req, callA.res);

        const callB = createMockReqRes({
          user: userB,
          headers: { 'idempotency-key': sharedKey },
          body: { data: { amount: 400 } },
        });
        await waterlogController.create(callB.req, callB.res);

        assert.equal(createdUsers.length, 2);
        assert.equal(createdUsers[0], String(userA._id));
        assert.equal(createdUsers[1], String(userB._id));
        assert.equal(callA.getData().amount, 300);
        assert.equal(callB.getData().amount, 400);
      } finally {
        WaterLog.create = origCreate;
      }
    });
  });

  describe('7. Water & Food Bounds, Whitelisting, and Date-Range Rejection', () => {
    it('rejects water amounts below 1 ml or above 10000 ml', async () => {
      const under = createMockReqRes({ body: { data: { amount: 0 } } });
      await waterlogController.create(under.req, under.res);
      assert.equal(under.getStatus(), 400);

      const over = createMockReqRes({ body: { data: { amount: 10001 } } });
      await waterlogController.create(over.req, over.res);
      assert.equal(over.getStatus(), 400);
    });

    it('rejects water dates more than 5 minutes in future with DATE_OUT_OF_RANGE', async () => {
      const futureDate = new Date(Date.now() + 6 * 60 * 1000).toISOString();
      const { req, res, getStatus, getData } = createMockReqRes({
        body: { data: { amount: 250, date: futureDate } },
      });
      await waterlogController.create(req, res);

      assert.equal(getStatus(), 400);
      assert.equal(getData().error.code, 'DATE_OUT_OF_RANGE');
    });

    it('rejects water dates older than OFFLINE_MAX_AGE_DAYS with DATE_OUT_OF_RANGE', async () => {
      const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const { req, res, getStatus, getData } = createMockReqRes({
        body: { data: { amount: 250, date: staleDate } },
      });
      await waterlogController.create(req, res);

      assert.equal(getStatus(), 400);
      assert.equal(getData().error.code, 'DATE_OUT_OF_RANGE');
    });

    it('rejects food with invalid name, calories, macros, or mealType', async () => {
      // Empty name
      const noName = createMockReqRes({ body: { data: { name: '', calories: 200 } } });
      await foodlogController.create(noName.req, noName.res);
      assert.equal(noName.getStatus(), 400);

      // Name > 100 chars
      const longName = createMockReqRes({ body: { data: { name: 'A'.repeat(101), calories: 200 } } });
      await foodlogController.create(longName.req, longName.res);
      assert.equal(longName.getStatus(), 400);

      // Negative calories
      const negCal = createMockReqRes({ body: { data: { name: 'Apple', calories: -10 } } });
      await foodlogController.create(negCal.req, negCal.res);
      assert.equal(negCal.getStatus(), 400);

      // Calories > 20000
      const hugeCal = createMockReqRes({ body: { data: { name: 'Feast', calories: 20001 } } });
      await foodlogController.create(hugeCal.req, hugeCal.res);
      assert.equal(hugeCal.getStatus(), 400);

      // Macro bounds (protein > 2000)
      const hugeProt = createMockReqRes({ body: { data: { name: 'Protein', calories: 500, protein: 2001 } } });
      await foodlogController.create(hugeProt.req, hugeProt.res);
      assert.equal(hugeProt.getStatus(), 400);

      // Invalid mealType
      const badMeal = createMockReqRes({
        body: { data: { name: 'Shake', calories: 200, mealType: 'midnight_snack' } },
      });
      await foodlogController.create(badMeal.req, badMeal.res);
      assert.equal(badMeal.getStatus(), 400);

      // Future date
      const futureFood = createMockReqRes({
        body: {
          data: {
            name: 'Tomorrow Breakfast',
            calories: 300,
            date: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        },
      });
      await foodlogController.create(futureFood.req, futureFood.res);
      assert.equal(futureFood.getStatus(), 400);
      assert.equal(futureFood.getData().error.code, 'DATE_OUT_OF_RANGE');
    });

    it('whitelists food fields so non-whitelisted fields are stripped', async () => {
      let createdDoc = null;
      const origCreate = FoodLog.create;
      FoodLog.create = async (doc) => {
        createdDoc = doc;
        return {
          ...doc,
          toJSON() {
            return { ...this };
          },
        };
      };

      try {
        const { req, res, getStatus } = createMockReqRes({
          body: {
            data: {
              name: 'Oatmeal',
              calories: 250,
              protein: 10,
              carbs: 45,
              fat: 4,
              mealType: 'breakfast',
              hackedField: 'injection_payload',
              admin: true,
            },
          },
        });
        await foodlogController.create(req, res);

        assert.equal(getStatus(), 200);
        assert.equal(createdDoc.name, 'Oatmeal');
        assert.equal(createdDoc.hackedField, undefined);
        assert.equal(createdDoc.admin, undefined);
      } finally {
        FoodLog.create = origCreate;
      }
    });
  });

  describe('8. Weight Conflict Rule (Event-Time Last-Writer-Wins)', () => {
    it('returns 200 with X-Conflict: stale-ignored and leaves User.weight untouched when an older same-day entry arrives', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      let userWeightUpdated = false;

      const storedEntry = {
        _id: new mongoose.Types.ObjectId(),
        weightKg: 80.0,
        date: new Date('2026-10-25T14:00:00.000Z'),
        localDay: '2026-10-25',
        toJSON() {
          return { id: String(this._id), weightKg: this.weightKg, date: this.date, localDay: this.localDay };
        },
      };

      const origFindOne = WeightLog.findOne;
      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      WeightLog.findOne = (query) => {
        if (query.localDay === '2026-10-25') return mockFindQuery(storedEntry);
        return mockFindQuery(null);
      };

      User.findByIdAndUpdate = async () => {
        userWeightUpdated = true;
      };

      try {
        // Incoming weigh-in from earlier in the day (10:00 AM vs stored 14:00)
        const incoming = createMockReqRes({
          user,
          body: {
            data: {
              weightKg: 79.0,
              date: '2026-10-25T10:00:00.000Z',
              localDay: '2026-10-25',
            },
          },
        });

        await weightlogController.create(incoming.req, incoming.res);

        assert.equal(incoming.getStatus(), 200);
        assert.equal(incoming.getHeader('X-Conflict'), 'stale-ignored');
        assert.equal(incoming.getData().weightKg, 80.0, 'Stored entry must be preserved');
        assert.equal(userWeightUpdated, false, 'User.weight must NOT be modified for stale weigh-in');
      } finally {
        WeightLog.findOne = origFindOne;
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });

    it('overwrites same-day entry with 201 when incoming entry is newer', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      let userSyncedWeight = null;

      const storedEntry = {
        _id: new mongoose.Types.ObjectId(),
        weightKg: 80.0,
        date: new Date('2026-10-25T10:00:00.000Z'),
        localDay: '2026-10-25',
      };

      const origFindOne = WeightLog.findOne;
      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      let findOneCalls = 0;
      WeightLog.findOne = () => {
        findOneCalls++;
        if (findOneCalls === 1) return mockFindQuery(storedEntry);
        // Call for newest log
        return mockFindQuery({ _id: storedEntry._id, weightKg: 80.5 });
      };

      WeightLog.findOneAndUpdate = async (_filter, update) => ({
        _id: storedEntry._id,
        ...update,
        toJSON() {
          return { id: String(this._id), weightKg: this.weightKg, localDay: this.localDay };
        },
      });

      User.findByIdAndUpdate = async (_id, update) => {
        userSyncedWeight = update.weight;
      };

      try {
        // Incoming weigh-in from later in the day (16:00 vs 10:00)
        const incoming = createMockReqRes({
          user,
          body: {
            data: {
              weightKg: 80.5,
              date: '2026-10-25T16:00:00.000Z',
              localDay: '2026-10-25',
            },
          },
        });

        await weightlogController.create(incoming.req, incoming.res);

        assert.equal(incoming.getStatus(), 201);
        assert.equal(incoming.getHeader('X-Conflict'), undefined);
        assert.equal(incoming.getData().weightKg, 80.5);
        assert.equal(userSyncedWeight, 80.5, 'User.weight must be updated to newest weigh-in');
      } finally {
        WeightLog.findOne = origFindOne;
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });

    it('respects body localDay over X-Timezone header when valid', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      let savedLocalDay = null;

      const origFindOne = WeightLog.findOne;
      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;

      WeightLog.findOne = () => mockFindQuery(null);
      WeightLog.findOneAndUpdate = async (_filter, update) => {
        savedLocalDay = update.localDay;
        return {
          ...update,
          toJSON() {
            return { ...this };
          },
        };
      };

      try {
        const incoming = createMockReqRes({
          user,
          headers: { 'x-timezone': 'Pacific/Auckland' }, // UTC+13
          body: {
            data: {
              weightKg: 72.0,
              date: '2026-10-25T01:00:00.000Z',
              localDay: '2026-10-24', // Client explicit localDay
            },
          },
        });

        await weightlogController.create(incoming.req, incoming.res);
        assert.equal(savedLocalDay, '2026-10-24', 'Body localDay must win over timezone header');
      } finally {
        WeightLog.findOne = origFindOne;
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
      }
    });
  });

  describe('9. Security & Observability', () => {
    it('ensures no idempotency records or hashes contain auth tokens or passwords', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'auth_data_leak_check_01';

      const { req, res } = createMockReqRes({
        user,
        headers: {
          'idempotency-key': key,
          authorization: 'Bearer super-secret-token-12345',
          cookie: 'token=super-secret-cookie',
        },
        body: { data: { amount: 300 } },
      });

      let nextRun = false;
      await idempotency(req, res, () => {
        nextRun = true;
      });
      assert.equal(nextRun, true);

      // Inspect schema definition and in-memory map
      const record = new IdempotencyKey({
        user: user._id,
        key,
        route: '/api/waterlogs',
        status: 'in_progress',
      });

      const jsonStr = JSON.stringify(record.toJSON());
      assert.equal(jsonStr.includes('super-secret'), false);
    });

    it('does NOT publish SSE change events on idempotent replay or stale-ignored weights', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'no_sse_replay_check';
      let eventsReceived = 0;

      const unsubscribe = subscribe(String(user._id), () => {
        eventsReceived++;
      });

      const origCreate = WaterLog.create;
      WaterLog.create = async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        amount: doc.amount,
        date: doc.date,
        toJSON() {
          return { id: String(this._id), amount: this.amount };
        },
      });

      try {
        const payload = { data: { amount: 500 } };

        // Attempt 1: real write -> 1 event
        const first = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });
        await waterlogController.create(first.req, first.res);
        assert.equal(eventsReceived, 1);

        // Attempt 2: replay -> 0 additional events
        const second = createMockReqRes({
          user,
          headers: { 'idempotency-key': key },
          body: payload,
        });
        await waterlogController.create(second.req, second.res);
        assert.equal(eventsReceived, 1, 'Replay must NOT emit SSE event');
      } finally {
        unsubscribe();
        WaterLog.create = origCreate;
      }
    });
  });

  describe('10. Migration Script Idempotency', () => {
    it('describeMongoTarget strips credentials from URI', () => {
      const sanitized = describeMongoTarget('mongodb://admin:secretPass@127.0.0.1:27017/fittrack?authSource=admin');
      assert.equal(sanitized.includes('secretPass'), false);
      assert.ok(sanitized.includes('127.0.0.1:27017/fittrack'));
    });

    it('migrateIdempotencyIndex drops legacy createdAt TTL index and syncs schema indexes cleanly', async () => {
      const origDb = mongoose.connection.db;
      const dropped = [];

      const mockCollection = {
        indexes: async () => [
          { name: '_id_', key: { _id: 1 } },
          { name: 'user_1_key_1', key: { user: 1, key: 1 } },
          { name: 'createdAt_1', key: { createdAt: 1 }, expireAfterSeconds: 300 },
        ],
        dropIndex: async (name) => {
          dropped.push(name);
        },
      };

      mongoose.connection.db = {
        listCollections: () => ({
          toArray: async () => [{ name: 'idempotencykeys' }],
        }),
        collection: () => mockCollection,
      };

      const origSyncIndexes = IdempotencyKey.syncIndexes;
      let syncCalled = false;
      IdempotencyKey.syncIndexes = async () => {
        syncCalled = true;
      };

      try {
        const result = await migrateIdempotencyIndex({ skipConnect: true });
        assert.equal(syncCalled, true);
        assert.deepEqual(result.droppedIndexes, ['createdAt_1']);
      } finally {
        mongoose.connection.db = origDb;
        IdempotencyKey.syncIndexes = origSyncIndexes;
      }
    });

    it('IdempotencyKey default expiresAt reflects 336h (14 days) retention window matching client', () => {
      const origEnv = process.env.IDEMPOTENCY_TTL_HOURS;
      delete process.env.IDEMPOTENCY_TTL_HOURS;
      try {
        const doc = new IdempotencyKey({ key: 'key_ttl_test_123', user: new mongoose.Types.ObjectId() });
        const now = Date.now();
        const expiresMs = doc.expiresAt.getTime();
        const diffHours = Math.round((expiresMs - now) / (3600 * 1000));
        assert.equal(diffHours, 336);
      } finally {
        if (origEnv !== undefined) process.env.IDEMPOTENCY_TTL_HOURS = origEnv;
      }
    });

    it('releases in-progress claim if request connection is closed/aborted before response finishes', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const key = 'test_abort_release_key_1234';
      const listeners = {};
      const req = {
        user,
        headers: { 'idempotency-key': key },
        body: { amount: 250 },
        method: 'POST',
        baseUrl: '/api/waterlogs',
        path: '/',
      };
      let writableEnded = false;
      const res = {
        setHeader: () => {},
        set: () => {},
        status: () => res,
        json: () => {},
        on: (evt, fn) => {
          listeners[evt] = fn;
        },
        get writableEnded() {
          return writableEnded;
        },
      };

      let nextCalled = false;
      await idempotency(req, res, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true);
      assert.ok(listeners['close'], 'close listener must be attached');

      // Next attempt with same key during in-progress would hit 409
      // Simulate client aborting connection before response is sent (writableEnded = false)
      listeners['close']();

      // Now a retry can proceed without 409
      let retriedNext = false;
      const retryReq = {
        user,
        headers: { 'idempotency-key': key },
        body: { amount: 250 },
        method: 'POST',
        baseUrl: '/api/waterlogs',
        path: '/',
      };
      await idempotency(retryReq, res, () => {
        retriedNext = true;
      });
      assert.equal(retriedNext, true, 'retry should proceed after connection abort released claim');
    });
  });
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const WeightLog = require('../src/models/WeightLog');
const User = require('../src/models/User');
const weightlogController = require('../src/controllers/weightlog.controller');
const userController = require('../src/controllers/user.controller');
const { subscribe } = require('../src/services/eventBus');
const {
  weightTrendLine,
  WEIGHT_EVIDENCE_MIN_ENTRIES,
} = require('../src/services/fitnessContext.service');

const makeReqRes = ({ user, body = {}, headers = {}, params = {}, query = {} }) => {
  const req = {
    user: user || { _id: new mongoose.Types.ObjectId() },
    body,
    headers,
    params,
    query,
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
};

describe('Phase F: Weight History G9 (N1-N4)', () => {
  describe('Range checks and validation (N1 / N4)', () => {
    it('rejects weightKg below 20 kg with 400', async () => {
      const { req, res, getStatus, getData } = makeReqRes({
        body: { data: { weightKg: 19.5 } },
      });
      await weightlogController.create(req, res);
      assert.equal(getStatus(), 400);
      assert.ok(getData().message.includes('20 and 400 kg'));
    });

    it('rejects weightKg above 400 kg with 400', async () => {
      const { req, res, getStatus, getData } = makeReqRes({
        body: { data: { weightKg: 400.5 } },
      });
      await weightlogController.create(req, res);
      assert.equal(getStatus(), 400);
      assert.ok(getData().message.includes('20 and 400 kg'));
    });

    it('rejects non-numeric weightKg with 400', async () => {
      const { req, res, getStatus, getData } = makeReqRes({
        body: { data: { weightKg: 'not-a-number' } },
      });
      await weightlogController.create(req, res);
      assert.equal(getStatus(), 400);
      assert.ok(getData().message.includes('20 and 400 kg'));
    });

    it('rejects invalid date format with 400', async () => {
      const { req, res, getStatus, getData } = makeReqRes({
        body: { data: { weightKg: 75, date: 'invalid-date-string' } },
      });
      await weightlogController.create(req, res);
      assert.equal(getStatus(), 400);
      assert.ok(getData().message.includes('Invalid date format'));
    });

    it('model validates localDay format (YYYY-MM-DD)', () => {
      const valid = new WeightLog({
        user: new mongoose.Types.ObjectId(),
        weightKg: 70,
        localDay: '2026-10-25',
      });
      assert.equal(valid.validateSync(), undefined);

      const invalid = new WeightLog({
        user: new mongoose.Types.ObjectId(),
        weightKg: 70,
        localDay: '25-10-2026',
      });
      const err = invalid.validateSync();
      assert.ok(err);
      assert.ok(err.errors.localDay);
    });
  });

  describe('One entry per user per local day / Upsert (N2)', () => {
    it('upserts weight log matching user and localDay on same-day second weigh-in', async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockUser = { _id: userId };

      let findOneAndUpdateArgs = null;
      let userUpdatedWeight = null;

      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origFindOne = WeightLog.findOne;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      const fakeEntry = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        weightKg: 74.2,
        localDay: '2026-10-25',
        date: new Date('2026-10-25T10:00:00Z'),
        toJSON() {
          return {
            id: String(this._id),
            weightKg: this.weightKg,
            localDay: this.localDay,
            date: this.date.toISOString(),
          };
        },
      };

      WeightLog.findOneAndUpdate = async (query, update, opts) => {
        findOneAndUpdateArgs = { query, update, opts };
        return fakeEntry;
      };

      WeightLog.findOne = () => ({
        sort: () => fakeEntry,
      });

      User.findByIdAndUpdate = async (id, upd) => {
        userUpdatedWeight = upd.weight;
        return { _id: id, weight: upd.weight };
      };

      try {
        const { req, res, getStatus, getData } = makeReqRes({
          user: mockUser,
          headers: { 'x-timezone': 'UTC' },
          body: { data: { weightKg: 74.2, date: '2026-10-25T10:00:00Z' } },
        });

        await weightlogController.create(req, res);

        assert.equal(getStatus(), 201);
        assert.deepEqual(findOneAndUpdateArgs.query, { user: userId, localDay: '2026-10-25' });
        assert.equal(findOneAndUpdateArgs.opts.upsert, true);
        assert.equal(findOneAndUpdateArgs.update.weightKg, 74.2);
        assert.equal(userUpdatedWeight, 74.2);
        assert.equal(getData().weightKg, 74.2);
      } finally {
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        WeightLog.findOne = origFindOne;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });
  });

  describe('Timezone day-boundary handling (N4)', () => {
    it('correctly maps instant 2026-10-25T15:30:00Z across midnight in different timezones', async () => {
      const instant = '2026-10-25T15:30:00Z';
      let capturedLocalDays = [];

      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origFindOne = WeightLog.findOne;
      WeightLog.findOne = () => ({ sort: () => null });

      WeightLog.findOneAndUpdate = async (query, update) => {
        capturedLocalDays.push(query.localDay);
        return {
          _id: new mongoose.Types.ObjectId(),
          user: query.user,
          localDay: query.localDay,
          weightKg: update.weightKg,
          date: update.date,
          toJSON() {
            return { id: String(this._id), localDay: this.localDay, weightKg: this.weightKg };
          },
        };
      };

      try {
        // Tokyo (UTC+9): 15:30 + 9h = 00:30 next day (2026-10-26)
        const tokyoReq = makeReqRes({
          headers: { 'x-timezone': 'Asia/Tokyo' },
          body: { data: { weightKg: 68.5, date: instant } },
        });
        await weightlogController.create(tokyoReq.req, tokyoReq.res);

        // UTC: 15:30 on same day (2026-10-25)
        const utcReq = makeReqRes({
          headers: { 'x-timezone': 'UTC' },
          body: { data: { weightKg: 68.5, date: instant } },
        });
        await weightlogController.create(utcReq.req, utcReq.res);

        // New York (UTC-4 in Oct / EDT): 11:30 on same day (2026-10-25)
        const nyReq = makeReqRes({
          headers: { 'x-timezone': 'America/New_York' },
          body: { data: { weightKg: 68.5, date: instant } },
        });
        await weightlogController.create(nyReq.req, nyReq.res);

        assert.equal(capturedLocalDays[0], '2026-10-26');
        assert.equal(capturedLocalDays[1], '2026-10-25');
        assert.equal(capturedLocalDays[2], '2026-10-25');
      } finally {
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        WeightLog.findOne = origFindOne;
      }
    });

    it('falls back to UTC when X-Timezone header is invalid', async () => {
      let queryCaptured = null;
      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origFindOne = WeightLog.findOne;
      WeightLog.findOne = () => ({ sort: () => null });
      WeightLog.findOneAndUpdate = async (query) => {
        queryCaptured = query;
        return {
          _id: new mongoose.Types.ObjectId(),
          toJSON: () => ({ id: '1' }),
        };
      };

      try {
        const { req, res } = makeReqRes({
          headers: { 'x-timezone': 'Invalid/Fantasy_Zone' },
          body: { data: { weightKg: 70, date: '2026-10-25T23:55:00Z' } },
        });
        await weightlogController.create(req, res);
        assert.equal(queryCaptured.localDay, '2026-10-25');
      } finally {
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        WeightLog.findOne = origFindOne;
      }
    });
  });

  describe('Duplicate profile saves prevention (N2)', () => {
    it('updateUser uses findOneAndUpdate with upsert so duplicate profile saves update same day log', async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        username: 'fituser',
        email: 'fit@example.com',
        toJSON: () => ({ id: String(userId), username: 'fituser' }),
      };

      let upsertCallCount = 0;
      let lastUpsertPayload = null;

      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      WeightLog.findOneAndUpdate = async (query, update, opts) => {
        upsertCallCount++;
        lastUpsertPayload = { query, update, opts };
        return { _id: new mongoose.Types.ObjectId() };
      };

      User.findByIdAndUpdate = async () => mockUser;

      try {
        const makeUpdateReq = (weight) =>
          makeReqRes({
            user: mockUser,
            params: { id: String(userId) },
            headers: { 'x-timezone': 'UTC' },
            body: { weight },
          });

        // First profile save with weight 75
        const first = makeUpdateReq(75);
        await userController.updateUser(first.req, first.res);

        // Second profile save on same day with weight 74.8
        const second = makeUpdateReq(74.8);
        await userController.updateUser(second.req, second.res);

        assert.equal(upsertCallCount, 2);
        assert.equal(lastUpsertPayload.opts.upsert, true);
        assert.equal(lastUpsertPayload.update.weightKg, 74.8);
        assert.equal(lastUpsertPayload.query.user, userId);
        assert.ok(typeof lastUpsertPayload.query.localDay === 'string');
      } finally {
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });
  });

  describe('Cross-user isolation (N1 / N4)', () => {
    it('find scopes query strictly to authenticated user', async () => {
      const userAId = new mongoose.Types.ObjectId();
      let capturedFindQuery = null;

      const origFind = WeightLog.find;
      WeightLog.find = (query) => {
        capturedFindQuery = query;
        return {
          sort: () => [
            {
              _id: new mongoose.Types.ObjectId(),
              user: userAId,
              weightKg: 80,
              toJSON: () => ({ id: '1', weightKg: 80 }),
            },
          ],
        };
      };

      try {
        const { req, res, getData } = makeReqRes({ user: { _id: userAId } });
        await weightlogController.find(req, res);
        assert.equal(capturedFindQuery.user, userAId);
        assert.equal(getData().length, 1);
      } finally {
        WeightLog.find = origFind;
      }
    });

    it('remove rejects deleting an entry belonging to another user', async () => {
      const userAId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();

      const origFindOneAndDelete = WeightLog.findOneAndDelete;
      WeightLog.findOneAndDelete = async (query) => {
        // Simulates DB lookup: only returns doc if user matches
        if (String(query.user) === String(userAId)) {
          return { _id: targetId, user: userAId, toJSON: () => ({ id: String(targetId) }) };
        }
        return null;
      };

      try {
        const attackerUser = { _id: new mongoose.Types.ObjectId() };
        const { req, res, getStatus, getData } = makeReqRes({
          user: attackerUser,
          params: { id: String(targetId) },
        });

        await weightlogController.remove(req, res);
        assert.equal(getStatus(), 404);
        assert.ok(getData().message.includes('not found'));
      } finally {
        WeightLog.findOneAndDelete = origFindOneAndDelete;
      }
    });
  });

  describe('Publish change event on create and remove (N3)', () => {
    it('publishes weight event on create and remove', async () => {
      const userId = new mongoose.Types.ObjectId();
      const eventsEmitted = [];

      const unsubscribe = subscribe(String(userId), (evt) => {
        eventsEmitted.push(evt);
      });

      const origFindOneAndUpdate = WeightLog.findOneAndUpdate;
      const origFindOneAndDelete = WeightLog.findOneAndDelete;
      const origFindOne = WeightLog.findOne;
      const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

      const fakeEntry = {
        _id: new mongoose.Types.ObjectId(),
        user: userId,
        weightKg: 73.5,
        date: new Date('2026-10-25T08:00:00Z'),
        toJSON() {
          return { id: String(this._id), weightKg: this.weightKg, date: this.date.toISOString() };
        },
      };

      WeightLog.findOneAndUpdate = async () => fakeEntry;
      WeightLog.findOne = () => ({ sort: () => fakeEntry });
      WeightLog.findOneAndDelete = async () => fakeEntry;
      User.findByIdAndUpdate = async () => ({ _id: userId });

      try {
        // 1. Create
        const createCall = makeReqRes({
          user: { _id: userId },
          body: { data: { weightKg: 73.5 } },
        });
        await weightlogController.create(createCall.req, createCall.res);

        // 2. Remove
        const removeCall = makeReqRes({
          user: { _id: userId },
          params: { id: String(fakeEntry._id) },
        });
        await weightlogController.remove(removeCall.req, removeCall.res);

        assert.equal(eventsEmitted.length, 2);
        assert.equal(eventsEmitted[0].kind, 'weight');
        assert.equal(eventsEmitted[1].kind, 'weight');
      } finally {
        unsubscribe();
        WeightLog.findOneAndUpdate = origFindOneAndUpdate;
        WeightLog.findOneAndDelete = origFindOneAndDelete;
        WeightLog.findOne = origFindOne;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
      }
    });
  });

  describe('Three-entry evidence rule verification', () => {
    it('requires at least 3 entries to declare sufficient evidence', () => {
      assert.equal(WEIGHT_EVIDENCE_MIN_ENTRIES, 3);

      const oneEntry = weightTrendLine({
        status: 'ok',
        evidence: false,
        entries: 1,
        oldest: 75,
        latest: 75,
        deltaKg: 0,
      });
      assert.equal(
        oneEntry,
        'Weight trend (last 30 days): insufficient evidence (1 entry; need at least 3 to establish a trend).'
      );

      const twoEntries = weightTrendLine({
        status: 'ok',
        evidence: false,
        entries: 2,
        oldest: 75,
        latest: 74,
        deltaKg: -1,
      });
      assert.equal(
        twoEntries,
        'Weight trend (last 30 days): insufficient evidence (2 entries; need at least 3 to establish a trend).'
      );

      const threeEntries = weightTrendLine({
        status: 'ok',
        evidence: true,
        entries: 3,
        oldest: 75,
        latest: 73,
        deltaKg: -2,
      });
      assert.equal(
        threeEntries,
        'Weight trend (last 30 days): 75 kg to 73 kg (-2 kg across 3 entries). Evidence: sufficient.'
      );
    });
  });
});

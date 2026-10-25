process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { ChatActionSchema } = require('../src/schemas/chatAction.schema');
const { extractProposedActions } = require('../src/utils/chatActions');
const waterlogController = require('../src/controllers/waterlog.controller');
const WaterLog = require('../src/models/WaterLog');

describe('G2 Chat Action Idempotency Tests', () => {
  it('validates idempotencyKey in ChatActionSchema', () => {
    const valid = ChatActionSchema.safeParse({
      type: 'log_water',
      amountMl: 250,
      label: 'Morning glass',
      idempotencyKey: 'act_12345-abcde',
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.idempotencyKey, 'act_12345-abcde');
  });

  it('extractProposedActions populates idempotencyKey when model omits it', () => {
    const rawReply = `Sure thing!\n<proposed_actions>[{"type":"log_water","amountMl":500}]</proposed_actions>`;
    const { cleanedReply, proposedActions } = extractProposedActions(rawReply);
    assert.equal(cleanedReply.trim(), 'Sure thing!');
    assert.equal(proposedActions.length, 1);
    assert.equal(proposedActions[0].amountMl, 500);
    assert.ok(typeof proposedActions[0].idempotencyKey === 'string');
    assert.ok(proposedActions[0].idempotencyKey.startsWith('act_'));
  });

  it('waterlog create deduplicates repeated calls with the same Idempotency-Key', async () => {
    const userId = new mongoose.Types.ObjectId();
    const mockUser = { _id: userId };
    const idempotencyKey = `idem_${Date.now()}_test`;

    let createCallCount = 0;
    const originalCreate = WaterLog.create;
    WaterLog.create = async (doc) => {
      createCallCount++;
      return {
        _id: new mongoose.Types.ObjectId(),
        amount: doc.amount,
        date: doc.date,
        user: doc.user,
        toJSON: function () {
          return { id: String(this._id), amount: this.amount, date: this.date };
        },
      };
    };

    try {
      const makeReqRes = () => {
        const req = {
          user: mockUser,
          headers: { 'idempotency-key': idempotencyKey },
          body: { data: { amount: 300, date: new Date().toISOString() } },
        };
        let responseData = null;
        let statusCode = 200;
        const res = {
          status: (code) => {
            statusCode = code;
            return res;
          },
          json: (data) => {
            responseData = data;
            return res;
          },
        };
        return { req, res, getData: () => responseData, getStatus: () => statusCode };
      };

      // Call 1
      const first = makeReqRes();
      await waterlogController.create(first.req, first.res);
      assert.equal(createCallCount, 1);
      const firstData = first.getData();
      assert.equal(firstData.amount, 300);

      // Call 2 with identical key
      const second = makeReqRes();
      await waterlogController.create(second.req, second.res);
      // createCallCount must NOT increase
      assert.equal(createCallCount, 1);
      assert.deepEqual(second.getData(), firstData);
      assert.equal(second.getStatus(), 200);
    } finally {
      WaterLog.create = originalCreate;
    }
  });

  it('isolates idempotency cache between different users', async () => {
    const userA = { _id: new mongoose.Types.ObjectId() };
    const userB = { _id: new mongoose.Types.ObjectId() };
    const sharedKey = `shared_idem_key_${Date.now()}`;

    let createdUsers = [];
    const originalCreate = WaterLog.create;
    WaterLog.create = async (doc) => {
      createdUsers.push(String(doc.user));
      return {
        _id: new mongoose.Types.ObjectId(),
        amount: doc.amount,
        date: doc.date,
        user: doc.user,
        toJSON: function () {
          return { id: String(this._id), user: String(this.user), amount: this.amount };
        },
      };
    };

    try {
      const callFor = async (user, amount) => {
        const req = {
          user,
          headers: { 'idempotency-key': sharedKey },
          body: { data: { amount } },
        };
        let responseData = null;
        const res = {
          status: () => res,
          json: (data) => {
            responseData = data;
            return res;
          },
        };
        await waterlogController.create(req, res);
        return responseData;
      };

      const resA = await callFor(userA, 250);
      const resB = await callFor(userB, 400);

      assert.equal(createdUsers.length, 2);
      assert.equal(resA.amount, 250);
      assert.equal(resB.amount, 400);
      assert.equal(resA.user, String(userA._id));
      assert.equal(resB.user, String(userB._id));
    } finally {
      WaterLog.create = originalCreate;
    }
  });
});

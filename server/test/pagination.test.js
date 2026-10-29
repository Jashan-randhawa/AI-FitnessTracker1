const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  MAX_PAGE_SIZE,
  parsePageParams,
  findPage,
  encodeCursor,
  decodeCursor,
} = require('../src/utils/pagination');

// Minimal stand-in for a Mongoose model: records the query chain and resolves
// to the provided rows, honouring the requested limit.
const fakeModel = (rows) => {
  const calls = {};
  const Model = {
    calls,
    find(filter) {
      calls.filter = filter;
      const chain = {
        sort(s) {
          calls.sort = s;
          return chain;
        },
        limit(n) {
          calls.limit = n;
          return chain;
        },
        then(resolve, reject) {
          return Promise.resolve(rows.slice(0, calls.limit ?? rows.length)).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return Model;
};

const ids = [
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
];

describe('parsePageParams', () => {
  it('returns no limit and no cursor when neither is supplied (legacy full list)', () => {
    assert.deepEqual(parsePageParams({}), { limit: null, cursor: null });
  });

  it('clamps an oversized limit to MAX_PAGE_SIZE', () => {
    assert.equal(parsePageParams({ limit: '100000' }).limit, MAX_PAGE_SIZE);
  });

  it('rejects a non-positive or non-numeric limit', () => {
    assert.ok(parsePageParams({ limit: '0' }).error);
    assert.ok(parsePageParams({ limit: '-5' }).error);
    assert.ok(parsePageParams({ limit: 'abc' }).error);
  });

  it('rejects a malformed cursor', () => {
    assert.ok(parsePageParams({ cursor: 'not-a-cursor' }).error);
  });
});

describe('cursor encoding', () => {
  it('round-trips a timestamp and id', () => {
    const date = new Date('2026-10-29T10:00:00.000Z');
    const decoded = decodeCursor(encodeCursor(date, ids[0]));
    assert.equal(decoded.date.getTime(), date.getTime());
    assert.equal(decoded.id, String(ids[0]));
  });
});

describe('findPage', () => {
  const rows = [
    { _id: ids[0], createdAt: new Date('2026-10-29T10:00:00Z') },
    { _id: ids[1], createdAt: new Date('2026-10-28T10:00:00Z') },
    { _id: ids[2], createdAt: new Date('2026-10-27T10:00:00Z') },
  ];

  it('returns everything with no cursor when limit is null', async () => {
    const Model = fakeModel(rows);
    const { docs, nextCursor } = await findPage(Model, { user: 'u1' }, { field: 'createdAt', limit: null, cursor: null });
    assert.equal(docs.length, 3);
    assert.equal(nextCursor, null);
    assert.equal(Model.calls.limit, undefined);
    assert.deepEqual(Model.calls.sort, { createdAt: -1, _id: -1 });
  });

  it('caps the page and emits a cursor when more rows exist', async () => {
    const Model = fakeModel(rows);
    const { docs, nextCursor } = await findPage(Model, { user: 'u1' }, { field: 'createdAt', limit: 2, cursor: null });
    assert.equal(docs.length, 2);
    assert.equal(Model.calls.limit, 3); // limit + 1 to detect the next page
    assert.ok(nextCursor);
    assert.deepEqual(decodeCursor(nextCursor).id, String(ids[1]));
  });

  it('emits no cursor on the final page', async () => {
    const Model = fakeModel(rows.slice(0, 2));
    const { docs, nextCursor } = await findPage(Model, { user: 'u1' }, { field: 'createdAt', limit: 2, cursor: null });
    assert.equal(docs.length, 2);
    assert.equal(nextCursor, null);
  });

  it('applies the cursor as a keyset filter that tie-breaks on _id', async () => {
    const Model = fakeModel([]);
    const cursor = decodeCursor(encodeCursor(rows[0].createdAt, ids[0]));
    await findPage(Model, { user: 'u1' }, { field: 'createdAt', limit: 10, cursor });
    assert.equal(Model.calls.filter.user, 'u1');
    assert.equal(Model.calls.filter.$or.length, 2);
    assert.equal(Model.calls.filter.$or[0].createdAt.$lt.getTime(), rows[0].createdAt.getTime());
  });
});

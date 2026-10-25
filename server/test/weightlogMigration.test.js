const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const WeightLog = require('../src/models/WeightLog');
const { backfillWeightLogs, deriveLocalDay } = require('../scripts/backfill-weightlog-localday');

describe('WeightLog Migration & Backfill (Existing Data Safeguards)', () => {
  it('deriveLocalDay formats Date objects and ISO strings to YYYY-MM-DD', () => {
    const d1 = new Date('2026-05-15T08:30:00.000Z');
    assert.equal(deriveLocalDay(d1), '2026-05-15');

    const d2 = '2026-10-25T13:00:00.000Z';
    assert.equal(deriveLocalDay(d2), '2026-10-25');

    const invalid = 'not-a-date';
    assert.match(deriveLocalDay(invalid), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('schema index definition contains partialFilterExpression for string localDay', () => {
    const indexes = WeightLog.schema.indexes();
    const compoundIndex = indexes.find(([fields]) => fields.user === 1 && fields.localDay === 1);

    assert.ok(compoundIndex, 'Compound index on { user: 1, localDay: 1 } must exist');
    const options = compoundIndex[1];
    assert.equal(options.unique, true, 'Compound index must be unique');
    assert.deepEqual(
      options.partialFilterExpression,
      { localDay: { $type: 'string' } },
      'Index must define partialFilterExpression to avoid collision on legacy null documents'
    );
  });

  it('backfill simulation correctly groups and de-duplicates same-day entries', async () => {
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();

    // Legacy documents with no localDay
    const mockDocs = [
      {
        _id: new mongoose.Types.ObjectId(),
        user: userA,
        weightKg: 75.0,
        date: new Date('2026-04-10T09:00:00Z'),
        createdAt: new Date('2026-04-10T09:00:00Z'),
        notes: 'morning entry',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        user: userA,
        weightKg: 74.8,
        date: new Date('2026-04-10T18:00:00Z'),
        createdAt: new Date('2026-04-10T18:00:00Z'),
        notes: 'evening weigh in',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        user: userA,
        weightKg: 74.5,
        date: new Date('2026-04-11T08:00:00Z'),
        createdAt: new Date('2026-04-11T08:00:00Z'),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        user: userB,
        weightKg: 82.0,
        date: new Date('2026-04-10T09:00:00Z'),
        createdAt: new Date('2026-04-10T09:00:00Z'),
      },
    ];

    // Stub WeightLog.find
    const origFind = WeightLog.find;
    const deletedIds = [];
    const updatedDocs = [];

    WeightLog.find = () => ({
      sort: () => Promise.resolve(mockDocs),
    });
    WeightLog.deleteMany = ({ _id: { $in: ids } }) => {
      deletedIds.push(...ids.map(String));
      return Promise.resolve({ deletedCount: ids.length });
    };
    WeightLog.updateOne = ({ _id }, { $set }) => {
      updatedDocs.push({ id: String(_id), ...$set });
      return Promise.resolve({ modifiedCount: 1 });
    };

    try {
      const result = await backfillWeightLogs({ dryRun: false });

      assert.equal(result.scanned, 4);
      assert.equal(result.duplicatesRemoved, 1, 'One duplicate for userA on 2026-04-10 should be removed');
      assert.equal(deletedIds.length, 1);
      assert.ok(updatedDocs.length >= 3, 'Canonical documents must receive their localDay');
    } finally {
      WeightLog.find = origFind;
      delete WeightLog.deleteMany;
      delete WeightLog.updateOne;
    }
  });

  it('dryRun does not execute writes or deletes', async () => {
    const userA = new mongoose.Types.ObjectId();
    const mockDocs = [
      {
        _id: new mongoose.Types.ObjectId(),
        user: userA,
        weightKg: 70.0,
        date: new Date('2026-01-01T10:00:00Z'),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        user: userA,
        weightKg: 70.2,
        date: new Date('2026-01-01T12:00:00Z'),
      },
    ];

    const origFind = WeightLog.find;
    let writeCalled = false;
    WeightLog.find = () => ({
      sort: () => Promise.resolve(mockDocs),
    });
    WeightLog.deleteMany = () => {
      writeCalled = true;
      return Promise.resolve();
    };
    WeightLog.updateOne = () => {
      writeCalled = true;
      return Promise.resolve();
    };

    try {
      const result = await backfillWeightLogs({ dryRun: true });
      assert.equal(result.dryRun, true);
      assert.equal(result.duplicatesRemoved, 1);
      assert.equal(writeCalled, false, 'No DB mutations should happen during dry-run');
    } finally {
      WeightLog.find = origFind;
      delete WeightLog.deleteMany;
      delete WeightLog.updateOne;
    }
  });
});

#!/usr/bin/env node
/**
 * FitTrack AI — WeightLog Migration & Backfill Script
 *
 * Safely prepares existing WeightLog documents for the unique compound index { user: 1, localDay: 1 }:
 *  1. Scans existing WeightLog documents for missing or null localDay fields.
 *  2. Computes the calendar day (YYYY-MM-DD) from doc.date or doc.createdAt.
 *  3. Identifies and de-duplicates any historical same-day duplicate entries per user
 *     (preserving the most recent entry and merging notes).
 *  4. Updates the documents with their calculated localDay.
 *  5. Builds the unique compound index { user: 1, localDay: 1 }.
 *
 * Can be run from CLI (`node scripts/backfill-weightlog-localday.js`) or imported as a function.
 */

const mongoose = require('mongoose');
const WeightLog = require('../src/models/WeightLog');

/**
 * Derives a YYYY-MM-DD day key from a Date object or timestamp.
 * Defaults to UTC ISO string representation.
 */
function deriveLocalDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Executes the backfill and migration on the WeightLog collection.
 *
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false] If true, reports planned changes without writing.
 * @returns {Promise<{ scanned: number, updated: number, duplicatesRemoved: number, indexCreated: boolean }>}
 */
async function backfillWeightLogs(options = {}) {
  const { dryRun = false } = options;

  const allLogs = await WeightLog.find({}).sort({ date: -1, createdAt: -1 });
  const scanned = allLogs.length;

  // Group by user string and computed localDay
  const groups = new Map();
  for (const doc of allLogs) {
    const userId = String(doc.user);
    const day = doc.localDay || deriveLocalDay(doc.date || doc.createdAt);
    const groupKey = `${userId}:${day}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push({ doc, calculatedDay: day });
  }

  let duplicatesRemoved = 0;
  let updated = 0;

  for (const [groupKey, entries] of groups.entries()) {
    // If multiple entries exist for the same user on the same day, resolve duplicates
    if (entries.length > 1) {
      // entries are sorted descending by date/createdAt; the first is the canonical latest
      const [canonical, ...dupes] = entries;
      const dupeIds = dupes.map((e) => e.doc._id);

      // Merge notes if canonical has none
      if (!canonical.doc.notes) {
        const mergedNotes = dupes
          .map((d) => d.doc.notes)
          .filter(Boolean)
          .join('; ');
        if (mergedNotes && !dryRun) {
          await WeightLog.updateOne({ _id: canonical.doc._id }, { $set: { notes: mergedNotes.slice(0, 100) } });
        }
      }

      if (!dryRun) {
        await WeightLog.deleteMany({ _id: { $in: dupeIds } });
      }
      duplicatesRemoved += dupes.length;

      // Update canonical if localDay was missing or different
      if (canonical.doc.localDay !== canonical.calculatedDay) {
        if (!dryRun) {
          await WeightLog.updateOne(
            { _id: canonical.doc._id },
            { $set: { localDay: canonical.calculatedDay } }
          );
        }
        updated++;
      }
    } else {
      const entry = entries[0];
      if (entry.doc.localDay !== entry.calculatedDay) {
        if (!dryRun) {
          await WeightLog.updateOne(
            { _id: entry.doc._id },
            { $set: { localDay: entry.calculatedDay } }
          );
        }
        updated++;
      }
    }
  }

  let indexCreated = false;
  if (!dryRun && mongoose.connection.readyState === 1) {
    try {
      await WeightLog.collection.createIndex(
        { user: 1, localDay: 1 },
        { unique: true, partialFilterExpression: { localDay: { $type: 'string' } } }
      );
      indexCreated = true;
    } catch (err) {
      // Re-throw if index build fails after migration
      throw new Error(`Failed to create unique index on WeightLog: ${err.message}`);
    }
  }

  return {
    scanned,
    updated,
    duplicatesRemoved,
    indexCreated,
    dryRun,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fittrack';
  console.log(`[WeightLog Migration] Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);

  try {
    console.log('[WeightLog Migration] Running backfill...');
    const result = await backfillWeightLogs();
    console.log('[WeightLog Migration] Result:', JSON.stringify(result, null, 2));
    console.log('✅ WeightLog backfill and unique index build completed successfully.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

module.exports = {
  backfillWeightLogs,
  deriveLocalDay,
};

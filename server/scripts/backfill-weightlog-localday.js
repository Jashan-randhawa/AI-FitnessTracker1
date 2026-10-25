#!/usr/bin/env node
/**
 * FitTrack AI — WeightLog Migration & Backfill Script
 *
 * Safely prepares existing WeightLog documents for the unique compound index { user: 1, localDay: 1 }:
 *  1. Scans existing WeightLog documents for missing or null localDay fields.
 *  2. Computes the calendar day (YYYY-MM-DD) from doc.date or doc.createdAt using timezone-aware day keys.
 *  3. Creates a safety backup of all records before performing any deletions or mutations.
 *  4. Identifies and de-duplicates any historical same-day duplicate entries per user
 *     (preserving the most recent entry and merging notes into the canonical record).
 *  5. Updates the documents with their calculated localDay.
 *  6. Builds the unique compound index { user: 1, localDay: 1 }.
 *
 * CLI Usage:
 *   node scripts/backfill-weightlog-localday.js --dry-run
 *   node scripts/backfill-weightlog-localday.js --timezone=America/New_York
 *   node scripts/backfill-weightlog-localday.js --backup-file=./my-backup.json
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const WeightLog = require('../src/models/WeightLog');
const { dayKey, isValidTimeZone } = require('../src/utils/localDay');

/**
 * Derives a YYYY-MM-DD day key from a Date object or timestamp using a given timezone.
 * Defaults to 'UTC' if not specified or invalid.
 */
function deriveLocalDay(date, tz = 'UTC') {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const effectiveTz = isValidTimeZone(tz) ? tz : 'UTC';
  try {
    return dayKey(d, effectiveTz);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Executes the backfill and migration on the WeightLog collection.
 *
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false] If true, reports planned changes without writing.
 * @param {string} [options.timezone='UTC'] Timezone used to derive day keys.
 * @param {string|boolean} [options.backupFile=true] Path to backup file, or boolean to auto-generate.
 * @returns {Promise<{ scanned: number, updated: number, duplicatesRemoved: number, indexCreated: boolean, backupPath?: string }>}
 */
async function backfillWeightLogs(options = {}) {
  const { dryRun = false, timezone = 'UTC', backupFile = true } = options;

  const allLogs = await WeightLog.find({}).sort({ date: -1, createdAt: -1 });
  const scanned = allLogs.length;

  let backupPath = null;
  if (!dryRun && backupFile && scanned > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath =
      typeof backupFile === 'string'
        ? path.resolve(backupFile)
        : path.resolve(os.tmpdir(), `weightlogs-backup-${timestamp}.json`);
    try {
      fs.writeFileSync(backupPath, JSON.stringify(allLogs, null, 2), 'utf8');
    } catch (err) {
      throw new Error(`Failed to create safety backup file at ${backupPath}: ${err.message}`);
    }
  }

  // Group by user string and computed localDay
  const groups = new Map();
  for (const doc of allLogs) {
    const userId = String(doc.user);
    const day = doc.localDay || deriveLocalDay(doc.date || doc.createdAt, timezone);
    const groupKey = `${userId}:${day}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push({ doc, calculatedDay: day });
  }

  let duplicatesRemoved = 0;
  let updated = 0;

  for (const [, entries] of groups.entries()) {
    if (entries.length > 1) {
      // canonical is the newest entry by date/createdAt
      const [canonical, ...dupes] = entries;
      const dupeIds = dupes.map((e) => e.doc._id);

      // Merge notes if canonical has none
      if (!canonical.doc.notes) {
        const mergedNotes = dupes
          .map((d) => d.doc.notes)
          .filter(Boolean)
          .join('; ');
        if (mergedNotes && !dryRun) {
          await WeightLog.updateOne(
            { _id: canonical.doc._id },
            { $set: { notes: mergedNotes.slice(0, 100) } }
          );
        }
      }

      if (!dryRun) {
        await WeightLog.deleteMany({ _id: { $in: dupeIds } });
      }
      duplicatesRemoved += dupes.length;

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
      throw new Error(`Failed to create unique index on WeightLog: ${err.message}`);
    }
  }

  return {
    scanned,
    updated,
    duplicatesRemoved,
    indexCreated,
    dryRun,
    timezone,
    backupPath,
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    timezone: 'UTC',
    backupFile: true,
  };

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg.startsWith('--timezone=')) {
      options.timezone = arg.split('=')[1];
    } else if (arg === '-t' && args[args.indexOf(arg) + 1]) {
      options.timezone = args[args.indexOf(arg) + 1];
    } else if (arg.startsWith('--backup-file=')) {
      options.backupFile = arg.split('=')[1];
    } else if (arg === '--no-backup') {
      options.backupFile = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
FitTrack AI — WeightLog Migration & Backfill Tool

Options:
  --dry-run, -n              Simulate migration without modifying or deleting data
  --timezone=<tz>, -t <tz>   Set timezone for localDay calculation (default: UTC)
  --backup-file=<path>       Custom path to store JSON backup snapshot before mutations
  --no-backup                Skip creating a JSON backup file
  --help, -h                 Display this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Returns a log-safe description of a MongoDB connection string: host(s) and
 * database name only. Credentials and query options are never included.
 */
function describeMongoTarget(uri) {
  try {
    const rest = String(uri).replace(/^mongodb(\+srv)?:\/\//i, '');
    const afterAuth = rest.includes('@') ? rest.slice(rest.lastIndexOf('@') + 1) : rest;
    const [hostPart, dbPart = ''] = afterAuth.split('?')[0].split(/\/(.*)/s);
    return `${hostPart || 'unknown-host'}/${dbPart || '(default db)'}`;
  } catch {
    return '(unparseable connection string)';
  }
}

async function main() {
  const options = parseCliArgs();
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fittrack';

  console.log('====================================================');
  console.log('FitTrack AI — WeightLog Migration & Backfill Tool');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (Read-Only Simulation)' : 'LIVE EXECUTION'}`);
  console.log(`Timezone: ${options.timezone}`);
  console.log(`Target Database: ${describeMongoTarget(uri)}`);
  console.log('====================================================\n');

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);

  try {
    const result = await backfillWeightLogs(options);
    console.log('\nMigration Summary:');
    console.log(`• Scanned documents: ${result.scanned}`);
    console.log(`• Documents to update (localDay): ${result.updated}`);
    console.log(`• Same-day duplicate records resolved: ${result.duplicatesRemoved}`);
    if (result.backupPath) {
      console.log(`• Pre-migration safety backup saved to: ${result.backupPath}`);
    }
    console.log(`• Unique index created: ${result.indexCreated}`);

    if (result.dryRun) {
      console.log('\n[DRY RUN COMPLETE] No data was modified or deleted.');
    } else {
      console.log('\n✅ [MIGRATION COMPLETE] Database successfully backfilled.');
    }
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
  describeMongoTarget,
  backfillWeightLogs,
  deriveLocalDay,
};

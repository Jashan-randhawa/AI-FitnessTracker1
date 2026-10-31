#!/usr/bin/env node
/**
 * FitTrack AI — Idempotency Index Migration Tool
 *
 * Drops legacy 5-minute TTL index on `createdAt` from the `idempotencykeys` collection
 * if present, then synchronizes schema indexes (building the unique compound index
 * { user: 1, key: 1 } and the new { expiresAt: 1 } TTL index with expireAfterSeconds: 0).
 *
 * Safe and idempotent: can be run repeatedly without error.
 *
 * CLI Usage:
 *   node scripts/migrate-idempotency-index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const IdempotencyKey = require('../src/models/IdempotencyKey');

/**
 * Strips credentials from a MongoDB connection string for safe log output.
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

/**
 * Migrates idempotency collection indexes by dropping obsolete createdAt TTL indexes
 * and syncing current model indexes.
 *
 * @param {Object} [options]
 * @param {string} [options.uri] Custom MongoDB URI
 * @returns {Promise<{ droppedIndexes: string[], synced: boolean }>}
 */
async function migrateIdempotencyIndex(options = {}) {
  const shouldConnect = !options.skipConnect && (!mongoose.connection || mongoose.connection.readyState !== 1);
  const uri = options.uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fittrack';

  if (shouldConnect) {
    await mongoose.connect(uri);
  }

  const droppedIndexes = [];

  try {
    const collection = mongoose.connection.db.collection('idempotencykeys');
    const existingCollections = await mongoose.connection.db.listCollections({ name: 'idempotencykeys' }).toArray();

    if (existingCollections.length > 0) {
      const indexes = await collection.indexes();
      for (const idx of indexes) {
        // Drop any legacy TTL index on createdAt
        if (idx.key && idx.key.createdAt !== undefined) {
          await collection.dropIndex(idx.name);
          droppedIndexes.push(idx.name);
        }
      }
    }

    await IdempotencyKey.syncIndexes();

    return {
      droppedIndexes,
      synced: true,
    };
  } finally {
    if (shouldConnect) {
      await mongoose.disconnect();
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fittrack';
  console.log('====================================================');
  console.log('FitTrack AI — Idempotency Index Migration Tool');
  console.log(`Target Database: ${describeMongoTarget(uri)}`);
  console.log('====================================================\n');

  console.log('Running migration...');
  const result = await migrateIdempotencyIndex({ uri });
  console.log('\nMigration Complete:');
  console.log(`• Dropped legacy indexes: ${result.droppedIndexes.length > 0 ? result.droppedIndexes.join(', ') : 'None (already clean)'}`);
  console.log(`• Schema indexes synced: ${result.synced}`);
  console.log('\n✅ Database indexes are up to date.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  migrateIdempotencyIndex,
  describeMongoTarget,
};

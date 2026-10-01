/**
 * Backfill script: Dual-Auth Methods
 *
 * Updates existing User records:
 * 1. Sets `hasPassword` based on the existence of a password hash.
 * 2. Grandfathers existing accounts as `emailVerified: true` (Decision D2).
 * 3. Leaves `provider` untouched and `googleId` empty until first use.
 *
 * Usage:
 *   node scripts/backfill-auth-methods.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const isDryRun = process.argv.includes('--dry-run');

async function runBackfill() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB... (${isDryRun ? 'DRY-RUN MODE' : 'LIVE UPDATE MODE'})`);
  await mongoose.connect(uri);

  try {
    const users = await User.find({}).select('+password +googleId');
    console.log(`Found ${users.length} total users in database.\n`);

    let updatedCount = 0;
    let passwordCount = 0;
    let googleOnlyCount = 0;

    for (const user of users) {
      const hasPw = Boolean(user.password);
      const isVerified = true; // Grandfather existing accounts (D2)

      if (hasPw) {
        passwordCount++;
      } else {
        googleOnlyCount++;
      }

      const needsUpdate =
        user.hasPassword !== hasPw ||
        user.emailVerified !== isVerified;

      if (needsUpdate) {
        updatedCount++;
        console.log(
          `• [${user._id}] ${user.email} | Provider: ${user.provider} | hasPassword: ${hasPw} | emailVerified: ${isVerified}`
        );

        if (!isDryRun) {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                hasPassword: hasPw,
                emailVerified: isVerified,
              },
            }
          );
        }
      }
    }

    console.log('\n=============================================');
    console.log(`Summary:`);
    console.log(`• Total users inspected:  ${users.length}`);
    console.log(`• With password:          ${passwordCount}`);
    console.log(`• Without password:       ${googleOnlyCount}`);
    console.log(`• Records to update:      ${updatedCount}`);
    console.log(`• Mode:                   ${isDryRun ? 'DRY RUN (no changes written)' : 'APPLIED SUCCESSFULLY'}`);
    console.log('=============================================\n');
  } catch (err) {
    console.error('Backfill error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runBackfill();
}

module.exports = { runBackfill };

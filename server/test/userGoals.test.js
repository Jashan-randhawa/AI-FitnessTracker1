const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/models/User');

describe('User Macro & Water Goals Model Validation Tests', () => {
  it('accepts valid numeric values for dailyproteingoal, dailycarbsgoal, dailyfatgoal, and dailywatergoal', async () => {
    const user = new User({
      username: 'goalstestuser',
      email: 'goals@example.com',
      password: 'StrongPassword123!',
      dailycaloriesintake: 2200,
      dailycaloriesburned: 500,
      dailyproteingoal: 165,
      dailycarbsgoal: 220,
      dailyfatgoal: 73,
      dailywatergoal: 3000,
    });

    await user.validate();
    assert.equal(user.dailyproteingoal, 165);
    assert.equal(user.dailycarbsgoal, 220);
    assert.equal(user.dailyfatgoal, 73);
    assert.equal(user.dailywatergoal, 3000);
  });

  it('rejects negative values for dailyproteingoal', async () => {
    const user = new User({
      username: 'negprotein',
      email: 'negprotein@example.com',
      dailyproteingoal: -10,
    });

    await assert.rejects(
      async () => {
        await user.validate();
      },
      (err) => {
        assert.ok(err.errors?.dailyproteingoal);
        assert.match(err.errors.dailyproteingoal.message, /cannot be negative/i);
        return true;
      }
    );
  });

  it('rejects negative values for dailycarbsgoal', async () => {
    const user = new User({
      username: 'negcarbs',
      email: 'negcarbs@example.com',
      dailycarbsgoal: -5,
    });

    await assert.rejects(
      async () => {
        await user.validate();
      },
      (err) => {
        assert.ok(err.errors?.dailycarbsgoal);
        assert.match(err.errors.dailycarbsgoal.message, /cannot be negative/i);
        return true;
      }
    );
  });

  it('rejects negative values for dailyfatgoal', async () => {
    const user = new User({
      username: 'negfat',
      email: 'negfat@example.com',
      dailyfatgoal: -1,
    });

    await assert.rejects(
      async () => {
        await user.validate();
      },
      (err) => {
        assert.ok(err.errors?.dailyfatgoal);
        assert.match(err.errors.dailyfatgoal.message, /cannot be negative/i);
        return true;
      }
    );
  });

  it('rejects negative values for dailywatergoal', async () => {
    const user = new User({
      username: 'negwater',
      email: 'negwater@example.com',
      dailywatergoal: -100,
    });

    await assert.rejects(
      async () => {
        await user.validate();
      },
      (err) => {
        assert.ok(err.errors?.dailywatergoal);
        assert.match(err.errors.dailywatergoal.message, /cannot be negative/i);
        return true;
      }
    );
  });

  it('rejects non-numeric string values that cannot cast to Number', async () => {
    const user = new User({
      username: 'badnumuser',
      email: 'badnum@example.com',
      dailyproteingoal: 'not-a-number',
    });

    await assert.rejects(
      async () => {
        await user.validate();
      },
      (err) => {
        assert.ok(err.errors?.dailyproteingoal);
        assert.match(err.errors.dailyproteingoal.name, /CastError/i);
        return true;
      }
    );
  });
});

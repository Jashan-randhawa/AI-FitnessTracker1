const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const WorkoutPlan = require('../src/models/WorkoutPlan');
const ActivityLog = require('../src/models/ActivityLog');
const workoutPlanController = require('../src/controllers/workoutPlan.controller');

describe('WorkoutPlan & ActivityLog Schema Extensions Tests', () => {
  it('WorkoutPlan model initializes correctly with defaults', () => {
    const plan = new WorkoutPlan({
      user: '507f1f77bcf86cd799439011',
      title: 'Strength 4-Day Split',
      daysPerWeek: 4,
      days: [
        {
          day: 'Day 1',
          focus: 'Upper Body Power',
          duration: '45 min',
          exercises: [{ name: 'Bench Press', sets: 4 }],
        },
      ],
    });

    assert.equal(plan.title, 'Strength 4-Day Split');
    assert.equal(plan.daysPerWeek, 4);
    assert.equal(plan.isActive, true);
    assert.equal(plan.days.length, 1);
    assert.equal(plan.days[0].day, 'Day 1');
  });

  it('ActivityLog schema supports additive fields: type, intensity, source, exercises', () => {
    const log = new ActivityLog({
      user: '507f1f77bcf86cd799439011',
      name: 'Chest & Triceps',
      duration: 50,
      calories: 320,
      type: 'strength',
      intensity: 'high',
      source: 'live-session',
      exercises: [
        {
          name: 'Incline Dumbbell Press',
          sets: [
            { setNumber: 1, weight: 30, reps: 10, completed: true },
            { setNumber: 2, weight: 32, reps: 8, completed: true },
          ],
        },
      ],
    });

    assert.equal(log.type, 'strength');
    assert.equal(log.intensity, 'high');
    assert.equal(log.source, 'live-session');
    assert.equal(log.exercises.length, 1);
    assert.equal(log.exercises[0].sets.length, 2);
    assert.equal(log.exercises[0].sets[0].weight, 30);
    assert.equal(log.exercises[0].sets[0].completed, true);
  });

  it('savePlan validates that days array is provided', async () => {
    const req = {
      user: { _id: '507f1f77bcf86cd799439011' },
      body: { plan: { title: 'No Days Plan' } },
    };

    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await workoutPlanController.savePlan(req, res);
    assert.equal(statusCode, 400);
    const msg = responseBody?.error?.message || responseBody?.error || responseBody?.message || '';
    assert.match(String(msg), /days/i);
  });
});

const asyncHandler = require('express-async-handler');
const WorkoutPlan = require('../models/WorkoutPlan');
const sendError = require('../utils/sendError');

// GET /api/workout-plans/active
const getActivePlan = asyncHandler(async (req, res) => {
  const plan = await WorkoutPlan.findOne({
    user: req.user._id,
    isActive: true,
  }).sort({ updatedAt: -1 });

  res.json({ plan: plan ? plan.toJSON() : null });
});

// GET /api/workout-plans
const getPlans = asyncHandler(async (req, res) => {
  const plans = await WorkoutPlan.find({
    user: req.user._id,
  }).sort({ createdAt: -1 });

  res.json({ plans: plans.map((p) => p.toJSON()) });
});

// POST /api/workout-plans
const savePlan = asyncHandler(async (req, res) => {
  const data = req.body.plan || req.body.data || req.body || {};
  const { title, goal, level, daysPerWeek, split, days, isActive = true } = data;

  if (!days || !Array.isArray(days)) {
    return sendError(res, 400, 'Workout plan must include days array');
  }

  // If new plan is active, mark any existing active plans as inactive
  if (isActive) {
    await WorkoutPlan.updateMany(
      { user: req.user._id, isActive: true },
      { $set: { isActive: false } }
    );
  }

  const newPlan = await WorkoutPlan.create({
    user: req.user._id,
    title: title || 'My Workout Plan',
    goal: goal || '',
    level: level || 'all levels',
    daysPerWeek: daysPerWeek || days.length,
    split: split || '',
    days,
    isActive,
  });

  res.status(201).json({ plan: newPlan.toJSON() });
});

// PUT /api/workout-plans/:id/active
const setActivePlan = asyncHandler(async (req, res) => {
  const plan = await WorkoutPlan.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!plan) {
    return sendError(res, 404, 'Workout plan not found');
  }

  await WorkoutPlan.updateMany(
    { user: req.user._id, isActive: true },
    { $set: { isActive: false } }
  );

  plan.isActive = true;
  await plan.save();

  res.json({ plan: plan.toJSON() });
});

// DELETE /api/workout-plans/:id
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await WorkoutPlan.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!plan) {
    return sendError(res, 404, 'Workout plan not found');
  }

  res.json({ success: true, message: 'Plan deleted successfully' });
});

module.exports = {
  getActivePlan,
  getPlans,
  savePlan,
  setActivePlan,
  deletePlan,
};

const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getActivePlan,
  getPlans,
  savePlan,
  setActivePlan,
  deletePlan,
} = require('../controllers/workoutPlan.controller');

const router = express.Router();

router.use(protect);

router.get('/active', getActivePlan);
router.route('/').get(getPlans).post(savePlan);
router.put('/:id/active', setActivePlan);
router.delete('/:id', deletePlan);

module.exports = router;

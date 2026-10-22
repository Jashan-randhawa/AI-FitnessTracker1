const express = require('express');
const { protect } = require('../middleware/auth');
const { chatHistoryLimiter } = require('../middleware/rateLimiter');
const {
  find,
  getSession,
  create,
  upsertSession,
  deleteSession,
  deleteAll,
} = require('../controllers/chathistory.controller');

const router = express.Router();

router.route('/').get(protect, find).post(protect, chatHistoryLimiter, create);
router.delete('/all', protect, deleteAll);

router
  .route('/session/:sessionId')
  .get(protect, getSession)
  .put(protect, chatHistoryLimiter, upsertSession)
  .delete(protect, deleteSession);

router
  .route('/:id')
  .get(protect, getSession)
  .put(protect, chatHistoryLimiter, upsertSession)
  .delete(protect, deleteSession);

module.exports = router;

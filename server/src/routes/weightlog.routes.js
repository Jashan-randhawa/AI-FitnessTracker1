const express = require('express');
const { protect } = require('../middleware/auth');
const { create, find, remove } = require('../controllers/weightlog.controller');

const router = express.Router();

router.route('/').get(protect, find).post(protect, create);
router.delete('/:id', protect, remove);

module.exports = router;

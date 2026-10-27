const express = require('express');
const { protect, requireAdmin } = require('../middleware/auth');
const { find, findOne, create, update, remove } = require('../controllers/blog.controller');

const router = express.Router();

// Mounted under '/blogs' in routes/index.js — paths below are relative to it.
// Public reads
router.get('/', find);
router.get('/:id', findOne);

// Writes are restricted to administrators
router.post('/', protect, requireAdmin, create);
router.put('/:id', protect, requireAdmin, update);
router.delete('/:id', protect, requireAdmin, remove);

module.exports = router;

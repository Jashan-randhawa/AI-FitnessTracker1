const express = require('express');
const { protect } = require('../middleware/auth');
const { find, findOne, create, update, remove } = require('../controllers/blog.controller');

const router = express.Router();

// Mounted under '/blogs' in routes/index.js — paths below are relative to it.
// Public reads (matches the original public role permissions: find + findOne only)
router.get('/', find);
router.get('/:id', findOne);

// Writes require auth — see note in blog.controller.js
router.post('/', protect, create);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;

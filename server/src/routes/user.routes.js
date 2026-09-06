const express = require('express');
const { protect } = require('../middleware/auth');
const { updateUser } = require('../controllers/user.controller');

const router = express.Router();

router.put('/users/:id', protect, updateUser);

module.exports = router;

const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const sendError = require('../utils/sendError');

// Fields the client actually sends via Onboarding/Profile — anything else
// in the body (email, username, password, role, etc.) is ignored.
const ALLOWED_FIELDS = [
  'age',
  'weight',
  'height',
  'goal',
  'dailycaloriesintake',
  'dailycaloriesburned',
  'onboardedAt',
];

// PUT /api/users/:id
// Strapi's default users-permissions `user.update` action does NOT restrict
// this to the caller's own record by default. Scoping it to req.user here
// is a deliberate hardening — the client only ever calls this with its own
// id, so behavior for the app is unchanged.
const updateUser = asyncHandler(async (req, res) => {
  if (req.params.id !== String(req.user._id)) {
    return sendError(res, 403, 'You can only update your own profile');
  }

  const updates = {};
  ALLOWED_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.json(user.toJSON());
});

module.exports = { updateUser };

const express = require('express');

const router = express.Router();

// auth.routes and the AI/utility routers only ever register exact,
// absolute paths (with `protect` applied inline per-route where needed),
// so mounting them at root with no prefix is safe.
router.use(require('./auth.routes'));
router.use(require('./user.routes'));
router.use(require('./aiAssistant.routes'));
router.use(require('./imageAnalysis.routes'));
router.use(require('./calorieEstimate.routes'));
router.use(require('./foodEstimate.routes'));
router.use(require('./news.routes'));
router.use(require('./youtube.routes'));
router.use(require('./passwordReset.routes'));

// These resource routers are mounted under an explicit prefix, and use
// paths relative to it internally. That gives each one a hard boundary —
// a request for /blogs can never be intercepted by /foodlogs' auth
// middleware, regardless of mount order or what any individual router does
// internally.
router.use('/foodlogs', require('./foodlog.routes'));
router.use('/activitylogs', require('./activitylog.routes'));
router.use('/waterlogs', require('./waterlog.routes'));
router.use('/chathistories', require('./chathistory.routes'));
router.use('/blogs', require('./blog.routes'));

module.exports = router;

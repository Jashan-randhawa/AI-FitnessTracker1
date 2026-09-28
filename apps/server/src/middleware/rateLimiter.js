const {
  authLimiter,
  passwordResetLimiter,
  aiLimiters,
  proxyLimiter,
} = require('@jashan-randhawa/express-ai-guard');

const limiters = aiLimiters({
  perIp: 30,
  perUser: 20,
  windowMs: 60 * 1000,
});

module.exports = {
  authLimiter: authLimiter(),
  passwordResetLimiter: passwordResetLimiter(),
  aiLimiter: limiters.ipLimiter,
  aiUserLimiter: limiters.userLimiter,
  youtubeLimiter: proxyLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: { message: 'YouTube search rate limit reached. Please try again shortly.' } },
  }),
};

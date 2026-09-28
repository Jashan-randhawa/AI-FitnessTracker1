const logger = require('../utils/logger');
const { errorHandler: createErrorHandler, notFound } = require('@jashan-randhawa/express-ai-guard');

const handler = createErrorHandler({
  logger,
});

module.exports = {
  notFound,
  errorHandler: handler,
};

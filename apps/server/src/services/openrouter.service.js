const logger = require('../utils/logger');
const {
  createOpenRouterClient,
  isTransient,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
} = require('@jashan-randhawa/openrouter-resilient-client');

const client = createOpenRouterClient({
  logger,
  referer: 'https://fittrack.app',
  appTitle: 'FitBot',
});

const chatCompletionDetailed = async (params) => {
  return client.chatCompletionDetailed(params);
};

const chatCompletion = async (params) => {
  return client.chatCompletionDetailed(params);
};

module.exports = {
  chatCompletion,
  chatCompletionDetailed,
  isTransient,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  client,
};

const { ChatActionSchema } = require('../schemas/chatAction.schema');
const logger = require('./logger');

const PROPOSED_ACTIONS_REGEX = /<proposed_actions>([\s\S]*?)<\/proposed_actions>/gi;
const SINGLE_ACTION_TAG_REGEX = /<action\s+([^>]+?)\s*\/?>/gi;

/**
 * Extracts proposed actions from the model's reply, validates them against
 * the closed schema, and returns the cleaned user-facing reply text along with
 * any valid proposed actions.
 *
 * @param {string} rawReply
 * @returns {{ cleanedReply: string, proposedActions: Array<{ type: string, amountMl: number, label?: string }> }}
 */
const extractProposedActions = (rawReply) => {
  if (typeof rawReply !== 'string' || !rawReply.trim()) {
    return { cleanedReply: '', proposedActions: [] };
  }

  const validActions = [];
  let cleanedReply = rawReply;

  // 1. Check for <proposed_actions>...</proposed_actions> blocks
  cleanedReply = cleanedReply.replace(PROPOSED_ACTIONS_REGEX, (_match, jsonContent) => {
    try {
      let rawJson = jsonContent.trim();
      // Strip markdown code fences if model enclosed in ```json ... ```
      if (rawJson.startsWith('```')) {
        rawJson = rawJson.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(rawJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const validated = ChatActionSchema.safeParse(item);
        if (validated.success) {
          validActions.push(validated.data);
        } else {
          logger.warn('[ChatActions] invalid proposed action dropped', {
            error: validated.error.message,
          });
        }
      }
    } catch (err) {
      logger.warn('[ChatActions] failed to parse proposed_actions JSON', {
        error: err?.message,
      });
    }
    return ''; // strip from user text
  });

  // 2. Check for individual <action ... /> XML tags if any were produced
  cleanedReply = cleanedReply.replace(SINGLE_ACTION_TAG_REGEX, (_match, attrs) => {
    try {
      const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
      const amountMatch = attrs.match(/amountMl=["']?(\d+)["']?/i);
      const labelMatch = attrs.match(/label=["']([^"']+)["']/i);

      if (typeMatch && amountMatch) {
        const candidate = {
          type: typeMatch[1],
          amountMl: parseInt(amountMatch[1], 10),
          label: labelMatch ? labelMatch[1] : undefined,
        };
        const validated = ChatActionSchema.safeParse(candidate);
        if (validated.success) {
          validActions.push(validated.data);
        }
      }
    } catch {
      // ignore
    }
    return ''; // strip tag from user text
  });

  // Clean trailing/double whitespace caused by tag removal
  cleanedReply = cleanedReply
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Bounded list (at most 3 actions)
  const cappedActions = validActions.slice(0, 3);

  return {
    cleanedReply,
    proposedActions: cappedActions,
  };
};

module.exports = {
  extractProposedActions,
};

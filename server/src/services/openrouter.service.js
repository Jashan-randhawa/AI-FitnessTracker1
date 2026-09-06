const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// "openrouter/auto" adds its own model-selection round trip before your request
// even starts, and can land on a slow/overloaded backend. A concrete, fast
// multimodal model (vision + text) skips that overhead. Override per-call
// with `model`, or globally via OPENROUTER_MODEL in .env.
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Low-level call to OpenRouter's chat completions endpoint. Shared by
 * ai-assistant, image-analysis, calorie-estimate, and food-estimate —
 * each of those builds its own `messages` array and system prompt, then
 * calls this to do the actual request.
 *
 * @param {{ messages: any[], title: string, model?: string, maxTokens?: number, timeoutMs?: number }} params
 * @returns {Promise<string>} the assistant's reply text
 */
const chatCompletion = async ({ messages, title, model = DEFAULT_MODEL, maxTokens, timeoutMs = DEFAULT_TIMEOUT_MS }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OpenRouter API key not set.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fittrack.app',
        'X-Title': title,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        // Ask OpenRouter to route to whichever provider currently serves
        // this model with the lowest latency, instead of its default pick.
        provider: { sort: 'latency' },
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
  clearTimeout(timer);

  const responseText = await response.text();
  console.log(`[OpenRouter ${title}] status:`, response.status, 'body:', responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText);
  return data.choices?.[0]?.message?.content ?? '';
};

module.exports = { chatCompletion };

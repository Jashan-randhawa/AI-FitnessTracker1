const chatWithOpenRouter = async (
  messages: ChatMessage[],
  systemInstruction: string
): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key not set.");

  const openRouterMessages = [
    { role: "system", content: systemInstruction },
    ...messages.map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.parts.map((p) => p.text).join(""),
    })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fittrack.app",
      "X-Title": "FitTrack AI Assistant",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: openRouterMessages,
    }),
  });

  const responseText = await response.text();
  console.log("[OpenRouter chat] status:", response.status, "body:", responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`OpenRouter chat failed (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText) as any;
  return data.choices?.[0]?.message?.content ?? "Sorry, I could not generate a response.";
};

const SYSTEM_PROMPT = `You are FitBot, an expert AI fitness and nutrition assistant built into FitTrack, a health tracking app.

Your role:
- Answer questions about fitness, nutrition, exercise, weight management, and general wellness
- Provide personalized advice based on user context when provided (their goals, weight, activity level)
- Suggest meal plans, workout routines, and healthy habits
- Explain concepts in fitness and nutrition in a clear, friendly way
- Motivate and support users in reaching their health goals

When user context is provided, you MUST use it actively:
- Reference what the user has already eaten today when giving nutrition advice
- Factor in calories already consumed and remaining when suggesting meals
- Acknowledge exercises already done when recommending workouts
- If they are over their calorie target, be supportive and constructive — never shame them
- If they haven't logged food or exercise yet, gently encourage them to do so
- Tailor ALL recommendations to their specific goal (lose / maintain / gain weight)
- Use their weight and height for any calculations (BMR, TDEE, macros)

Guidelines:
- Be concise but thorough — use bullet points and structure when helpful
- Always prioritize safety: recommend consulting a doctor for medical concerns
- Be positive and encouraging
- If asked something outside fitness/nutrition/wellness, politely redirect to your area of expertise
- Use metric units by default but adapt to user preference
- When referencing the user's today data, always say "today" to make it feel real-time`;

export type ChatMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export const chatWithGemini = async (
  messages: ChatMessage[],
  userContext?: string
): Promise<string> => {
  const systemInstruction = userContext
    ? `${SYSTEM_PROMPT}\n\nUser context: ${userContext}`
    : SYSTEM_PROMPT;

  console.log("[AI] Using OpenRouter for chat...");
  return await chatWithOpenRouter(messages, systemInstruction);
};

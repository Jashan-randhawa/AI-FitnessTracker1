import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API_Key;
    if (!apiKey) throw new Error("GOOGLE_API_KEY environment variable is not set.");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const SYSTEM_PROMPT = `You are FitBot, an expert AI fitness and nutrition assistant built into FitTrack, a health tracking app.

Your role:
- Answer questions about fitness, nutrition, exercise, weight management, and general wellness
- Provide personalized advice based on user context when provided (their goals, weight, activity level)
- Suggest meal plans, workout routines, and healthy habits
- Explain concepts in fitness and nutrition in a clear, friendly way
- Motivate and support users in reaching their health goals

Guidelines:
- Be concise but thorough — use bullet points and structure when helpful
- Always prioritize safety: recommend consulting a doctor for medical concerns
- Be positive and encouraging
- If asked something outside fitness/nutrition/wellness, politely redirect to your area of expertise
- Use metric units by default but adapt to user preference`;

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

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: messages,
    config: {
      systemInstruction,
    },
  });

  return response.text ?? "Sorry, I could not generate a response. Please try again.";
};

import fs from "fs";
import path from "path";

const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp",
    ".gif": "image/gif", ".heic": "image/heic", ".heif": "image/heif",
  };
  return map[ext] ?? "image/jpeg";
};

const cleanResponse = (raw: string): string =>
  raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/g, "").trim();

const IMAGE_PROMPT = 'Identify the food in this image and return ONLY a valid JSON object with these exact keys: "name" (string, concise food name), "calories" (number, estimated kcal), "protein" (number, grams), "carbs" (number, grams), "fat" (number, grams). Estimates for the visible portion. No explanation, no markdown, no extra text.';

const parseAndValidate = (raw: string) => {
  const cleaned = cleanResponse(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned unreadable output. Please try again with a clearer photo.");
  }
  if (!parsed.name || typeof parsed.calories !== "number" || parsed.calories <= 0) {
    throw new Error("Could not identify food in the image. Please try a clearer photo.");
  }
  return {
    name: String(parsed.name).trim(),
    calories: Math.round(parsed.calories),
    protein: typeof parsed.protein === "number" ? Math.round(parsed.protein * 10) / 10 : 0,
    carbs: typeof parsed.carbs === "number" ? Math.round(parsed.carbs * 10) / 10 : 0,
    fat: typeof parsed.fat === "number" ? Math.round(parsed.fat * 10) / 10 : 0,
  };
};

export const analyzeImage = async (filepath: string) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key not set.");

  const base64 = fs.readFileSync(filepath, { encoding: "base64" });
  const mimeType = getMimeType(filepath);

  console.log("[AI] Using OpenRouter for image analysis...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fittrack.app",
      "X-Title": "FitTrack Image Analysis",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: IMAGE_PROMPT },
          ],
        },
      ],
    }),
  });

  const responseText = await response.text();
  console.log("[OpenRouter image] status:", response.status, "body:", responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`OpenRouter image failed (${response.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText) as any;
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseAndValidate(text);
};

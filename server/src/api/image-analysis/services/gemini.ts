import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API_Key;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Detect mime type from file extension to avoid JPEG-only assumption
const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext] ?? "image/jpeg";
};

// Strip <think>...</think> blocks and markdown fences that thinking models emit
const cleanResponse = (raw: string): string =>
  raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json|```/g, "")
    .trim();

const ANALYZE_TIMEOUT_MS = 15000; // 15 seconds max

export const analyzeImage = async (filepath: string) => {
  try {
    const base64ImageFile = fs.readFileSync(filepath, { encoding: "base64" });
    const mimeType = getMimeType(filepath);

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64ImageFile,
        },
      },
      {
        text: 'Identify the food in this image and return ONLY a valid JSON object with "name" (string, concise food name) and "calories" (number, estimated kcal for the visible portion). No explanation, no markdown, no extra text.',
      },
    ];

    const config: any = {
      // Disable thinking to avoid <think> tags polluting JSON output and adding latency
      thinkingConfig: { thinkingBudget: 0 },
    };

    // Race the Gemini call against a timeout to prevent indefinite hangs
    const analysisPromise = getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Image analysis timed out. Please try again.")),
        ANALYZE_TIMEOUT_MS
      )
    );

    const response = await Promise.race([analysisPromise, timeoutPromise]);

    // Clean response before parsing — thinking models may add <think> tags or markdown fences
    const cleaned = cleanResponse(response.text ?? "");

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "AI returned unreadable output. Please try again with a clearer photo."
      );
    }

    // Sanitize: ensure name is a string and calories is a positive number
    if (!parsed.name || typeof parsed.calories !== "number" || parsed.calories <= 0) {
      throw new Error(
        "Could not identify food in the image. Please try a clearer photo."
      );
    }

    return { name: String(parsed.name).trim(), calories: Math.round(parsed.calories) };
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};

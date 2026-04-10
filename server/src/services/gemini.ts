import fs from "fs/promises";
import path from "path";

const API_URL = process.env.GENERATIVE_API_URL;
const API_KEY = process.env.GOOGLE_API_KEY;

export async function analyzeImage(filepath: string): Promise<any> {
  const filename = path.basename(filepath);
  const stats = await fs.stat(filepath);
  const resultBase = {
    filename,
    size: stats.size,
    analyzedAt: new Date().toISOString(),
  };

  // If environment variables provided, attempt a real AI call.
  // Set `GENERATIVE_API_URL` to your provider endpoint and `GOOGLE_API_KEY` to the API key.
  // Example (Google Generative API / Gemini): set GENERATIVE_API_URL to the appropriate
  // model endpoint that accepts a base64 image payload and returns JSON.
  if (API_URL && API_KEY) {
    try {
      const buffer = await fs.readFile(filepath);
      const b64 = buffer.toString("base64");

      const resp = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ image: b64, filename }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI API error ${resp.status}: ${text}`);
      }

      const data = await resp.json();

      // Normalize and attach AI result. Downstream code can interpret `ai` field.
      return {
        ...resultBase,
        ai: data,
      };
    } catch (err: any) {
      console.error("analyzeImage (AI) error:", err?.message ?? err);
      // fall through to stub response
    }
  }

  // Fallback stub response when AI is not configured or fails.
  return {
    ...resultBase,
    note: "Stub analysis — set GENERATIVE_API_URL and GOOGLE_API_KEY to enable AI analysis.",
  };
}
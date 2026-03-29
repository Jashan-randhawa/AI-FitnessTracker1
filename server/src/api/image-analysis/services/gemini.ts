import { GoogleGenAI } from "@google/genai";
import fs from "fs";

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

export const analyzeImage = async (filepath: string) => {
    try {
const base64ImageFile = fs.readFileSync(filepath, {
  encoding: "base64",
});

const contents = [
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64ImageFile,
    },
  },
  { text: "Extract the food name and estimate its calories from this image in a JSON object." },
];

const config = {
    responseMimeType: "application/json",
    responseJsonSchema: {
        type: "object",
        properties: {
            name :{ type: "string" },
            calories: { type: "number" }
        }
    }
}

const response = await getAI().models.generateContent({
  model: "gemini-2.5-flash",
  contents: contents,
    config
});

return JSON.parse(response.text);
    } catch (error) {
        console.error("Error analyzing image:", error);
        throw error;    
    }
}

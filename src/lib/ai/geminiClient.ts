import { GoogleGenAI } from '@google/genai';
import { createGeminiClient, type JsonClient } from './gemini';

export function createGeminiClientFromKey(apiKey: string, model: string): JsonClient {
  const genAI = new GoogleGenAI({ apiKey });
  return createGeminiClient({
    model,
    generateContent: async (params) => {
      const response = await genAI.models.generateContent({
        model: params.model,
        contents: params.contents as never,
        config: params.config as never,
      });
      return { text: response.text };
    },
  });
}

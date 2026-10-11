export interface JsonRequest {
  system?: string;
  prompt: string;
  images?: { base64: string; mimeType: string }[];
  schema: object;
}

export interface GeminiDeps {
  generateContent: (params: { model: string; contents: unknown[]; config: unknown }) => Promise<{ text?: string }>;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface JsonClient {
  generateJson<T>(request: JsonRequest): Promise<T>;
}

export function createGeminiClient(deps: GeminiDeps): JsonClient {
  return {
    generateJson: async (request) => {
      const retries = deps.maxRetries ?? 4;
      const delay = deps.baseDelayMs ?? 2000;
      const sleep = deps.sleep || ((ms: number) => new Promise(r => setTimeout(r, ms)));

      let lastError: any = null;
      for (let i = 0; i <= retries; i++) {
        try {
          const response = await deps.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: request.schema,
            },
          });
          if (!response.text) throw new Error('Respuesta vacía');
          try {
            return JSON.parse(response.text) as never;
          } catch {
            throw new Error('UNAVAILABLE: la IA devolvió un JSON inválido');
          }
        } catch (e: any) {
          const msg = e?.message || '';
          const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
          lastError = e;
          if (i < retries && isTransient) {
            await sleep(delay * Math.pow(2, i));
            continue;
          }
          throw e;
        }
      }
      throw lastError || new Error('Fallo tras reintentos');
    },
  };
}

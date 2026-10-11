import { describe, it, expect, vi } from 'vitest';

const mockCalls: unknown[] = [];

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async (params: unknown) => {
        mockCalls.push(params);
        return { text: '{"ok":true}' };
      },
    };
    constructor(public opts: unknown) {}
  },
}));

import { createGeminiClientFromKey } from './geminiClient';

describe('createGeminiClientFromKey', () => {
  it('devuelve un JsonClient operativo', () => {
    const client = createGeminiClientFromKey('clave-123', 'mi-modelo');
    expect(typeof client.generateJson).toBe('function');
  });

  it('llama al SDK con el modelo elegido y devuelve el JSON', async () => {
    mockCalls.length = 0;
    const client = createGeminiClientFromKey('clave-123', 'mi-modelo');
    const result = await client.generateJson({ prompt: 'hola', schema: {} });
    expect(result).toEqual({ ok: true });
    expect(mockCalls).toHaveLength(1);
    expect((mockCalls[0] as { model: string }).model).toBe('mi-modelo');
  });
});

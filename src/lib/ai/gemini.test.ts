import { describe, it, expect, vi } from 'vitest';
import { createGeminiClient } from './gemini';

describe('createGeminiClient', () => {
  it('calls generateContent with the correct model and retries on transient errors', async () => {
    const mockGenerateContent = vi.fn()
      .mockRejectedValueOnce(new Error('UNAVAILABLE'))
      .mockResolvedValue({ text: '{"result":"ok"}' });

    const client = createGeminiClient({
      generateContent: mockGenerateContent,
      maxRetries: 1,
      baseDelayMs: 10,
    });

    const result = await client.generateJson({
      prompt: 'Test',
      schema: { type: 'object' },
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ result: 'ok' });
  });

  it('throws after max retries are exhausted', async () => {
    const mockGenerateContent = vi.fn().mockRejectedValue(new Error('503 UNAVAILABLE'));
    const client = createGeminiClient({
      generateContent: mockGenerateContent,
      maxRetries: 2,
      baseDelayMs: 1,
    });

    await expect(
      client.generateJson({ prompt: 'Fail', schema: {} })
    ).rejects.toThrow('503');
  });

  it('retries on invalid JSON once', async () => {
    const mockGenerateContent = vi.fn()
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValue({ text: '{"ok":true}' });

    const client = createGeminiClient({
      generateContent: mockGenerateContent,
      maxRetries: 1,
    });

    const result = await client.generateJson({ prompt: 'X', schema: {} });
    expect(result).toEqual({ ok: true });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('aborta ante una respuesta que nunca llega', async () => {
    const hanging = vi.fn().mockImplementation(() => new Promise(() => {}));
    const client = createGeminiClient({
      generateContent: hanging,
      maxRetries: 0,
      timeoutMs: 50,
    });
    await expect(client.generateJson({ prompt: 'x', schema: {} })).rejects.toThrow(/espera agotado/i);
    expect(hanging).toHaveBeenCalledTimes(1);
  });
});

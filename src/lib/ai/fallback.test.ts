import { describe, it, expect, vi } from 'vitest';
import { createFallbackJsonClient } from './fallback';
import type { JsonClient } from './gemini';

function stubClient(result: unknown, error?: unknown): JsonClient & { calls: () => number } {
  const generateJson = vi.fn(async () => {
    if (error) throw error;
    return result;
  });
  return { generateJson, calls: () => generateJson.mock.calls.length } as unknown as JsonClient & {
    calls: () => number;
  };
}

describe('createFallbackJsonClient', () => {
  it('devuelve el resultado del primer modelo que funciona', async () => {
    const failing = stubClient(null, new Error('503 UNAVAILABLE'));
    const working = stubClient({ ok: true });
    const client = createFallbackJsonClient([failing, working]);
    await expect(client.generateJson({ prompt: 'hola', schema: {} })).resolves.toEqual({ ok: true });
    expect(failing.calls()).toBeGreaterThan(0);
    expect(working.calls()).toBe(1);
  });

  it('se queda con el modelo que funciona y no reintenta el fallido', async () => {
    const failing = stubClient(null, new Error('503 UNAVAILABLE'));
    const working = stubClient({ ok: true });
    const client = createFallbackJsonClient([failing, working]);
    await client.generateJson({ prompt: 'uno', schema: {} });
    const failingCalls = failing.calls();
    await client.generateJson({ prompt: 'dos', schema: {} });
    expect(failing.calls()).toBe(failingCalls);
    expect(working.calls()).toBe(2);
  });

  it('lanza el último error cuando todos los modelos fallan', async () => {
    const first = stubClient(null, new Error('fallo A'));
    const second = stubClient(null, new Error('fallo B'));
    const client = createFallbackJsonClient([first, second]);
    await expect(client.generateJson({ prompt: 'hola', schema: {} })).rejects.toThrow('fallo B');
  });
});

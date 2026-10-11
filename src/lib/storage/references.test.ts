import { describe, it, expect } from 'vitest';
import { createReferenceStore } from './references';
import type { StoredReference } from '../../types/app';

function memoryKeyVal() {
  const data = new Map<string, unknown>();
  return {
    get: async <T,>(key: string): Promise<T | undefined> => data.get(key) as T | undefined,
    set: async (key: string, value: unknown): Promise<void> => {
      data.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      data.delete(key);
    },
    keys: async (): Promise<string[]> => [...data.keys()],
    _data: data,
  };
}

function sampleRef(id: string): StoredReference {
  return {
    id,
    label: { id: `lbl-${id}`, label: `Ref ${id}`, level: 'alto' },
    fileName: `${id}.pdf`,
    savedAt: '2026-10-11T00:00:00.000Z',
    document: {
      fileName: `${id}.pdf`,
      format: 'pdf',
      text: 'texto',
      sections: [],
      figures: [],
      warnings: [],
      stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
    },
  };
}

describe('reference store', () => {
  it('lista vacio al principio', async () => {
    const store = createReferenceStore(memoryKeyVal());
    expect(await store.list()).toEqual([]);
  });

  it('guarda y lista referencias', async () => {
    const store = createReferenceStore(memoryKeyVal());
    await store.put(sampleRef('a'));
    await store.put(sampleRef('b'));
    const list = await store.list();
    expect(list.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('borra una referencia y vacia el resto', async () => {
    const store = createReferenceStore(memoryKeyVal());
    await store.put(sampleRef('a'));
    await store.put(sampleRef('b'));
    await store.remove('a');
    expect((await store.list()).map((r) => r.id)).toEqual(['b']);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it('ignora claves ajenas al prefijo', async () => {
    const kv = memoryKeyVal();
    await kv.set('otra.clave', { id: 'x' });
    const store = createReferenceStore(kv);
    await store.put(sampleRef('a'));
    expect((await store.list()).map((r) => r.id)).toEqual(['a']);
  });
});

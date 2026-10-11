import type { StoredReference } from '../../types/app';

export const REFERENCE_PREFIX = 'proyectjudge.ref.';

export interface KeyValLike {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  keys(): Promise<string[]>;
}

export interface ReferenceStore {
  list(): Promise<StoredReference[]>;
  put(ref: StoredReference): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

function keyFor(id: string): string {
  return `${REFERENCE_PREFIX}${id}`;
}

export function createReferenceStore(store: KeyValLike): ReferenceStore {
  return {
    async list(): Promise<StoredReference[]> {
      const keys = await store.keys();
      const refs: StoredReference[] = [];
      for (const key of keys) {
        if (!key.startsWith(REFERENCE_PREFIX)) continue;
        const value = await store.get<StoredReference>(key);
        if (value && typeof value === 'object' && 'id' in value) {
          refs.push(value);
        }
      }
      return refs;
    },
    async put(ref: StoredReference): Promise<void> {
      await store.set(keyFor(ref.id), ref);
    },
    async remove(id: string): Promise<void> {
      await store.delete(keyFor(id));
    },
    async clear(): Promise<void> {
      const keys = await store.keys();
      for (const key of keys) {
        if (key.startsWith(REFERENCE_PREFIX)) {
          await store.delete(key);
        }
      }
    },
  };
}

import { describe, it, expect } from 'vitest';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    _data: data,
  };
}

describe('settings', () => {
  it('devuelve los valores por defecto con almacenamiento vacio', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('devuelve los ajustes guardados', () => {
    const storage = memoryStorage();
    saveSettings(storage, { ...DEFAULT_SETTINGS, apiKey: 'clave-123', theme: 'dark' });
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'clave-123', theme: 'dark' });
  });

  it('usa la clave proyectjudge.settings', () => {
    const storage = memoryStorage();
    saveSettings(storage, DEFAULT_SETTINGS);
    expect(Object.keys(storage._data)).toEqual(['proyectjudge.settings']);
  });

  it('devuelve los valores por defecto con JSON corrupto sin lanzar', () => {
    const storage = memoryStorage({ 'proyectjudge.settings': '{no-json' });
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });
});

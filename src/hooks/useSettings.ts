import { useCallback, useState } from 'react';
import type { Settings } from '../types/app';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/storage/settings';

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      return loadSettings(window.localStorage);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    try {
      saveSettings(window.localStorage, next);
    } catch {
      // Sin almacenamiento disponible: se mantiene solo en memoria.
    }
  }, []);

  return { settings, setSettings };
}

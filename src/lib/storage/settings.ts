import type { Settings } from '../../types/app';

export const SETTINGS_KEY = 'proyectjudge.settings';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gemini-3.8-flash',
  theme: 'light',
};

type StringStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSettings(storage: StringStorage): Settings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_SETTINGS.apiKey,
      model: typeof parsed.model === 'string' && parsed.model.length > 0 ? parsed.model : DEFAULT_SETTINGS.model,
      theme: parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : DEFAULT_SETTINGS.theme,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: StringStorage, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

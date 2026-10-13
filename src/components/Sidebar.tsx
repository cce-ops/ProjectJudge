import { useRef, useState } from 'react';
import type { Settings } from '../types/app';
import { AVAILABLE_MODELS } from '../lib/ai/models';
import { readRubricFile } from '../lib/rubric/readRubricFile';

interface SidebarProps {
  settings: Settings;
  onSaveKey: (key: string) => void;
  onRemoveKey: () => void;
  onModelChange: (model: string) => void;
  onThemeToggle: () => void;
  rubricName: string | null;
  referenceCount: number;
  onRubricDraft: (text: string) => void;
}

export function Sidebar({
  settings,
  onSaveKey,
  onRemoveKey,
  onModelChange,
  onThemeToggle,
  rubricName,
  referenceCount,
  onRubricDraft,
}: SidebarProps) {
  const [draftKey, setDraftKey] = useState('');
  const [pastedRubric, setPastedRubric] = useState('');
  const [rubricStatus, setRubricStatus] = useState<string | null>(null);
  const rubricFileRef = useRef<HTMLInputElement>(null);

  const dark = settings.theme === 'dark';

  const handleRubricFile = async (file: File) => {
    setRubricStatus(null);
    try {
      const { text, source } = await readRubricFile(file);
      onRubricDraft(text);
      setRubricStatus(`${source} lista (${text.length} caracteres). Revísala en el paso 1.`);
    } catch (e) {
      setRubricStatus(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      if (rubricFileRef.current) rubricFileRef.current.value = '';
    }
  };

  return (
    <aside
      className={`w-full border-r p-4 md:w-80 ${
        dark
          ? 'border-gray-800 bg-gray-900 text-gray-200'
          : 'border-gray-200 bg-gray-50 text-gray-900'
      }`}
    >
      <div className="border-b border-gray-800 p-4">
        <h1 className="text-sm font-bold text-white">ProyectJudge</h1>
        <p className="text-xs text-gray-400">Evaluador de informes con IA</p>
      </div>

      <div className="space-y-4 p-4">
        <section
          className={`space-y-2 rounded-xl border p-3 ${
            dark ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-white'
          }`}
        >
          <span className={`text-xs font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
            Gemini API Key
          </span>
          {settings.apiKey ? (
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-emerald-800/60 bg-emerald-950/80 px-2 py-0.5 text-[10px] text-emerald-400">
                Configurada
              </span>
              <button type="button" onClick={onRemoveKey} className="px-2 py-1 text-xs text-red-400">
                Borrar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                placeholder="AIza..."
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-xs text-white placeholder-gray-500 ${
                  dark ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white text-gray-900'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  onSaveKey(draftKey.trim());
                  setDraftKey('');
                }}
                className="w-full rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white"
              >
                Guardar
              </button>
            </div>
          )}
        </section>

        <section className="space-y-1.5">
          <label
            className={`text-xs font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            htmlFor="model-select"
          >
            Modelo de Gemini
          </label>
          <select
            id="model-select"
            value={settings.model}
            onChange={(e) => onModelChange(e.target.value)}
            className={`w-full rounded-xl border px-3 py-2 text-xs ${
              dark
                ? 'border-gray-800 bg-gray-950 text-gray-200'
                : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </section>

        <section className={`space-y-2 border-t pt-3 ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Rúbrica
          </p>
          <label className={`block text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
            Adjuntar rúbrica
            <input
              ref={rubricFileRef}
              type="file"
              accept=".md,.txt,.docx,.pdf,.xlsx,.xls,.csv"
              aria-label="Adjuntar rúbrica"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleRubricFile(file);
              }}
              className={`mt-1 block w-full text-[11px] ${dark ? 'text-gray-400' : 'text-gray-600'}`}
            />
          </label>
          <label
            className={`block space-y-1 text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            htmlFor="sidebar-rubric-paste"
          >
            Pegar rúbrica
            <textarea
              id="sidebar-rubric-paste"
              rows={3}
              value={pastedRubric}
              onChange={(e) => setPastedRubric(e.target.value)}
              placeholder="Pega los criterios aquí…"
              className={`w-full rounded-lg border px-2 py-1.5 text-xs text-white placeholder-gray-500 ${
                dark ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white text-gray-900'
              }`}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (pastedRubric.trim().length === 0) return;
              onRubricDraft(pastedRubric);
              setRubricStatus(`Texto listo (${pastedRubric.length} caracteres). Revísala en el paso 1.`);
            }}
            className={`w-full rounded-lg py-1.5 text-xs font-medium ${
              dark ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-800'
            }`}
          >
            Usar texto pegado
          </button>
          {rubricStatus && (
            <p role="status" className={`text-[11px] ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
              {rubricStatus}
            </p>
          )}
        </section>

        <section className={`space-y-1 border-t pt-3 text-xs ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
          <p className={`font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Estado
          </p>
          <p className={dark ? 'text-gray-300' : 'text-gray-700'}>
            Rúbrica:{' '}
            {rubricName ? (
              <span className="font-medium text-emerald-400">{rubricName}</span>
            ) : (
              'sin rúbrica'
            )}
          </p>
          <p className={dark ? 'text-gray-300' : 'text-gray-700'}>
            Referencias: {referenceCount} informe{referenceCount === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={onThemeToggle}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              dark ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {dark ? '☀ Tema claro' : '☾ Tema oscuro'}
          </button>
        </section>
      </div>
    </aside>
  );
}

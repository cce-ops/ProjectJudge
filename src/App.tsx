import { useEffect, useReducer } from 'react';
import { Sidebar } from './components/Sidebar';
import { ErrorNotice } from './components/ErrorNotice';
import { useSettings } from './hooks/useSettings';
import { appReducer, initialState } from './state/appMachine';

export default function App() {
  const { settings, setSettings } = useSettings();
  const [state, dispatch] = useReducer(appReducer, undefined, () => initialState(settings));

  useEffect(() => {
    dispatch({ type: 'settings/updated', settings });
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row dark:bg-gray-950 dark:text-gray-100">
      <Sidebar
        settings={settings}
        onSaveKey={(key) => setSettings({ ...settings, apiKey: key })}
        onRemoveKey={() => setSettings({ ...settings, apiKey: '' })}
        onModelChange={(model) => setSettings({ ...settings, model })}
        onThemeToggle={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        rubricName={state.rubric ? state.rubric.source : null}
        referenceCount={0}
      />

      <main className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h2 className="mb-1 text-2xl font-bold">ProyectJudge</h2>
            <p className="text-sm text-gray-500">Evaluación de informes de proyectos de ingeniería con IA</p>
          </div>

          {!settings.apiKey && (
            <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
              Falta la API key de Gemini en la barra lateral.
            </p>
          )}

          {state.error && (
            <ErrorNotice message={state.error} onDismiss={() => dispatch({ type: 'error/dismissed' })} />
          )}

          <p className="text-sm text-gray-500">Paso actual: {state.step}</p>
        </div>
      </main>
    </div>
  );
}

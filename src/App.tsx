import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ErrorNotice } from './components/ErrorNotice';
import { RubricPanel } from './components/RubricPanel';
import { DocumentsPanel } from './components/DocumentsPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { useSettings } from './hooks/useSettings';
import { useEvaluation } from './hooks/useEvaluation';
import { appReducer, initialState } from './state/appMachine';
import { createGeminiClientFromKey } from './lib/ai/geminiClient';
import { extractDocument } from './lib/extract/extractDocument';
import { estimateEvaluation, type ReferenceSummary } from './lib/evaluation/orchestrate';

export default function App() {
  const { settings, setSettings } = useSettings();
  const [state, dispatch] = useReducer(appReducer, undefined, () => initialState(settings));
  const { submitDocuments, cancel } = useEvaluation({ dispatch, settings });
  const lastFileRef = useRef<File | null>(null);

  useEffect(() => {
    dispatch({ type: 'settings/updated', settings });
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const client = useMemo(
    () => (settings.apiKey ? createGeminiClientFromKey(settings.apiKey, settings.model) : null),
    [settings.apiKey, settings.model]
  );

  const summary = state.document
    ? {
        sections: state.document.sections.length,
        figures: state.document.figures.length,
        words: state.document.stats.words,
        warnings: state.document.warnings,
      }
    : null;

  const estimate = state.document
    ? estimateEvaluation({ document: state.document, references: state.references })
    : null;

  const handleSelectFile = (file: File) => {
    lastFileRef.current = file;
    if (state.rubric) {
      void submitDocuments(file, state.rubric, state.references);
    }
  };

  const handleEvaluate = () => {
    if (lastFileRef.current && state.rubric) {
      void submitDocuments(lastFileRef.current, state.rubric, state.references);
    }
  };

  const handleAddReference = async (file: File) => {
    try {
      const document = await extractDocument(file);
      const reference: ReferenceSummary = {
        fileName: document.fileName,
        format: document.format,
        text: document.text.slice(0, 10000),
        stats: document.stats,
      };
      dispatch({ type: 'references/added', reference });
    } catch (e) {
      dispatch({
        type: 'evaluation/failed',
        error: e instanceof Error ? e.message : 'No se pudo añadir la referencia.',
      });
    }
  };

  const inProgress = state.step === 'mapping' || state.step === 'sections' || state.step === 'synthesizing';

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row dark:bg-gray-950 dark:text-gray-100">
      <Sidebar
        settings={settings}
        onSaveKey={(key) => setSettings({ ...settings, apiKey: key })}
        onRemoveKey={() => setSettings({ ...settings, apiKey: '' })}
        onModelChange={(model) => setSettings({ ...settings, model })}
        onThemeToggle={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        rubricName={state.rubric ? state.rubric.source : null}
        referenceCount={state.references.length}
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

          {state.step === 'rubric' && <RubricPanel client={client} onConfirmed={(rubric) => dispatch({ type: 'rubric/parsed', rubric })} />}

          {state.step === 'documents' && (
            <DocumentsPanel
              onSelectFile={handleSelectFile}
              summary={summary}
              estimate={estimate}
              referenceCount={state.references.length}
              references={state.references.map((r) => ({ fileName: r.fileName }))}
              onEvaluate={state.document && lastFileRef.current ? handleEvaluate : undefined}
              onAddReference={handleAddReference}
              onRemoveReference={(fileName) => dispatch({ type: 'references/removed', fileName })}
              disabled={inProgress}
            />
          )}

          {inProgress && <ProgressPanel progress={state.progress} onCancel={cancel} />}

          {state.step === 'results' && state.report && (
            <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-bold">Valoración global: {state.report.synthesis.overallAssessment}</h3>
              <p className="text-sm">{state.report.synthesis.summary}</p>
              <button
                type="button"
                onClick={() => dispatch({ type: 'evaluation/reset' })}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold"
              >
                Evaluar otro informe
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

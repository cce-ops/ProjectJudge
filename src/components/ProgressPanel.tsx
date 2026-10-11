import type { EvaluationProgressState } from '../state/appMachine';

export function ProgressPanel({
  progress,
  onCancel,
}: {
  progress: EvaluationProgressState | null;
  onCancel: () => void;
}) {
  let message = 'Preparando la evaluación…';
  if (progress?.phase === 'sections') {
    const index = (progress.sectionIndex ?? 0) + 1;
    message = `Evaluando sección ${index} de ${progress.sectionTotal ?? '?'}: ${progress.sectionTitle ?? ''}`;
  } else if (progress?.phase === 'synthesis') {
    message = 'Generando la síntesis global…';
  } else if (progress?.phase === 'map') {
    message = 'Analizando la estructura del documento…';
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-medium" role="status">
        {message}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold"
      >
        Cancelar
      </button>
    </section>
  );
}

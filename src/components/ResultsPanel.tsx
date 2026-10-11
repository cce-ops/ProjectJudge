import type { ReportView } from '../types/evaluation';

interface ResultsPanelProps {
  view: ReportView;
  onReset: () => void;
  onDownloadWord: () => void;
}

export function ResultsPanel({ view, onReset, onDownloadWord }: ResultsPanelProps) {
  const missing = view.map.slots.filter((s) => !s.present);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h3 className="text-xl font-bold">{view.document.fileName}</h3>
          <p className="text-xs text-gray-500">Evaluado con {view.model}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={onDownloadWord}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white"
          >
            Descargar Word
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-bold"
          >
            Evaluar otro informe
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-2xl font-black">{view.synthesis.overallAssessment}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider">Valoración global</p>
        <h4 className="mt-3 font-bold">Resumen</h4>
        <p className="text-sm">{view.synthesis.summary}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider">Criterios de evaluación</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {view.rubric.criteria.map((c) => {
            const evaluated = view.sections
              .filter((s) => s.evaluated)
              .flatMap((s) => s.criteria)
              .filter((r) => r.criterionId === c.id);
            return (
              <div key={c.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{c.name}</span>
                  {evaluated.length > 0 && (
                    <span className="text-xs font-extrabold text-blue-700">
                      {evaluated.map((r) => `${r.score}/${r.maxScore}`).join(' · ')}
                    </span>
                  )}
                </div>
                {evaluated.map((r, i) => (
                  <p key={i} className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {r.feedback} Evidencia: {r.evidence}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider">Evaluación por apartados</h4>
        {view.sections.map((s) => (
          <article
            key={s.sectionId}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:break-inside-avoid dark:border-gray-800 dark:bg-gray-900"
          >
            <h5 className="text-sm font-bold">{s.title || s.sectionId}</h5>
            {!s.evaluated ? (
              <p className="mt-1 text-xs text-gray-500">No evaluada: {s.error ?? 'sin motivo indicado'}.</p>
            ) : (
              <div className="mt-2 space-y-2 text-xs">
                {s.strengths.length > 0 && (
                  <div>
                    <span className="font-bold text-emerald-700">Puntos fuertes: </span>
                    {s.strengths.join('; ')}
                  </div>
                )}
                {s.improvements.length > 0 && (
                  <div>
                    <span className="font-bold text-amber-700">Mejoras: </span>
                    {s.improvements.join('; ')}
                  </div>
                )}
                {s.figureNotes.length > 0 && (
                  <ul className="list-disc pl-5">
                    {s.figureNotes.map((f, i) => (
                      <li key={i}>
                        Figura {f.figureId}: {f.note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {missing.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Apartados ausentes</h4>
          <ul className="list-disc pl-5 text-sm">
            {missing.map((m) => (
              <li key={m.slot.id}>
                {m.slot.label}: no se ha detectado en el documento.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Coherencia y comparación</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {view.synthesis.coherenceNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm">{view.synthesis.referenceComparison}</p>
      </section>
    </div>
  );
}

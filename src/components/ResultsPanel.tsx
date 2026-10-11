import type { ReportView } from '../types/evaluation';
import { displayTitle, verdictsForCriterion, formatFigureNote, nonEvaluableLine } from '../lib/report/buildReport';
import { formatGroupWeight } from '../lib/rubric/weights';

interface ResultsPanelProps {
  view: ReportView;
  onReset: () => void;
  onDownloadWord: () => void;
}

export function ResultsPanel({ view, onReset, onDownloadWord }: ResultsPanelProps) {
  const missing = view.map.slots.filter((s) => !s.present);
  const evaluatedSections = view.sections.filter((s) => s.evaluated);
  const unevaluatedSections = view.sections.filter((s) => !s.evaluated);
  const fullCoverageMiss = missing.length > 0 && missing.length >= view.map.slots.length;

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
        <h4 className="mb-1 text-sm font-bold uppercase tracking-wider">Ficha del informe</h4>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
          <div>
            <dt className="inline font-bold">Archivo: </dt>
            <dd className="inline">{view.document.fileName}</dd>
          </div>
          <div>
            <dt className="inline font-bold">Rúbrica: </dt>
            <dd className="inline">{view.rubric.source}</dd>
          </div>
          <div>
            <dt className="inline font-bold">Modelo y fecha: </dt>
            <dd className="inline">
              {view.model} · {view.createdAt}
            </dd>
          </div>
          <div>
            <dt className="inline font-bold">Contenido: </dt>
            <dd className="inline">
              {view.document.stats.words} palabras, {view.document.stats.figuresUsed} figuras en{' '}
              {evaluatedSections.length} apartados evaluados
              {view.document.stats.pages ? ` (${view.document.stats.pages} páginas)` : ''}
            </dd>
          </div>
        </dl>
        {view.synthesis.about && (
          <div className="mt-3">
            <h5 className="font-bold">De qué trata</h5>
            <p className="text-sm">{view.synthesis.about}</p>
          </div>
        )}
        <div className="mt-3">
          <h5 className="font-bold">Estructura detectada</h5>
          <ul className="list-disc pl-5 text-sm">
            {view.sections.map((s) => (
              <li key={s.sectionId}>
                {displayTitle(view, s)}
                {!s.evaluated && <span className="text-gray-500"> (no evaluado)</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider">Criterios de evaluación</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {view.rubric.criteria.map((c) => {
            const verdicts = verdictsForCriterion(view, c);
            const evaluated = verdicts.filter((v) => v.result.evaluable);
            const nonEvaluated = verdicts.filter((v) => !v.result.evaluable);
            return (
              <div key={c.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {c.name}
                    {formatGroupWeight(c) && (
                      <span className="font-normal text-gray-500"> ({formatGroupWeight(c)})</span>
                    )}
                  </span>
                  {evaluated.length > 0 && (
                    <span className="text-xs font-extrabold text-blue-700">
                      {evaluated.map((v) => `${v.result.score}/${v.result.maxScore}`).join(' · ')}
                    </span>
                  )}
                </div>
                {verdicts.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">Sin evidencias en el documento evaluado.</p>
                )}
                {verdicts.length > 0 && evaluated.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    No evaluable en este documento: {nonEvaluated[0].result.motivo || 'sin motivo indicado'}.
                  </p>
                )}
                {evaluated.map((v, i) => (
                  <p key={i} className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">[{v.sectionTitle}]</span> {v.result.feedback} Evidencia:{' '}
                    {v.result.evidence}
                  </p>
                ))}
                {evaluated.length > 0 && nonEvaluated.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">{nonEvaluableLine(nonEvaluated.length)}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider">Evaluación por apartados</h4>
        {view.sections.map((s) =>
          !s.evaluated ? null : (
            <article
              key={s.sectionId}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm print:break-inside-avoid dark:border-gray-800 dark:bg-gray-900"
            >
              <h5 className="text-sm font-bold">{displayTitle(view, s)}</h5>
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
                      <li key={i}>{formatFigureNote(f.figureId, f.note)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          )
        )}
        {unevaluatedSections.length > 0 && (
          <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <summary className="cursor-pointer text-sm font-bold">
              Apartados no evaluados ({unevaluatedSections.length})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
              {unevaluatedSections.map((s) => (
                <li key={s.sectionId}>
                  {displayTitle(view, s)}: {s.error ?? 'sin motivo indicado'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {missing.length > 0 &&
        (fullCoverageMiss ? (
          <details className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider">
              Apartados ausentes ({missing.length})
            </summary>
            <p className="mt-2 text-sm">
              Ningún apartado de la plantilla se ha localizado con seguridad; la estructura detectada se muestra
              arriba. Revisa que el documento tenga encabezados claros.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {missing.map((m) => (
                <li key={m.slot.id}>{m.slot.label}: no se ha detectado en el documento.</li>
              ))}
            </ul>
          </details>
        ) : (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Apartados ausentes</h4>
            <ul className="list-disc pl-5 text-sm">
              {missing.map((m) => (
                <li key={m.slot.id}>{m.slot.label}: no se ha detectado en el documento.</li>
              ))}
            </ul>
          </section>
        ))}

      {view.checks.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Comprobaciones</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {view.checks.map((check) => (
              <li key={check.id}>
                <span className={check.passed ? 'text-emerald-700' : 'font-bold text-amber-700'}>
                  {check.passed ? '✓' : '⚠'}
                </span>{' '}
                {check.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Comprobaciones mecánicas sobre el documento, sin intervención de la IA.
          </p>
        </section>
      )}

      {view.synthesis.nextSteps.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Para subir de nivel</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {view.synthesis.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
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

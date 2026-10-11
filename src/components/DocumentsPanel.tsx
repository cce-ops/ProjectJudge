export interface ExtractionSummary {
  sections: number;
  figures: number;
  words: number;
  warnings: string[];
}

export interface CostEstimate {
  calls: number;
  tokens: number;
}

interface DocumentsPanelProps {
  onSelectFile: (file: File) => void;
  summary: ExtractionSummary | null;
  estimate: CostEstimate | null;
  referenceCount: number;
  disabled?: boolean;
  references?: { fileName: string }[];
  onEvaluate?: () => void;
  onAddReference?: (file: File) => void;
  onRemoveReference?: (fileName: string) => void;
}

export function DocumentsPanel({
  onSelectFile,
  summary,
  estimate,
  referenceCount,
  disabled,
  references,
  onEvaluate,
  onAddReference,
  onRemoveReference,
}: DocumentsPanelProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div>
        <h3 className="text-lg font-bold">Paso 2: Informe a evaluar</h3>
        <p className="text-sm text-gray-500">Sube el informe del alumno (PDF, Word o Markdown).</p>
      </div>

      <input
        type="file"
        accept=".pdf,.docx,.md,.txt"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);
        }}
        className="text-sm"
      />

      {referenceCount === 0 && (
        <p className="rounded-xl bg-gray-100 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Sin informes de referencia: se evaluará solo con la rúbrica.
        </p>
      )}

      {summary && (
        <div className="space-y-1 text-sm">
          <p>
            {summary.sections} secciones, {summary.figures} figuras, {summary.words} palabras.
          </p>
          {summary.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
              {w}
            </p>
          ))}
        </div>
      )}

      {estimate && (
        <p className="text-xs text-gray-500">
          Estimación: {estimate.calls} llamadas a la IA y unos {estimate.tokens} tokens.
        </p>
      )}

      {summary && onEvaluate && (
        <button
          type="button"
          onClick={onEvaluate}
          disabled={disabled}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Evaluar informe
        </button>
      )}

      {onAddReference && (
        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Informes de referencia ({referenceCount}/2)
          </p>
          {references?.map((r) => (
            <div key={r.fileName} className="flex items-center justify-between text-xs">
              <span>{r.fileName}</span>
              {onRemoveReference && (
                <button
                  type="button"
                  aria-label={`Quitar ${r.fileName}`}
                  onClick={() => onRemoveReference(r.fileName)}
                  className="px-2 py-1 text-red-500"
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
          {referenceCount < 2 && (
            <label className="block text-xs">
              Añadir informe de referencia
              <input
                type="file"
                accept=".pdf,.docx,.md,.txt"
                aria-label="Añadir informe de referencia"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onAddReference(file);
                }}
                className="mt-1 block text-xs"
              />
            </label>
          )}
        </div>
      )}
    </section>
  );
}

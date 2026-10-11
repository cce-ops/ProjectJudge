import { useEffect, useState } from 'react';
import type { JsonClient } from '../lib/ai/gemini';
import type { RubricModel } from '../types/rubric';
import { parseRubric } from '../lib/rubric/parseRubric';
import { formatGroupWeight } from '../lib/rubric/weights';

interface RubricPanelProps {
  client: JsonClient | null;
  onConfirmed: (rubric: RubricModel) => void;
  initialText?: string;
}

export function RubricPanel({ client, onConfirmed, initialText }: RubricPanelProps) {
  const [text, setText] = useState(initialText ?? '');
  const [rubric, setRubric] = useState<RubricModel | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
      setRubric(null);
    }
  }, [initialText]);

  const handleParse = async () => {
    if (!client) return;
    setParsing(true);
    setError(null);
    try {
      const parsed = await parseRubric(text, client);
      setRubric(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo interpretar la rúbrica.');
      setRubric(null);
    } finally {
      setParsing(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div>
        <h3 className="text-lg font-bold">Paso 1: Rúbrica de evaluación</h3>
        <p className="text-sm text-gray-500">
          Pega la rúbrica de la asignatura. La IA la interpretará y podrás revisarla antes de evaluar.
        </p>
      </div>

      <label className="block space-y-1 text-sm font-medium" htmlFor="rubric-text">
        Rúbrica
        <textarea
          id="rubric-text"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí los criterios, niveles y puntuaciones…"
          className="w-full rounded-xl border border-gray-300 p-3 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleParse}
          disabled={parsing || !client || text.trim().length === 0}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {parsing ? 'Interpretando…' : 'Interpretar rúbrica'}
        </button>
        <button
          type="button"
          onClick={() => rubric && onConfirmed(rubric)}
          disabled={!rubric}
          className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold disabled:opacity-50"
        >
          Confirmar rúbrica
        </button>
      </div>

      {!client && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Introduce tu API key de Gemini en la barra lateral para interpretar la rúbrica.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {rubric && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-wider">Criterios interpretados</h4>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {rubric.criteria.map((c) => (
              <li key={c.id} className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
                <span className="font-bold">{c.name}</span>{' '}
                <span className="text-gray-500">({c.maxScore} puntos)</span>
                {formatGroupWeight(c) && (
                  <span className="text-gray-500"> ({formatGroupWeight(c)})</span>
                )}
                <p className="text-xs text-gray-500">{c.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

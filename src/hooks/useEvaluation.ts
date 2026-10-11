import { useMemo, useRef } from 'react';
import type { Dispatch } from 'react';
import type { Settings } from '../types/app';
import type { RubricModel } from '../types/rubric';
import type { ReportView } from '../types/evaluation';
import type { AppAction } from '../state/appMachine';
import type { JsonClient } from '../lib/ai/gemini';
import { createGeminiClientFromKey } from '../lib/ai/geminiClient';
import { createFallbackJsonClient } from '../lib/ai/fallback';
import { AVAILABLE_MODELS } from '../lib/ai/models';
import { createConcurrencyLimiter } from '../lib/ai/limiter';
import { parseRubric } from '../lib/rubric/parseRubric';
import { extractDocument } from '../lib/extract/extractDocument';
import { orchestrate, type ReferenceSummary } from '../lib/evaluation/orchestrate';
import { synthesize } from '../lib/evaluation/synthesize';

interface UseEvaluationDeps {
  dispatch: Dispatch<AppAction>;
  settings: Settings;
  clientFactory?: (apiKey: string, model: string) => JsonClient;
}

export function useEvaluation({ dispatch, settings, clientFactory }: UseEvaluationDeps) {
  const cancelledRef = useRef(false);
  const rubricCacheRef = useRef(new Map<string, RubricModel>());
  const factory = clientFactory ?? createGeminiClientFromKey;

  const client = useMemo(() => {
    const chain = [settings.model, ...AVAILABLE_MODELS.filter((m) => m !== settings.model)];
    return createFallbackJsonClient(chain.map((model) => factory(settings.apiKey, model)));
  }, [settings.apiKey, settings.model, factory]);

  const parseRubricText = async (text: string): Promise<RubricModel | null> => {
    if (!settings.apiKey) {
      dispatch({ type: 'rubric/failed', error: 'Introduce tu API key de Gemini en la barra lateral.' });
      return null;
    }
    try {
      const rubric = await parseRubric(text, client, rubricCacheRef.current);
      dispatch({ type: 'rubric/parsed', rubric });
      return rubric;
    } catch (e) {
      dispatch({
        type: 'rubric/failed',
        error: e instanceof Error ? e.message : 'No se pudo interpretar la rúbrica.',
      });
      return null;
    }
  };

  const submitDocuments = async (
    file: File,
    rubric: RubricModel,
    references: ReferenceSummary[]
  ): Promise<void> => {
    if (!settings.apiKey) {
      dispatch({ type: 'documents/submitted' });
      return;
    }
    cancelledRef.current = false;
    try {
      const document = await extractDocument(file);
      if (cancelledRef.current) {
        dispatch({ type: 'evaluation/failed', error: 'Evaluación cancelada por el usuario.' });
        return;
      }
      dispatch({ type: 'documents/extracted', document });
      const limiter = createConcurrencyLimiter(2);
      const report = await orchestrate({
        document,
        references,
        rubric,
        client,
        model: settings.model,
        limiter,
        onProgress: (progress: { phase: 'map' | 'sections' | 'synthesis'; sectionIndex?: number; sectionTotal?: number; sectionTitle?: string }) =>
          dispatch({ type: 'evaluation/progress', progress }),
      });
      if (cancelledRef.current) {
        dispatch({ type: 'evaluation/failed', error: 'Evaluación cancelada por el usuario.' });
        return;
      }
      dispatch({ type: 'evaluation/done', report });
    } catch (e) {
      if (cancelledRef.current) {
        dispatch({ type: 'evaluation/failed', error: 'Evaluación cancelada por el usuario.' });
        return;
      }
      dispatch({
        type: 'evaluation/failed',
        error: e instanceof Error ? e.message : 'Error durante la evaluación.',
      });
    }
  };

  const cancel = (): void => {
    cancelledRef.current = true;
  };

  const retrySynthesis = async (report: ReportView, referenceLabels: string[] = []): Promise<void> => {
    if (!settings.apiKey) {
      dispatch({ type: 'evaluation/failed', error: 'Introduce tu API key de Gemini en la barra lateral.' });
      return;
    }
    try {
      const synthesis = await synthesize(
        { map: report.map, sections: report.sections, rubric: report.rubric, referenceLabels },
        client
      );
      dispatch({ type: 'evaluation/done', report: { ...report, synthesis } });
    } catch (e) {
      dispatch({
        type: 'evaluation/failed',
        error: e instanceof Error ? e.message : 'No se pudo regenerar la síntesis.',
      });
    }
  };

  return { parseRubricText, submitDocuments, cancel, retrySynthesis };
}

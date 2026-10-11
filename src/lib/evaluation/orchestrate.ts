import type { ExtractedDocument } from '../../types/extract';
import type { ReportView } from '../../types/evaluation';
import { buildDocumentMap } from './buildDocumentMap';
import { evaluateSections, mergeTinySections } from './evaluateSections';
import { synthesize } from './synthesize';
import type { RubricModel } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';
import { createConcurrencyLimiter, type ConcurrencyLimiter } from '../ai/limiter';
import { buildChecks } from '../report/checks';

export interface ReferenceSummary {
  fileName: string;
  format: string;
  text: string;
  stats: { words: number; figuresUsed: number; figuresDiscarded: number };
}

export interface EstimateInput {
  document: ExtractedDocument;
  references: ReferenceSummary[];
  maxSections?: number;
}

export interface EstimateResult {
  calls: number;
  tokens: number;
  truncated: boolean;
}

export function estimateEvaluation(input: EstimateInput): EstimateResult {
  const maxSections = input.maxSections ?? 20;
  const maxCharsPerSection = 6000;
  const maxCharsPerReference = 10000;
  const maxFiguresPerSection = 3;
  const tokensPerChar = 0.25; // aproximado
  const tokensPerFigure = 1000;

  const merged = mergeTinySections(input.document.sections);
  const sectionsToEvaluate = Math.min(merged.length, maxSections);
  const referencesCount = Math.min(input.references.length, 2);

  const sectionTextChars = merged.slice(0, sectionsToEvaluate).reduce((sum: number, s: { text: string }) => sum + Math.min(s.text.length, maxCharsPerSection), 0);
  const referenceChars = input.references.slice(0, referencesCount).reduce((sum: number, r: { text: string }) => sum + Math.min(r.text.length, maxCharsPerReference), 0);
  const figureCount = Math.min(input.document.figures.length, maxFiguresPerSection * sectionsToEvaluate);

  const totalChars = sectionTextChars + referenceChars;
  const tokens = Math.round(totalChars * tokensPerChar + figureCount * tokensPerFigure);
  const truncated = input.document.sections.length > maxSections || sectionTextChars < input.document.sections.reduce((sum: number, s: { text: string }) => sum + s.text.length, 0);
  const calls = 1 + sectionsToEvaluate + 1; // mapa + secciones + síntesis

  return { calls, tokens, truncated };
}

export interface OrchestrateInput {
  document: ExtractedDocument;
  references: ReferenceSummary[];
  rubric: RubricModel;
  client: JsonClient;
  model?: string;
  limiter?: { run: <T>(task: () => Promise<T>) => Promise<T> };
  shouldAbort?: () => boolean;
  onProgress?: (progress: { phase: 'map' | 'sections' | 'synthesis'; sectionIndex?: number; sectionTotal?: number; sectionTitle?: string }) => void;
}

export async function orchestrate(
  input: OrchestrateInput,
  deps?: { newId?: () => string; now?: () => string }
): Promise<ReportView> {
  const now = deps?.now || (() => new Date().toISOString());
  const newIdFn = deps?.newId || (() => 'rep-' + Math.random().toString(36).slice(2));

  const limiter: ConcurrencyLimiter = input.limiter ?? createConcurrencyLimiter(2);

  if (input.shouldAbort?.()) {
    throw new Error('Evaluación cancelada por el usuario.');
  }
  input.onProgress?.({ phase: 'map' });
  const documentMap = await buildDocumentMap(input.document, input.client);

  const evaluatedSections = await evaluateSections(
    {
      document: input.document,
      references: input.references,
      rubric: input.rubric,
      map: documentMap,
      limits: { maxSections: 20, maxSectionChars: 6000, maxReferenceChars: 10000, maxFiguresPerSection: 3 },
      shouldAbort: input.shouldAbort,
      onSectionProgress: ({ done, total, title }) =>
        input.onProgress?.({ phase: 'sections', sectionIndex: done - 1, sectionTotal: total, sectionTitle: title }),
    },
    input.client,
    limiter
  );

  if (input.shouldAbort?.()) {
    throw new Error('Evaluación cancelada por el usuario.');
  }
  input.onProgress?.({ phase: 'synthesis' });
  const synthesis = await synthesize({
    map: documentMap,
    sections: evaluatedSections,
    rubric: input.rubric,
    referenceLabels: input.references.map(r => r.fileName),
  }, input.client);

  return {
    reportId: newIdFn(),
    createdAt: now(),
    model: input.model ?? 'gemini-3.8-flash',
    rubric: input.rubric,
    document: { fileName: input.document.fileName, format: input.document.format, stats: input.document.stats },
    map: documentMap,
    sections: evaluatedSections,
    synthesis,
    checks: buildChecks(input.document.text, input.document.figures.length),
  };
}

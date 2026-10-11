import type { ExtractedDocument, Section } from '../../types/extract';
import type { SectionEvaluation, DocumentMap } from '../../types/evaluation';
import type { RubricModel, RubricCriterion } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';
import { createConcurrencyLimiter, type ConcurrencyLimiter } from '../ai/limiter';

export interface SectionProgress {
  done: number;
  total: number;
  title: string;
}

interface SectionsInput {
  document: ExtractedDocument;
  references: { fileName: string; format: string; text: string; stats: { words: number; figuresUsed: number; figuresDiscarded: number } }[];
  rubric: RubricModel;
  map?: DocumentMap;
  limits?: { maxSections?: number; maxSectionChars?: number; maxReferenceChars?: number; maxFiguresPerSection?: number; minSectionChars?: number };
  onSectionProgress?: (progress: SectionProgress) => void;
}

const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Fusiona con la sección anterior las secciones con muy poco texto.
 * Los detectores de encabezados a veces trocean el documento en decenas de
 * fragmentos (una línea numerada, un rótulo en mayúsculas…); cada fragmento
 * costaría una llamada a la IA. Al fusionarlos se conserva el contenido y se
 * reduce el número de llamadas sin perder información.
 */
export function mergeTinySections(sections: Section[], minChars = 300): Section[] {
  const kept: Section[] = [];
  for (const section of sections) {
    const figureIds = section.figureIds ?? [];
    const last = kept[kept.length - 1];
    if (last && section.text.trim().length < minChars) {
      last.text += `\n\n## ${section.title}\n${section.text}`;
      last.pageEnd = section.pageEnd ?? last.pageEnd;
      last.figureIds = [...(last.figureIds ?? []), ...figureIds];
    } else {
      kept.push({ ...section, figureIds: [...figureIds] });
    }
  }
  return kept;
}

function notEvaluated(
  section: Section,
  map: DocumentMap | undefined,
  rubric: RubricModel,
  error: string,
  withCriteria: boolean
): SectionEvaluation {
  return {
    sectionId: section.id,
    title: section.title,
    slotId: map?.slots?.find((s: { sectionId: string | null }) => s.sectionId === section.id)?.slot?.id || null,
    criteria: withCriteria
      ? rubric.criteria.map((c: RubricCriterion) => ({
          criterionId: c.id,
          score: 0,
          maxScore: c.maxScore,
          evidence: '',
          feedback: 'No evaluado por error.',
        }))
      : [],
    strengths: [],
    improvements: [],
    figureNotes: [],
    evaluated: false,
    error,
  };
}

export async function evaluateSections(
  input: SectionsInput,
  client: JsonClient,
  limiter?: ConcurrencyLimiter
): Promise<SectionEvaluation[]> {
  const maxSections = input.limits?.maxSections ?? 20;
  const maxChars = input.limits?.maxSectionChars ?? 6000;
  const minChars = input.limits?.minSectionChars ?? 300;

  const merged = mergeTinySections(input.document.sections, minChars);
  const sectionsToEvaluate = merged.slice(0, maxSections);
  const total = sectionsToEvaluate.length;
  const results: SectionEvaluation[] = new Array(total);

  const run = limiter
    ? <T,>(task: () => Promise<T>): Promise<T> => limiter.run(task)
    : createConcurrencyLimiter(1).run;

  let done = 0;
  let consecutiveFailures = 0;
  let aborted = false;

  const report = (section: Section, position: number): void => {
    done += 1;
    input.onSectionProgress?.({
      done,
      total,
      title: section.title || `Sección ${position + 1}`,
    });
  };

  const evaluateOne = async (section: Section, position: number): Promise<SectionEvaluation> => {
    if (aborted) {
      const result = notEvaluated(
        section,
        input.map,
        input.rubric,
        'Evaluación interrumpida: la IA falló repetidamente (posible cuota agotada). Inténtalo más tarde.',
        false
      );
      report(section, position);
      return result;
    }
    try {
      const truncatedText = section.text.length > maxChars ? section.text.slice(0, maxChars) + '[…]' : section.text;

      const payload = {
        prompt: `Evalúa la sección "${section.title}" del informe según los criterios:\n${input.rubric.criteria.map((c: RubricCriterion) => `- ${c.name} (0-${c.maxScore})`).join('\n')}\nTexto de la sección (recortado si es largo):\n${truncatedText}`,
        schema: {
          type: 'object',
          properties: {
            criteria: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterionId: { type: 'string' }, score: { type: 'number' }, maxScore: { type: 'number' }, evidence: { type: 'string' }, feedback: { type: 'string' },
                },
                required: ['criterionId', 'score', 'maxScore', 'evidence', 'feedback'],
              },
            },
            strengths: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            figureNotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: { figureId: { type: 'string' }, note: { type: 'string' } },
                required: ['figureId', 'note'],
              },
            },
          },
          required: ['criteria', 'strengths', 'improvements', 'figureNotes'],
        },
      };

      const response = await client.generateJson(payload);
      const data = response as any;

      const criteriaResults = (data.criteria || []).map((c: any) => ({
        criterionId: c.criterionId,
        score: Math.min(Math.max(c.score, 0), c.maxScore || input.rubric.scale.max),
        maxScore: c.maxScore || input.rubric.scale.max,
        evidence: c.evidence || '',
        feedback: c.feedback || '',
      }));

      consecutiveFailures = 0;
      const result: SectionEvaluation = {
        sectionId: section.id,
        title: section.title,
        slotId: input.map?.slots?.find((s: { sectionId: string | null }) => s.sectionId === section.id)?.slot?.id || null,
        criteria: criteriaResults,
        strengths: data.strengths || [],
        improvements: data.improvements || [],
        figureNotes: data.figureNotes || [],
        evaluated: true,
      };
      report(section, position);
      return result;
    } catch (e: any) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = true;
      }
      const result = notEvaluated(
        section,
        input.map,
        input.rubric,
        e.message || 'Error al evaluar la sección',
        true
      );
      report(section, position);
      return result;
    }
  };

  await Promise.all(
    sectionsToEvaluate.map((section, index) =>
      run(() => evaluateOne(section, index)).then((result) => {
        results[index] = result;
      })
    )
  );

  // Secciones más allá del límite: se listan como no evaluadas.
  for (const section of merged.slice(maxSections)) {
    results.push(notEvaluated(section, input.map, input.rubric, 'No evaluada: excede el límite de secciones.', false));
  }

  return results;
}

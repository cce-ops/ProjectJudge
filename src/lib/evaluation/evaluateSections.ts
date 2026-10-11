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
  shouldAbort?: () => boolean;
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
    const title = section.title ?? '';
    const text = section.text ?? '';
    const last = kept[kept.length - 1];
    // Solo se absorben los fragmentos diminutos SIN título propio (líneas sueltas,
    // rótulos, restos de paginación). Las secciones con título se conservan siempre
    // para no colapsar la estructura real del documento en un único bloque.
    if (last && !title.trim() && text.trim().length < minChars) {
      if (text.trim()) {
        last.text += `\n\n${text}`;
      }
      last.pageEnd = section.pageEnd ?? last.pageEnd;
      last.figureIds = [...(last.figureIds ?? []), ...figureIds];
    } else {
      kept.push({ ...section, title, text, figureIds: [...figureIds] });
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
          evaluable: true,
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
  // Las secciones sin contenido no se envían a la IA (ni consumen tope): se marcan
  // como omitidas. De las que sí tienen texto se evalúan las de más contenido, para
  // que el tope no deje fuera lo sustancial (p. ej. Conclusiones) por culpa de
  // portadas, índices o restos de paginación.
  const withContent = merged.filter((s) => s.text.trim().length > 0);
  const ranked = withContent
    .map((s) => ({ s }))
    .sort((a, b) => b.s.text.length - a.s.text.length);
  const chosen = new Set(ranked.slice(0, maxSections).map((r) => r.s));
  const sectionsToEvaluate = merged.filter((s) => chosen.has(s));
  const total = sectionsToEvaluate.length;
  const evaluatedBySection = new Map<Section, SectionEvaluation>();

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
    if (input.shouldAbort?.()) {
      const result = notEvaluated(
        section,
        input.map,
        input.rubric,
        'Evaluación cancelada por el usuario.',
        false
      );
      report(section, position);
      return result;
    }
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
      const maxFigs = input.limits?.maxFiguresPerSection ?? 3;
      const sectionImages: { base64: string; mimeType: string }[] = [];
      for (const id of section.figureIds ?? []) {
        if (sectionImages.length >= maxFigs) break;
        const figure = (input.document.figures ?? []).find((f) => f.id === id);
        if (figure?.base64) {
          sectionImages.push({ base64: figure.base64, mimeType: figure.mimeType });
        }
      }

      const criteriaList = input.rubric.criteria
        .map((c: RubricCriterion) => `- ${c.name} (id: ${c.id}, 0-${c.maxScore})`)
        .join('\n');
      const figuresLine =
        sectionImages.length > 0
          ? `\n\nSe adjuntan ${sectionImages.length} figuras de esta sección: analízalas visualmente y coméntalas en figureNotes con su contenido real.`
          : '';
      const payload = {
        prompt: `Evalúa la sección "${section.title}" del informe según los criterios:\n${criteriaList}\nTexto de la sección (recortado si es largo):\n${truncatedText}${figuresLine}\n\nResponde un objeto por criterio con su "criterionId" EXACTO de la lista. Valora únicamente el texto aportado: solo indica falta de contenido si el texto de la sección está realmente vacío. Si un criterio no se puede valorar con el contenido de esta sección ni del documento aportado (por ejemplo, criterios de exposición oral o defensa cuando solo se ha entregado el informe escrito), márcalo con "evaluable": false y explica el motivo en "motivo".`,
        images: sectionImages.length > 0 ? sectionImages : undefined,
        schema: {
          type: 'object',
          properties: {
            criteria: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterionId: { type: 'string' }, score: { type: 'number' }, maxScore: { type: 'number' }, evidence: { type: 'string' }, feedback: { type: 'string' }, evaluable: { type: 'boolean' }, motivo: { type: 'string' },
                },
                required: ['criterionId', 'score', 'maxScore', 'evidence', 'feedback', 'evaluable'],
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

      const criteriaResults = (data.criteria || []).map((c: any) => {
        // La IA a veces devuelve el nombre en vez del identificador: se normaliza
        // al identificador canónico de la rúbrica para que el informe lo encuentre.
        const canonical =
          input.rubric.criteria.find((r: RubricCriterion) => r.id === c.criterionId) ??
          input.rubric.criteria.find((r: RubricCriterion) => r.name === c.criterionId);
        return {
          criterionId: canonical?.id ?? c.criterionId,
          score: Math.min(Math.max(c.score, 0), c.maxScore || input.rubric.scale.max),
          maxScore: c.maxScore || input.rubric.scale.max,
          evidence: c.evidence || '',
          feedback: c.feedback || '',
          evaluable: c.evaluable !== false,
          motivo: typeof c.motivo === 'string' && c.motivo ? c.motivo : undefined,
        };
      });

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
        evaluatedBySection.set(section, result);
      })
    )
  );

  // Se reconstruye en orden de documento: evaluadas, omitidas por falta de
  // contenido y descartadas por el límite, cada una con su motivo.
  const results: SectionEvaluation[] = [];
  for (const section of merged) {
    const evaluated = evaluatedBySection.get(section);
    if (evaluated) {
      results.push(evaluated);
    } else if (!section.text.trim()) {
      results.push(
        notEvaluated(section, input.map, input.rubric, 'Sin contenido extraíble: se omitió su evaluación.', false)
      );
    } else {
      results.push(
        notEvaluated(section, input.map, input.rubric, 'No evaluada: excede el límite de secciones.', false)
      );
    }
  }

  return results;
}

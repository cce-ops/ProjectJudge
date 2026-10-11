import type { ExtractedDocument } from '../../types/extract';
import type { SectionEvaluation, DocumentMap } from '../../types/evaluation';
import type { RubricModel } from '../../types/rubric';
import type { JsonClient } from '../ai/gemini';

interface SectionsInput {
  document: ExtractedDocument;
  references: { fileName: string; format: string; text: string; stats: { words: number; figuresUsed: number; figuresDiscarded: number } }[];
  rubric: RubricModel;
  map?: DocumentMap;
  limits?: { maxSections?: number; maxSectionChars?: number; maxReferenceChars?: number; maxFiguresPerSection?: number };
}

export async function evaluateSections(
  input: SectionsInput,
  client: JsonClient
): Promise<SectionEvaluation[]> {
  const maxSections = input.limits?.maxSections ?? 20;
  const maxChars = input.limits?.maxSectionChars ?? 6000;
  const results: SectionEvaluation[] = [];

  const sectionsToEvaluate = input.document.sections.slice(0, maxSections);

  for (const section of sectionsToEvaluate) {
    try {
      const truncatedText = section.text.length > maxChars ? section.text.slice(0, maxChars) + '[…]' : section.text;
      const relevantCriteria = input.rubric.criteria.slice(0, 4);

      const payload = {
        prompt: `Evalúa la sección "${section.title}" del informe según los criterios:\n${relevantCriteria.map((c: { name: string; maxScore: number }) => `- ${c.name} (0-${c.maxScore})`).join('\n')}\nTexto de la sección (recortado si es largo):\n${truncatedText}`,
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

      results.push({
        sectionId: section.id,
        title: section.title,
        slotId: input.map?.slots?.find((s: { sectionId: string | null }) => s.sectionId === section.id)?.slot?.id || null,
        criteria: criteriaResults,
        strengths: data.strengths || [],
        improvements: data.improvements || [],
        figureNotes: data.figureNotes || [],
        evaluated: true,
      });
    } catch (e: any) {
      results.push({
        sectionId: section.id,
        title: section.title,
        slotId: input.map?.slots?.find((s: { sectionId: string | null }) => s.sectionId === section.id)?.slot?.id || null,
        criteria: input.rubric.criteria.map((c: { id: string; maxScore: number }) => ({ criterionId: c.id, score: 0, maxScore: c.maxScore, evidence: '', feedback: 'No evaluado por error.' })),
        strengths: [],
        improvements: [],
        figureNotes: [],
        evaluated: false,
        error: e.message || 'Error al evaluar la sección',
      });
    }
  }

  // Si hay más secciones que el límite, marcar las restantes
  if (input.document.sections.length > maxSections) {
    const remaining = input.document.sections.slice(maxSections);
    for (const section of remaining) {
      results.push({
        sectionId: section.id,
        title: section.title,
        slotId: input.map?.slots?.find((s: { sectionId: string | null }) => s.sectionId === section.id)?.slot?.id || null,
        criteria: [],
        strengths: [],
        improvements: [],
        figureNotes: [],
        evaluated: false,
        error: 'No evaluada: excede el límite de secciones.',
      });
    }
  }

  return results;
}

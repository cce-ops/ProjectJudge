import type { ReportView, SectionEvaluation, SectionCriterionResult } from '../../types/evaluation';
import type { RubricCriterion } from '../../types/rubric';

export interface ReportBlock {
  heading: string;
  paragraphs: string[];
}

/** Título visible de una sección: el propuesto en el mapa, el original o el identificador. */
export function displayTitle(view: ReportView, section: SectionEvaluation): string {
  const mapped = view.map.titles?.find((t) => t.sectionId === section.sectionId)?.title;
  return mapped?.trim() || section.title.trim() || section.sectionId;
}

/** Veredictos de un criterio en todas las secciones, emparejando por id o por nombre. */
export interface CriterionVerdict {
  sectionTitle: string;
  result: SectionCriterionResult;
}

export function verdictsForCriterion(
  view: ReportView,
  criterion: RubricCriterion
): CriterionVerdict[] {
  const verdicts: CriterionVerdict[] = [];
  for (const section of view.sections) {
    if (!section.evaluated) continue;
    for (const result of section.criteria) {
      if (result.criterionId === criterion.id || result.criterionId === criterion.name) {
        verdicts.push({ sectionTitle: displayTitle(view, section), result });
      }
    }
  }
  return verdicts;
}

/** Una línea colapsada por los veredictos no evaluables de un criterio. */
export function nonEvaluableLine(count: number): string {
  return count === 1
    ? 'No evaluable en otro apartado.'
    : `No evaluable en otros ${count} apartados.`;
}

/** Evita el "Figura Figura 2:" cuando la nota ya empieza por "Figura N:". */
export function formatFigureNote(figureId: string, note: string): string {
  if (/^figura\s+\S+:/i.test(note.trim())) {
    return note.trim();
  }
  return `Figura ${figureId}: ${note}`;
}

export function buildReportBlocks(view: ReportView): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const evaluatedSections = view.sections.filter((s) => s.evaluated);

  blocks.push({
    heading: `Informe: ${view.document.fileName} — ${view.synthesis.overallAssessment}`,
    paragraphs: [
      `Valoración global: ${view.synthesis.overallAssessment}.`,
      view.synthesis.summary,
      `Rúbrica: ${view.rubric.source}. Evaluado con ${view.model} el ${view.createdAt}.`,
      `Documento: ${view.document.format}, ${view.document.stats.words} palabras, ${view.document.stats.figuresUsed} figuras usadas en ${evaluatedSections.length} apartados evaluados.`,
      `De qué trata: ${view.synthesis.about}`,
      `Estructura detectada: ${view.sections.map((s) => displayTitle(view, s)).join(' · ')}`,
      `Mapa: ${view.map.summary}`,
    ],
  });

  blocks.push({
    heading: 'Criterios de evaluación',
    paragraphs: view.rubric.criteria.flatMap((c) => {
      const lines = [`${c.name} (máximo ${c.maxScore}): ${c.description}`];
      const verdicts = verdictsForCriterion(view, c);
      const evaluated = verdicts.filter((v) => v.result.evaluable);
      const nonEvaluated = verdicts.filter((v) => !v.result.evaluable);
      if (verdicts.length === 0) {
        lines.push('Sin evidencias en el documento evaluado.');
        return lines;
      }
      if (evaluated.length === 0) {
        lines.push(`No evaluable en este documento: ${nonEvaluated[0].result.motivo || 'sin motivo indicado'}.`);
        return lines;
      }
      lines.push(evaluated.map((v) => `${v.result.score}/${v.result.maxScore}`).join(' · '));
      for (const v of evaluated) {
        lines.push(`[${v.sectionTitle}]: ${v.result.feedback} Evidencia: ${v.result.evidence}`);
      }
      if (nonEvaluated.length > 0) {
        lines.push(nonEvaluableLine(nonEvaluated.length));
      }
      return lines;
    }),
  });

  for (const section of view.sections) {
    if (!section.evaluated) {
      continue;
    }
    const paragraphs: string[] = [];
    for (const c of section.criteria) {
      if (!c.evaluable) {
        continue;
      }
      paragraphs.push(`${c.score}/${c.maxScore}. ${c.feedback} Evidencia: ${c.evidence}`);
    }
    if (section.strengths.length > 0) paragraphs.push(`Fortalezas: ${section.strengths.join('; ')}`);
    if (section.improvements.length > 0) paragraphs.push(`Mejoras: ${section.improvements.join('; ')}`);
    for (const fn of section.figureNotes) {
      paragraphs.push(formatFigureNote(fn.figureId, fn.note));
    }
    blocks.push({
      heading: `Apartado: ${displayTitle(view, section)}`,
      paragraphs,
    });
  }

  const unevaluated = view.sections.filter((s) => !s.evaluated);
  if (unevaluated.length > 0) {
    blocks.push({
      heading: `Apartados no evaluados (${unevaluated.length})`,
      paragraphs: unevaluated.map(
        (s) => `${displayTitle(view, s)}: ${s.error ?? 'sin motivo indicado'}`
      ),
    });
  }

  const missing = view.map.slots.filter((s) => !s.present);
  if (missing.length > 0) {
    blocks.push({
      heading: 'Apartados ausentes',
      paragraphs: missing.map((s) => `${s.slot.label}: no detectado en el documento.`),
    });
  }

  if (view.synthesis.nextSteps.length > 0) {
    blocks.push({
      heading: 'Para subir de nivel',
      paragraphs: view.synthesis.nextSteps,
    });
  }

  blocks.push({
    heading: 'Síntesis global',
    paragraphs: [
      view.synthesis.summary,
      `Fortalezas: ${view.synthesis.strengths.join('; ')}`,
      `Mejoras: ${view.synthesis.improvements.join('; ')}`,
      `Coherencia: ${view.synthesis.coherenceNotes.join('; ')}`,
      `Comparación con referencias: ${view.synthesis.referenceComparison}`,
    ],
  });

  return blocks;
}

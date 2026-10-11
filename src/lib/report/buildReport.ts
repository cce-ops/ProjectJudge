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

/** Resultados de un criterio en todas las secciones, emparejando por id o por nombre. */
export function resultsForCriterion(
  view: ReportView,
  criterion: RubricCriterion
): SectionCriterionResult[] {
  return view.sections
    .filter((s) => s.evaluated)
    .flatMap((s) => s.criteria)
    .filter((r) => r.criterionId === criterion.id || r.criterionId === criterion.name);
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
      const results = resultsForCriterion(view, c);
      if (results.length === 0) {
        lines.push('Sin evidencias en el documento evaluado.');
      }
      for (const r of results) {
        if (!r.evaluable) {
          lines.push(`No evaluable en este documento: ${r.motivo || 'sin motivo indicado'}.`);
        } else {
          lines.push(`${r.score}/${r.maxScore}. ${r.feedback} Evidencia: ${r.evidence}`);
        }
      }
      return lines;
    }),
  });

  for (const section of view.sections) {
    if (!section.evaluated) {
      blocks.push({
        heading: `Apartado: ${displayTitle(view, section)}`,
        paragraphs: [`No evaluada: ${section.error ?? 'sin motivo indicado'}.`],
      });
      continue;
    }
    const paragraphs: string[] = [];
    for (const c of section.criteria) {
      if (!c.evaluable) {
        paragraphs.push(`No evaluable en este documento: ${c.motivo || 'sin motivo indicado'}.`);
      } else {
        paragraphs.push(`${c.score}/${c.maxScore}. ${c.feedback} Evidencia: ${c.evidence}`);
      }
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

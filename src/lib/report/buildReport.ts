import type { ReportView } from '../../types/evaluation';

export interface ReportBlock {
  heading: string;
  paragraphs: string[];
}

export function buildReportBlocks(view: ReportView): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  blocks.push({
    heading: `Informe: ${view.document.fileName} — ${view.synthesis.overallAssessment}`,
    paragraphs: [
      `Valoración global: ${view.synthesis.overallAssessment}.`,
      view.synthesis.summary,
      `Evaluado con ${view.model} el ${view.createdAt}.`,
      `Documento: ${view.document.format}, ${view.document.stats.words} palabras, ${view.document.stats.figuresUsed} figuras usadas.`,
      `Mapa: ${view.map.summary}`,
    ],
  });

  const criterionName = (id: string): string =>
    view.rubric.criteria.find((c) => c.id === id)?.name ?? id;

  blocks.push({
    heading: 'Criterios de evaluación',
    paragraphs: view.rubric.criteria.map((c) => `${c.name} (máximo ${c.maxScore}): ${c.description}`),
  });

  for (const section of view.sections) {
    if (!section.evaluated) {
      blocks.push({
        heading: `Apartado: ${section.title || section.sectionId}`,
        paragraphs: [`No evaluada: ${section.error ?? 'sin motivo indicado'}.`],
      });
      continue;
    }
    const paragraphs: string[] = [];
    for (const c of section.criteria) {
      paragraphs.push(
        `${criterionName(c.criterionId)}: ${c.score}/${c.maxScore}. ${c.feedback} Evidencia: ${c.evidence}`
      );
    }
    if (section.strengths.length > 0) paragraphs.push(`Fortalezas: ${section.strengths.join('; ')}`);
    if (section.improvements.length > 0) paragraphs.push(`Mejoras: ${section.improvements.join('; ')}`);
    for (const fn of section.figureNotes) {
      paragraphs.push(`Figura ${fn.figureId}: ${fn.note}`);
    }
    blocks.push({
      heading: `Apartado: ${section.title || section.sectionId}`,
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

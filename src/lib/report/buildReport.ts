import type { ReportView, SectionEvaluation, SectionCriterionResult } from '../../types/evaluation';
import type { RubricCriterion } from '../../types/rubric';
import { formatGroupWeight } from '../rubric/weights';

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
export function nonEvaluableLine(titles: string[]): string {
  const unique = [...new Set(titles)];
  return unique.length === 1 ? 'No evaluable en otro apartado.' : `No evaluable en otros ${unique.length} apartados.`;
}

export interface PartitionedVerdicts {
  substantive: CriterionVerdict[];
  empty: CriterionVerdict[];
  nonEvaluable: CriterionVerdict[];
}

function hasContent(verdict: CriterionVerdict): boolean {
  return verdict.result.feedback.trim().length > 0 || verdict.result.evidence.trim().length > 0;
}

/** Separa los veredictos evaluables con contenido de los vacíos y los no evaluables. */
export function partitionVerdicts(verdicts: CriterionVerdict[]): PartitionedVerdicts {
  const substantive: CriterionVerdict[] = [];
  const empty: CriterionVerdict[] = [];
  const nonEvaluable: CriterionVerdict[] = [];
  for (const verdict of verdicts) {
    if (!verdict.result.evaluable) {
      nonEvaluable.push(verdict);
    } else if (hasContent(verdict)) {
      substantive.push(verdict);
    } else {
      empty.push(verdict);
    }
  }
  return { substantive, empty, nonEvaluable };
}

/** Línea colapsada para los veredictos sin contenido, con sus apartados distintos. */
export function emptyVerdictsLine(titles: string[]): string {
  const unique = [...new Set(titles)];
  const scope = unique.length > 0 ? ` (${unique.join(', ')})` : '';
  return unique.length === 1
    ? `Sin contenido valorable en otro apartado${scope}.`
    : `Sin contenido valorable en otros ${unique.length} apartados${scope}.`;
}

/**
 * Normaliza la nota de una figura para mostrarla: colapsa tartamudeos del modelo
 * ("Figura Figura 1" → "Figura 1"), respeta las notas que ya empiezan por
 * "Figura N:" o "Tabla N:" y nombra por página los renders ("fig-page-7").
 */
export function formatFigureNote(figureId: string, note: string): string {
  const cleaned = note
    .trim()
    .replace(/^(?:Figura\s+)+/i, 'Figura ')
    .replace(/^Figura\s+(Tabla\s+\d+\s*:)/i, '$1');
  if (/^figura\s+\S+:/i.test(cleaned) || /^tabla\s+\d+\s*:/i.test(cleaned)) {
    return cleaned;
  }
  const page = /^fig-page-(\d+)$/.exec(figureId);
  if (page) {
    return `Figura (pág. ${page[1]}): ${note.trim()}`;
  }
  return `Figura ${figureId}: ${note.trim()}`;
}

export function buildReportBlocks(view: ReportView): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  const evaluatedTitles = view.sections.filter((s) => s.evaluated).map((s) => displayTitle(view, s));
  const pendingCount = view.sections.length - evaluatedTitles.length;
  const pendingSuffix =
    pendingCount === 1
      ? ' … y 1 apartado más sin evaluar.'
      : pendingCount > 1
        ? ` … y ${pendingCount} apartados más sin evaluar.`
        : '';
  blocks.push({
    heading: `Informe: ${view.document.fileName} — ${view.synthesis.overallAssessment}`,
    paragraphs: [
      `Valoración global: ${view.synthesis.overallAssessment}.`,
      view.synthesis.summary,
      `Rúbrica: ${view.rubric.source}. Evaluado con ${view.model} el ${view.createdAt}.`,
      `Documento: ${view.document.format}, ${view.document.stats.words} palabras, ${view.document.stats.figuresUsed} figuras usadas en ${evaluatedTitles.length} apartados evaluados.`,
      `De qué trata: ${view.synthesis.about}`,
      `Estructura detectada: ${evaluatedTitles.join(' · ')}${pendingSuffix}`,
      `Mapa: ${view.map.summary}`,
    ],
  });

  blocks.push({
    heading: 'Criterios de evaluación',
    paragraphs: view.rubric.criteria.flatMap((c) => {
      const weightSuffix = formatGroupWeight(c) ? ` [${formatGroupWeight(c)}]` : '';
      const lines = [`${c.name} (máximo ${c.maxScore})${weightSuffix}: ${c.description}`];
      const { substantive, empty, nonEvaluable } = partitionVerdicts(verdictsForCriterion(view, c));
      if (substantive.length === 0 && nonEvaluable.length === 0 && empty.length === 0) {
        lines.push('Sin evidencias en el documento evaluado.');
        return lines;
      }
      if (substantive.length === 0 && nonEvaluable.length > 0) {
        lines.push(`No evaluable en este documento: ${nonEvaluable[0].result.motivo || 'sin motivo indicado'}.`);
        return lines;
      }
      if (substantive.length === 0) {
        lines.push('Sin contenido valorable en este criterio.');
        return lines;
      }
      lines.push(substantive.map((v) => `${v.result.score}/${v.result.maxScore}`).join(' · '));
      for (const v of substantive) {
        lines.push(`[${v.sectionTitle}]: ${v.result.feedback} Evidencia: ${v.result.evidence}`);
      }
      if (nonEvaluable.length > 0) {
        lines.push(nonEvaluableLine(nonEvaluable.map((v) => v.sectionTitle)));
      }
      if (empty.length > 0) {
        lines.push(emptyVerdictsLine(empty.map((v) => v.sectionTitle)));
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

  if (view.checks.length > 0) {
    blocks.push({
      heading: 'Comprobaciones',
      paragraphs: [
        ...view.checks.map((c) => `${c.passed ? '✓' : '⚠'} ${c.message}`),
        'Comprobaciones mecánicas sobre el documento, sin intervención de la IA.',
      ],
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

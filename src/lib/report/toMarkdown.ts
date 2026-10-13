import type { ReportView, SectionEvaluation } from '../../types/evaluation';

function formatSection(section: SectionEvaluation, view: ReportView): string {
  const lines: string[] = [];
  lines.push(`### ${section.title || section.sectionId}`);
  if (!section.evaluated) {
    lines.push(`No evaluado: ${section.error || 'sin motivo indicado'}.`);
    return lines.join('\n');
  }

  const byCriterion = new Map<string, { score: number; maxScore: number; feedback: string; evidence: string }>();
  for (const c of section.criteria) {
    byCriterion.set(c.criterionId, { score: c.score, maxScore: c.maxScore, feedback: c.feedback, evidence: c.evidence });
  }
  for (const [criterionId, result] of byCriterion) {
    const criterion = view.rubric.criteria.find((c) => c.id === criterionId);
    const name = criterion?.name ?? criterionId;
    const weightSuffix = criterion?.group && criterion?.weight ? ` [${criterion.group} · ${criterion.weight}%]` : '';
    const evidence = result.evidence.trim();
    const feedback = result.feedback.trim();
    const evidenceLine = evidence ? ` Evidencia: ${evidence}` : '';
    const feedbackLine = feedback ? ` ${feedback}` : '';
    lines.push(`- ${name}: ${result.score}/${result.maxScore}${weightSuffix}.${feedbackLine}${evidenceLine}`);
  }

  if (section.strengths.length > 0) lines.push(`**Puntos fuertes:** ${section.strengths.join('; ')}`);
  if (section.improvements.length > 0) lines.push(`**Mejoras:** ${section.improvements.join('; ')}`);
  return lines.join('\n');
}

export function toMarkdown(view: ReportView): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Informe: ${view.document.fileName} — ${view.synthesis.overallAssessment}`);
  lines.push('');

  // Ficha
  lines.push('## Ficha del informe');
  lines.push(`- **Archivo:** ${view.document.fileName}`);
  lines.push(`- **Rúbrica:** ${view.rubric.source}`);
  lines.push(`- **Modelo y fecha:** ${view.model} · ${view.createdAt}`);
  const evaluatedCount = view.sections.filter((s) => s.evaluated).length;
  lines.push(`- **Contenido:** ${evaluatedCount} apartados evaluados`);
  if (view.synthesis.about) lines.push(`- **De qué trata:** ${view.synthesis.about}`);
  lines.push('');

  // Evaluación por apartados (con criterios dentro de cada cuadro)
  lines.push('## Evaluación por apartados');
  for (const section of view.sections) {
    lines.push(formatSection(section, view));
    lines.push('');
  }

  // Checks
  if (view.checks && view.checks.length > 0) {
    lines.push('## Comprobaciones');
    for (const check of view.checks) {
      lines.push(`- ${check.passed ? '✓' : '⚠'} ${check.message}`);
    }
    lines.push('');
  }

  // Coherence
  lines.push('## Coherencia y comparación');
  lines.push(view.synthesis.summary);
  if (view.synthesis.coherenceNotes.length > 0) {
    for (const note of view.synthesis.coherenceNotes) {
      lines.push(`- ${note}`);
    }
  }
  if (view.synthesis.referenceComparison) {
    lines.push(`Comparación con referencias: ${view.synthesis.referenceComparison}`);
  }

  return lines.join('\n');
}
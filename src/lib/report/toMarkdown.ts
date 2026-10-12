import type { ReportView, SectionEvaluation } from '../../types/evaluation';
import { verdictsForCriterion, nonEvaluableLine } from './buildReport';

function formatSection(section: SectionEvaluation): string {
  const lines: string[] = [];
  lines.push(`### ${section.title || section.sectionId}`);
  if (!section.evaluated) {
    lines.push(`No evaluado: ${section.error || 'sin motivo indicado'}.`);
    return lines.join('\n');
  }
  if (section.strengths.length > 0) lines.push(`**Puntos fuertes:** ${section.strengths.join('; ')}`);
  if (section.improvements.length > 0) lines.push(`**Mejoras:** ${section.improvements.join('; ')}`);
  for (const fn of section.figureNotes) {
    lines.push(`- ${fn.note}`);
  }
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
  lines.push(`- **Contenido:** ${view.document.stats.words} palabras, ${view.document.stats.figuresUsed} figuras en ${view.sections.filter((s) => s.evaluated).length} apartados evaluados`);
  if (view.synthesis.about) lines.push(`- **De qué trata:** ${view.synthesis.about}`);

  const evaluatedTitles = view.sections.filter((s) => s.evaluated).map((s) => s.title);
  const pendingCount = view.sections.length - evaluatedTitles.length;
  if (view.sections.length > 0) {
    lines.push(`- **Estructura detectada:** ${evaluatedTitles.join(' · ')}${pendingCount > 0 ? ` … y ${pendingCount} apartados más sin evaluar.` : ''}`);
  }

  // Criterios
  lines.push('');
  lines.push('## Criterios de evaluación');
  for (const criterion of view.rubric.criteria) {
    const weightSuffix = criterion.group && criterion.weight ? ` [${criterion.group} · ${criterion.weight}%]` : '';
    lines.push(`### ${criterion.name} (máx ${criterion.maxScore})${weightSuffix}`);

    const verdicts = verdictsForCriterion(view, criterion);
    if (verdicts.length === 0) {
      lines.push('Sin evaluar aún.');
      continue;
    }

    const evaluated = verdicts.filter((v) => v.result.evaluable);
    if (evaluated.length === 0) {
      lines.push('No evaluable en este documento.');
      continue;
    }

    const scores = evaluated.map((v) => {
      const rubricCriterion = view.rubric.criteria.find((c) => c.id === v.result.criterionId);
      const weightSuffix = rubricCriterion?.group && rubricCriterion?.weight ? ` [${rubricCriterion.group} · ${rubricCriterion.weight}%]` : '';
      return `${v.result.score}/${v.result.maxScore}${weightSuffix}`;
    }).join(' · ');
    lines.push(`Puntuación: ${scores}`);

    for (const v of evaluated) {
      const rubricCriterion = view.rubric.criteria.find((c) => c.id === v.result.criterionId);
      const weightSuffix = rubricCriterion?.group && rubricCriterion?.weight ? ` [${rubricCriterion.group} · ${rubricCriterion.weight}%]` : '';
      lines.push(`- [${v.sectionTitle}]${weightSuffix}: ${v.result.feedback} Evidencia: ${v.result.evidence}`);
    }

    const nonEvaluated = verdicts.filter((v) => !v.result.evaluable);
    if (nonEvaluated.length > 0) {
      lines.push(nonEvaluableLine(nonEvaluated.map((v) => v.sectionTitle)));
    }
    lines.push('');
  }

  // Sections
  lines.push('');
  lines.push('## Evaluación por apartados');
  for (const section of view.sections) {
    lines.push(`### ${section.title || section.sectionId}`);
    if (!section.evaluated) {
      lines.push(`No evaluado: ${section.error || 'sin motivo indicado'}.`);
      continue;
    }
    lines.push(formatSection({ ...section, figureNotes: section.figureNotes }));
    lines.push('');
  }

  // Checks
  if (view.checks && view.checks.length > 0) {
    lines.push('');
    lines.push('## Comprobaciones');
    for (const check of view.checks) {
      lines.push(`- ${check.passed ? '✓' : '⚠'} ${check.message}`);
    }
  }

  // Next steps
  if (view.synthesis.nextSteps && view.synthesis.nextSteps.length > 0) {
    lines.push('');
    lines.push('## Para subir de nivel');
    for (const step of view.synthesis.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  // Coherence
  lines.push('');
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

  // Next steps
  if (view.synthesis.nextSteps && view.synthesis.nextSteps.length > 0) {
    lines.push('');
    lines.push('## Para subir de nivel');
    for (const step of view.synthesis.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join('\n');
}
import { describe, it, expect } from 'vitest';
import { toMarkdown } from './toMarkdown';
import type { ReportView } from '../../types/evaluation';

function sampleView(): ReportView {
  return {
    reportId: 'rep-1',
    createdAt: '2026-10-11T00:00:00.000Z',
    model: 'gemini-3.8-flash',
    rubric: {
      criteria: [
        {
          id: 'c1',
          name: 'Rigor técnico',
          description: '',
          maxScore: 10,
          levels: [{ label: 'Bien', descriptor: '', score: 8 }],
        },
      ],
      scale: { min: 0, max: 10 },
      source: 'Manual',
      fingerprint: 'fp',
    },
    document: { fileName: 'informe.pdf', format: 'pdf', stats: { words: 100, figuresUsed: 0, figuresDiscarded: 0 } },
    map: { slots: [], summary: 'Resumen.', titles: [] },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [
          { criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Evidencia', feedback: 'Bien.', evaluable: true },
        ],
        strengths: ['Claridad'],
        improvements: ['Cuantificar'],
        figureNotes: [],
        evaluated: true,
      },
    ],
    synthesis: {
      overallAssessment: 'Mejorable',
      summary: 'Resumen global.',
      strengths: ['S'],
      improvements: ['I'],
      coherenceNotes: ['Coherente.'],
      referenceComparison: 'Nivel medio.',
      about: 'Informe sobre una comunidad energética.',
      nextSteps: ['Cuantificar el CAPEX.'],
    },
    checks: [
      { id: 'figuras-citadas', passed: true, message: 'Figuras citadas: 2. Imágenes detectadas: 1.' },
      { id: 'decimales', passed: false, message: 'Se mezclan coma y punto.' },
    ],
  };
}

describe('toMarkdown', () => {
  it('genera markdown con cabecera, criterios y apartados', () => {
    const md = toMarkdown(sampleView());
    expect(md).toContain('# Informe: informe.pdf — Mejorable');
    expect(md).toContain('## Evaluación por apartados');
    expect(md).toContain('Rigor técnico: 8/10');
    expect(md).toContain('## Evaluación por apartados');
    expect(md).toContain('### Objetivos');
    expect(md).toContain('**Puntos fuertes:** Claridad');
    expect(md).toContain('**Mejoras:** Cuantificar');
    expect(md).toContain('## Coherencia y comparación');
  });
});

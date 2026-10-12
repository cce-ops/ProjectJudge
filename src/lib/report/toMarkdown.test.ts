import { describe, it, expect } from 'vitest';
import { toMarkdown } from './toMarkdown';

function sampleView() {
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
          group: 'Cálculos',
          weight: 30,
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
      overallAssessment: 'Mejorable' as const,
      summary: 'Resumen global.',
      strengths: ['S'],
      improvements: ['I'],
      coherenceNotes: ['Coherente.'],
      referenceComparison: 'Nivel medio.',
      about: 'Informe sobre una comunidad energética.',
      nextSteps: ['Cuantificar el CAPEX.'],
    },
    checks: [
      { id: 'figuras-citadas', passed: true, message: 'Figuras citadas: 2. Imágenes: 1.' },
      { id: 'decimales', passed: false, message: 'Se mezclan coma y punto.' },
    ],
  };
}

describe('toMarkdown', () => {
  it('genera markdown con cabecera, criterios, apartados y comprobaciones', () => {
    const md = toMarkdown(sampleView());
    expect(md).toContain('# Informe: informe.pdf — Mejorable');
    expect(md).toContain('## Ficha del informe');
    expect(md).toContain('Rigor técnico');
    expect(md).toContain('8/10');
    expect(md).toContain('## Evaluación por apartados');
    expect(md).toContain('### Objetivos');
    expect(md).toContain('## Comprobaciones');
    expect(md).toContain('Se mezclan coma y punto');
    expect(md).toContain('## Para subir de nivel');
    expect(md).toContain('Cuantificar el CAPEX');
  });
});
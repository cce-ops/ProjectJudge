import { describe, it, expect } from 'vitest';
import { buildReportBlocks } from './buildReport';
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
          name: 'Rigor tecnico',
          description: '',
          maxScore: 10,
          levels: [{ label: 'Bien', descriptor: '', score: 8 }],
        },
      ],
      scale: { min: 0, max: 10 },
      source: 'Manual',
      fingerprint: 'fp',
    },
    document: { fileName: 'informe.pdf', format: 'pdf', stats: { words: 100, figuresUsed: 1, figuresDiscarded: 0 } },
    map: {
      slots: [
        { slot: { id: 'objetivos', label: 'Objetivos', description: '' }, present: true, sectionId: 's1' },
        { slot: { id: 'planificacion', label: 'Planificación', description: '' }, present: false, sectionId: null },
      ],
      summary: 'Resumen del mapa.',
    },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Cita literal', feedback: 'Bien.' }],
        strengths: ['Claro'],
        improvements: ['Ampliar'],
        figureNotes: [],
        evaluated: true,
      },
      {
        sectionId: 's2',
        title: 'Anexo sin evaluar',
        slotId: null,
        criteria: [],
        strengths: [],
        improvements: [],
        figureNotes: [],
        evaluated: false,
        error: 'No evaluada: excede el límite de secciones.',
      },
    ],
    synthesis: {
      overallAssessment: 'Mejorable',
      summary: 'Resumen global.',
      strengths: ['S'],
      improvements: ['I'],
      coherenceNotes: ['Coherente.'],
      referenceComparison: 'Nivel medio.',
    },
  };
}

describe('buildReportBlocks', () => {
  it('genera cabecera, criterios, apartados y sintesis sin nota global', () => {
    const blocks = buildReportBlocks(sampleView());
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].heading).toContain('informe.pdf');
    expect(blocks[0].paragraphs.join(' ')).toContain('Mejorable');
    const body = blocks.map((b) => `${b.heading} ${b.paragraphs.join(' ')}`).join('\n');
    expect(body).toContain('Rigor tecnico');
    expect(body).toContain('Objetivos');
    expect(body).toContain('No evaluada');
    expect(body).not.toMatch(/nota global/i);
    expect(body).not.toMatch(/puntuaci.n global/i);
  });
});

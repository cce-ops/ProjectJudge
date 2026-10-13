// @vitest-environment node
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { toDocx } from './toDocx';
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
    document: { fileName: 'informe.pdf', format: 'pdf', stats: { words: 100, figuresUsed: 0, figuresDiscarded: 0 } },
    map: { slots: [], summary: 'Resumen.', titles: [{ sectionId: 's1', title: 'Objetivos' }] },
    sections: [
      {
        sectionId: 's1',
        title: 'Objetivos',
        slotId: 'objetivos',
        criteria: [
          { criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Evidencia', feedback: 'Bien.', evaluable: true },
        ],
        strengths: [],
        improvements: [],
        figureNotes: [],
        evaluated: true,
      },
    ],
    synthesis: {
      overallAssessment: 'Mejorable',
      summary: 'Resumen.',
      strengths: [],
      improvements: [],
      coherenceNotes: [],
      referenceComparison: '',
      about: 'Informe de ejemplo.',
      nextSteps: [],
    },
    checks: [],
  };
}

describe('toDocx', () => {
  it('genera un docx con el titulo y los criterios', async () => {
    const blob = await toDocx(sampleView());
    expect(blob.size).toBeGreaterThan(0);
    const buffer =
      typeof (blob as Blob).arrayBuffer === 'function'
        ? await blob.arrayBuffer()
        : await new Response(blob).arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('text');
    expect(xml).toContain('informe.pdf');
    expect(xml).toContain('Mejorable');
  });
});

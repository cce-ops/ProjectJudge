import { describe, it, expect, vi } from 'vitest';
import { orchestrate, estimateEvaluation } from './orchestrate';

function mockClient() {
  return {
    generateJson: vi.fn().mockImplementation(async ({ prompt }: any) => {
      if (prompt.includes('Mapa de apartados')) return { overallAssessment: 'Mejorable', summary: 'S', strengths: ['S'], improvements: ['I'], coherenceNotes: [], referenceComparison: '' };
      if (prompt.includes('asigna cada sección')) return { slots: [{ slotId: 'antecedentes', present: true, sectionId: 's1' }], summary: 'Resumen.' };
      if (prompt.includes('la sección')) return { criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'E', feedback: 'F' }], strengths: ['S'], improvements: ['I'], figureNotes: [] };
      return { overallAssessment: 'Mejorable', summary: 'S', strengths: ['S'], improvements: ['I'], coherenceNotes: [], referenceComparison: '' };
    }),
  } as any;
}

describe('estimateEvaluation', () => {
  it('estimates tokens and truncated flag for large documents', () => {
    const doc = { sections: Array(25).fill({ text: 'a'.repeat(10000) }), figures: Array(3).fill({}) } as any;
    const est = estimateEvaluation({ document: doc, references: [] });
    expect(est.calls).toBeGreaterThan(0);
    expect(est.tokens).toBeGreaterThan(0);
    expect(est.truncated).toBe(true);
  });

  it('estimates small document without truncation', () => {
    const doc = { sections: Array(3).fill({ text: 'texto breve' }), figures: Array(1).fill({}) } as any;
    const est = estimateEvaluation({ document: doc, references: [] });
    expect(est.truncated).toBe(false);
  });
});

describe('orchestrate', () => {
  it('produces a ReportView with model and sections', async () => {
    const result = await orchestrate({
      document: {
        fileName: 'test.pdf', format: 'pdf', text: 'texto',
        sections: [{ id: 's1', title: 'Antecedentes', level: 1, text: 't', figureIds: [] }],
        figures: [], warnings: [], stats: { pages: 1, words: 2, figuresUsed: 0, figuresDiscarded: 0 },
      },
      references: [],
      rubric: { criteria: [{ id: 'c1', name: 'Contenido', description: '', maxScore: 10, levels: [{ label: 'L', descriptor: '', score: 10 }] }], scale: { min: 0, max: 10 }, source: 'Manual', fingerprint: 'fp' },
      client: mockClient(),
      limiter: { run: async <T>(t: () => Promise<T>) => t() } as any,
    });
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.synthesis.overallAssessment).toBe('Mejorable');
  });
});

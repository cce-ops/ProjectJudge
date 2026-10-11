import { describe, it, expect, vi } from 'vitest';
import { evaluateSections } from './evaluateSections';
import type { ExtractedDocument } from '../../types/extract';

describe('evaluateSections', () => {
  it('evaluates each section against criteria', async () => {
    const mockClient = {
      generateJson: vi.fn().mockResolvedValue({
        sections: [
          {
            sectionId: 's1',
            criteria: [{ criterionId: 'c1', score: 8, maxScore: 10, evidence: 'Bueno', feedback: 'OK' }],
            strengths: ['Fuerte'],
            improvements: ['Mejorar'],
          },
        ],
      }),
    } as any;

    const document: ExtractedDocument = {
      fileName: 'x', format: 'md', text: 't',
      sections: [{ id: 's1', title: 'Test', level: 1, text: 'texto', figureIds: [] }],
      figures: [], warnings: [], stats: { words: 1, figuresUsed: 0, figuresDiscarded: 0 },
    };

    const result = await evaluateSections({ document, references: [], rubric: { criteria: [{ id: 'c1', name: 'Contenido', maxScore: 10, levels: [{ label: 'L', descriptor: '', score: 8 }] }], scale: { min: 0, max: 10 }, source: 'Manual', fingerprint: 'fp' } as any }, mockClient);
    expect(Array.isArray(result)).toBe(true);
  });

  it('preserves partial results when a section fails', async () => {
    const mockClient = {
      generateJson: vi.fn()
        .mockRejectedValueOnce(new Error('Fallo'))
        .mockResolvedValue({ sections: [{ sectionId: 's2', criteria: [], strengths: [], improvements: [] }] }),
    } as any;

    const document: ExtractedDocument = {
      fileName: 'x', format: 'md', text: 't',
      sections: [
        { id: 's1', title: 'S1', level: 1, text: 'a', figureIds: [] },
        { id: 's2', title: 'S2', level: 1, text: 'b', figureIds: [] },
      ],
      figures: [], warnings: [], stats: { words: 2, figuresUsed: 0, figuresDiscarded: 0 },
    };

    const result = await evaluateSections({ document, references: [], rubric: { criteria: [], scale: { min: 0, max: 10 }, source: '', fingerprint: '' } as any }, mockClient);
    expect(result.some((r: any) => !r.evaluated)).toBe(true);
  });
});
